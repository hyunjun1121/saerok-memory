from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import delete, exists, func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.models import (
    CanonicalSnapshot,
    Entity,
    Episode,
    EventEntity,
    IngestionReceipt,
    Projection,
    QuestionRecord,
    ReviewItem,
    User,
)
from app.services.embedding import EmbeddingService, EmbeddingUnavailable, get_embedding_service
from app.services.extraction import (
    extract_explicit_voice_annotations,
    transcript_requires_sensitive_handling,
)
from app.services.graph_store import sync_user_to_neo4j
from app.services.projection import refresh_projection


class IdempotencyConflict(ValueError):
    pass


class ConsentRequired(ValueError):
    pass


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _stable_id(prefix: str, *parts: str) -> str:
    digest = hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()[:32]
    return f"{prefix}-{digest}"


def _canonical_body_sha256(payload: dict[str, Any]) -> str:
    canonical = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _nullable_confidence(response: dict[str, Any]) -> float | None:
    stt = response.get("stt")
    if not isinstance(stt, dict):
        return None
    engine = str(stt.get("engine") or "").strip().casefold()
    # Only locally produced Qwen results may contribute a confidence value.
    # Demo/mock/placeholder and unknown engines remain reviewable evidence, but
    # their authored numeric confidence must not be treated as measured output.
    if engine != "qwen3-asr" and not engine.startswith("qwen3-asr:"):
        return None
    raw = stt.get("confidence")
    if raw is None or isinstance(raw, bool):
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    return value if 0.0 <= value <= 1.0 else None


def _voice_transcript(response: dict[str, Any]) -> str | None:
    correction = response.get("user_correction")
    if isinstance(correction, dict) and correction.get("was_corrected") is True:
        corrected = correction.get("corrected_transcript")
        if isinstance(corrected, str) and corrected.strip():
            return corrected.strip()[:10_000]
    stt = response.get("stt")
    if isinstance(stt, dict):
        transcript = stt.get("transcript")
        if isinstance(transcript, str) and transcript.strip():
            return transcript.strip()[:10_000]
    raw = response.get("raw_user_utterance_transcript")
    if isinstance(raw, str) and raw.strip():
        return raw.strip()[:10_000]
    return None


def _response_document(
    prompt: str,
    response_type: str,
    response: dict[str, Any],
) -> tuple[str, str | None, float | None]:
    prompt_text = prompt.strip()[:20_000]
    if response_type == "voice" or response.get("input_mode") == "voice":
        transcript = _voice_transcript(response)
        answer = transcript or "전사되지 않은 음성 응답"
        return f"문항: {prompt_text}\n사용자 음성 응답: {answer}", transcript, _nullable_confidence(response)

    if response_type == "single_choice":
        selected = response.get("selected_choice")
        label = selected.get("label") if isinstance(selected, dict) else None
        button = selected.get("button") if isinstance(selected, dict) else None
        answer = str(label or button or "응답 없음")[:1_000]
        return f"문항: {prompt_text}\n사용자 선택: {answer}", None, None

    if response_type == "button_sequence":
        labels = response.get("submitted_labels")
        buttons = response.get("submitted_sequence")
        values = labels if isinstance(labels, list) and labels else buttons
        answer = " → ".join(str(value)[:300] for value in (values or [])) or "응답 없음"
        return f"문항: {prompt_text}\n사용자 제출 순서: {answer}", None, None

    # Preserve unforeseen response types without inferring personal facts.
    summary = json.dumps(response, ensure_ascii=False, sort_keys=True)[:4_000]
    return f"문항: {prompt_text}\n사용자 응답: {summary}", None, None


def _upsert_question(
    db: Session,
    *,
    user_id: str,
    dataset_id: str,
    session: dict[str, Any],
    question_record: dict[str, Any],
    counters: dict[str, int],
) -> QuestionRecord:
    question = question_record["question"]
    external_id = str(question["question_id"])
    row_id = _stable_id(
        "QREC", user_id, dataset_id, str(session["session_id"]), external_id
    )
    row = db.get(QuestionRecord, row_id)
    values = {
        "user_id": user_id,
        "dataset_id": dataset_id,
        "external_question_id": external_id,
        "session_id": str(session["session_id"]),
        "session_date": str(session["session_date"]),
        "domain": str(question.get("domain", ""))[:300],
        "prompt": str(question.get("prompt_text", ""))[:20_000],
        "response_type": str(question.get("response_type", ""))[:80],
        "scored": bool(question.get("scored")),
        "source_note": (
            str(question["personalization_source_note"])[:20_000]
            if question.get("personalization_source_note") is not None
            else None
        ),
        "payload": question_record,
        "updated_at": _now(),
    }
    if row is None:
        row = QuestionRecord(id=row_id, **values)
        db.add(row)
        counters["questions_created"] += 1
    else:
        existing_response = row.payload.get("response") if isinstance(row.payload, dict) else None
        incoming_response = question_record.get("response")
        # A reset/in-progress snapshot must not erase a previously completed
        # question. A later completed response may still correct/upsert it.
        if isinstance(existing_response, dict) and not isinstance(incoming_response, dict):
            return row
        for key, value in values.items():
            setattr(row, key, value)
        counters["questions_updated"] += 1
    return row


def _upsert_profile_evidence(
    db: Session,
    *,
    payload: dict[str, Any],
    user_id: str,
    dataset_id: str,
    embedder: EmbeddingService,
    counters: dict[str, int],
) -> str:
    profile = payload["user"].get("registered_profile_fields") or {}
    period = payload["dataset"].get("period") or {}
    start = str(period.get("start") or period.get("start_date") or "")
    text = "초기 등록 정보: " + ", ".join(
        f"{key}={value}" for key, value in profile.items()
    )
    episode_id = _stable_id("EP", user_id, dataset_id, "PROFILE", "PROFILE", "PROFILE")
    row = db.get(Episode, episode_id)
    values = {
        "user_id": user_id,
        "dataset_id": dataset_id,
        "session_id": "PROFILE",
        "question_record_id": None,
        "question_id": "PROFILE",
        "response_id": "PROFILE",
        "occurred_at": start,
        "response_type": "profile",
        "evidence_text": text,
        "transcript": None,
        "raw_payload": {"registered_profile_fields": profile},
        "confidence": None,
        "sensitive": any("복약" in str(key) or "건강" in str(key) for key in profile),
        "embedding": embedder.embed_passage(text),
        "embedding_model": embedder.model_id,
        "embedding_revision": embedder.revision,
        "updated_at": _now(),
    }
    if row is None:
        db.add(Episode(id=episode_id, **values))
        counters["evidence_created"] += 1
    else:
        for key, value in values.items():
            setattr(row, key, value)
        counters["evidence_updated"] += 1
    return episode_id


def _replace_reviews(
    db: Session,
    *,
    episode: Episode,
    is_voice: bool,
    transcript: str | None,
    counters: dict[str, int],
) -> None:
    db.execute(delete(ReviewItem).where(ReviewItem.episode_id == episode.id))
    if not is_voice:
        return
    reasons: list[str] = []
    if transcript is None:
        reasons.append("missing_transcript")
    if episode.confidence is None:
        reasons.append("missing_confidence")
    elif episode.confidence < settings.min_question_confidence:
        reasons.append("low_confidence")
    if episode.sensitive:
        reasons.append("sensitive")
    for reason in reasons:
        db.add(
            ReviewItem(
                user_id=episode.user_id,
                episode_id=episode.id,
                reason=reason,
                details={
                    "confidence": episode.confidence,
                    "sensitive": episode.sensitive,
                    "has_transcript": transcript is not None,
                },
            )
        )
        counters["reviews_created"] += 1


def _replace_entity_links(
    db: Session,
    *,
    episode: Episode,
    question_record: dict[str, Any],
    is_voice: bool,
    counters: dict[str, int],
) -> None:
    db.execute(delete(EventEntity).where(EventEntity.episode_id == episode.id))
    if not is_voice:
        return
    for item in extract_explicit_voice_annotations(question_record, episode.confidence):
        entity_id = _stable_id(
            "ENT",
            episode.user_id,
            item["entity_type"],
            item["canonical_value"],
        )
        entity = db.get(Entity, entity_id)
        if entity is None:
            entity = Entity(
                id=entity_id,
                user_id=episode.user_id,
                entity_type=item["entity_type"],
                value=item["value"],
                canonical_value=item["canonical_value"],
                first_seen_at=episode.occurred_at,
                last_seen_at=episode.occurred_at,
                sensitive=item["sensitive"],
            )
            db.add(entity)
            counters["entities_created"] += 1
        else:
            entity.value = item["value"]
            entity.sensitive = bool(entity.sensitive or item["sensitive"])
        db.flush()
        db.add(
            EventEntity(
                episode_id=episode.id,
                entity_id=entity.id,
                relation=item["relation"],
                confidence=item["confidence"],
            )
        )
        counters["links_created"] += 1


def _upsert_evidence(
    db: Session,
    *,
    user_id: str,
    dataset_id: str,
    session: dict[str, Any],
    question_row: QuestionRecord,
    question_record: dict[str, Any],
    embedder: EmbeddingService,
    counters: dict[str, int],
) -> str | None:
    response = question_record.get("response")
    if not isinstance(response, dict):
        return None
    response_id = str(response.get("response_id") or "RESPONSE")[:300]
    episode_id = _stable_id(
        "EP",
        user_id,
        dataset_id,
        str(session["session_id"]),
        question_row.external_question_id,
        response_id,
    )
    response_type = question_row.response_type
    evidence_text, transcript, confidence = _response_document(
        question_row.prompt,
        response_type,
        response,
    )
    is_voice = response_type == "voice" or response.get("input_mode") == "voice"
    explicit_items = (
        extract_explicit_voice_annotations(question_record, confidence) if is_voice else []
    )
    sensitive = transcript_requires_sensitive_handling(transcript) or any(
        item["sensitive"] for item in explicit_items
    )
    values = {
        "user_id": user_id,
        "dataset_id": dataset_id,
        "session_id": str(session["session_id"]),
        "question_record_id": question_row.id,
        "question_id": question_row.external_question_id,
        "response_id": response_id,
        "occurred_at": str(session["session_date"]),
        "response_type": response_type,
        "evidence_text": evidence_text,
        "transcript": transcript,
        "raw_payload": question_record,
        "confidence": confidence,
        "sensitive": sensitive,
        "embedding": embedder.embed_passage(evidence_text),
        "embedding_model": embedder.model_id,
        "embedding_revision": embedder.revision,
        "updated_at": _now(),
    }
    episode = db.get(Episode, episode_id)
    if episode is None:
        episode = Episode(id=episode_id, **values)
        db.add(episode)
        counters["evidence_created"] += 1
    else:
        for key, value in values.items():
            setattr(episode, key, value)
        counters["evidence_updated"] += 1
    db.flush()
    _replace_entity_links(
        db,
        episode=episode,
        question_record=question_record,
        is_voice=is_voice,
        counters=counters,
    )
    _replace_reviews(
        db,
        episode=episode,
        is_voice=is_voice,
        transcript=transcript,
        counters=counters,
    )
    return episode_id


def _cleanup_orphan_entities(
    db: Session,
    *,
    user_id: str,
) -> None:
    # EventEntity rows are added during this transaction. Flush them before
    # deciding which entities are unreferenced, otherwise pending links are
    # invisible to the orphan query and their entities can be deleted early.
    db.flush()
    orphan_ids = list(
        db.scalars(
            select(Entity.id).where(
                Entity.user_id == user_id,
                ~exists().where(EventEntity.entity_id == Entity.id),
            )
        )
    )
    if orphan_ids:
        db.execute(delete(Entity).where(Entity.id.in_(orphan_ids)))

    entities = list(db.scalars(select(Entity).where(Entity.user_id == user_id)))
    for entity in entities:
        dates = list(
            db.scalars(
                select(Episode.occurred_at)
                .join(EventEntity, EventEntity.episode_id == Episode.id)
                .where(EventEntity.entity_id == entity.id)
            )
        )
        if dates:
            entity.first_seen_at = min(dates)
            entity.last_seen_at = max(dates)


def _ensure_canonical_snapshot(
    db: Session,
    *,
    payload: dict[str, Any],
    user_id: str,
    dataset_id: str,
    body_sha256: str,
    content_hash_header: str | None,
) -> CanonicalSnapshot:
    snapshot_id = _stable_id("SNAP", user_id, dataset_id, body_sha256)
    snapshot = db.get(CanonicalSnapshot, snapshot_id)
    if snapshot is None:
        snapshot = CanonicalSnapshot(
            id=snapshot_id,
            user_id=user_id,
            dataset_id=dataset_id,
            body_sha256=body_sha256,
            content_hash_header=content_hash_header or None,
            payload=payload,
        )
        db.add(snapshot)
    elif _canonical_body_sha256(snapshot.payload) != body_sha256:
        raise IdempotencyConflict("canonical snapshot digest collision")
    return snapshot


def _resume_derived_work(
    *,
    user_id: str,
    receipt_id: str,
    result: dict[str, Any],
    replay: bool,
) -> dict[str, Any]:
    stored_result = dict(result)
    projection = stored_result.get("projection")
    if not isinstance(projection, dict) or projection.get("method") == "pending":
        stored_result["projection"] = refresh_projection(user_id)
    if settings.neo4j_enabled and not stored_result.get("neo4j_synced", False):
        stored_result["neo4j_synced"] = sync_user_to_neo4j(user_id)
    with SessionLocal() as db:
        receipt = db.get(IngestionReceipt, receipt_id)
        if receipt is not None:
            receipt.result = {**stored_result, "idempotent_replay": False}
            db.commit()
    return {**stored_result, "idempotent_replay": replay}


def ingest_payload(
    payload: dict[str, Any],
    *,
    idempotency_key: str | None = None,
    content_hash_header: str | None = None,
    embedder: EmbeddingService | None = None,
) -> dict[str, Any]:
    embedder = embedder or get_embedding_service()
    if not embedder.ready:
        raise EmbeddingUnavailable("embedding model is not ready")

    user_raw = payload["user"]
    consents = user_raw.get("consents") or {}
    if consents.get("longitudinal_usage_storage") is not True:
        raise ConsentRequired("longitudinal usage storage consent is required")

    user_id = str(user_raw["user_id"])
    dataset_id = str(payload["dataset"]["dataset_id"])
    body_sha256 = _canonical_body_sha256(payload)
    key = (idempotency_key or f"body-{body_sha256}")[:240]
    receipt_id = _stable_id("ING", user_id, dataset_id, key)

    with SessionLocal() as db:
        prior = db.get(IngestionReceipt, receipt_id)
        if prior is not None:
            if prior.body_sha256 != body_sha256:
                raise IdempotencyConflict("idempotency key was already used for another payload")
            _ensure_canonical_snapshot(
                db,
                payload=payload,
                user_id=user_id,
                dataset_id=dataset_id,
                body_sha256=body_sha256,
                content_hash_header=content_hash_header,
            )
            prior_result = dict(prior.result)
            db.commit()
            return _resume_derived_work(
                user_id=user_id,
                receipt_id=receipt_id,
                result=prior_result,
                replay=True,
            )

        user = db.get(User, user_id)
        if user is None:
            user = User(
                id=user_id,
                display_name=str(user_raw.get("display_name", user_id))[:300],
                profile=user_raw,
                consent=consents,
                updated_at=_now(),
            )
            db.add(user)
        else:
            user.display_name = str(user_raw.get("display_name", user_id))[:300]
            user.profile = user_raw
            user.consent = consents
            user.updated_at = _now()
        db.flush()

        _ensure_canonical_snapshot(
            db,
            payload=payload,
            user_id=user_id,
            dataset_id=dataset_id,
            body_sha256=body_sha256,
            content_hash_header=content_hash_header,
        )

        counters = {
            "questions_created": 0,
            "questions_updated": 0,
            "evidence_created": 0,
            "evidence_updated": 0,
            "evidence_deleted": 0,
            "entities_created": 0,
            "links_created": 0,
            "reviews_created": 0,
        }
        _upsert_profile_evidence(
            db,
            payload=payload,
            user_id=user_id,
            dataset_id=dataset_id,
            embedder=embedder,
            counters=counters,
        )

        for session in payload.get("sessions") or []:
            for question_record in session.get("question_records") or []:
                question_row = _upsert_question(
                    db,
                    user_id=user_id,
                    dataset_id=dataset_id,
                    session=session,
                    question_record=question_record,
                    counters=counters,
                )
                db.flush()
                episode_id = _upsert_evidence(
                    db,
                    user_id=user_id,
                    dataset_id=dataset_id,
                    session=session,
                    question_row=question_row,
                    question_record=question_record,
                    embedder=embedder,
                    counters=counters,
                )
        _cleanup_orphan_entities(db, user_id=user_id)
        result: dict[str, Any] = {
            "user_id": user_id,
            "dataset_id": dataset_id,
            **counters,
            "idempotent_replay": False,
            "projection": {"count": 0, "method": "pending"},
            "neo4j_synced": False,
        }
        db.add(
            IngestionReceipt(
                id=receipt_id,
                user_id=user_id,
                dataset_id=dataset_id,
                idempotency_key=key,
                content_hash_header=(content_hash_header or None),
                body_sha256=body_sha256,
                result=result,
            )
        )
        db.commit()

    return _resume_derived_work(
        user_id=user_id,
        receipt_id=receipt_id,
        result=result,
        replay=False,
    )


def ingest_file(
    path: str | Path,
    *,
    idempotency_key: str | None = None,
    embedder: EmbeddingService | None = None,
) -> dict[str, Any]:
    with open(path, encoding="utf-8") as source:
        payload = json.load(source)
    return ingest_payload(
        payload,
        idempotency_key=idempotency_key,
        embedder=embedder,
    )


def ingest_seed_if_empty(embedder: EmbeddingService | None = None) -> dict[str, Any]:
    with SessionLocal() as db:
        count = db.scalar(select(func.count()).select_from(IngestionReceipt)) or 0
    if count:
        return {"status": "already_seeded", "receipts": count}
    return ingest_file(
        settings.seed_json_path,
        idempotency_key="seed-v1",
        embedder=embedder,
    )
