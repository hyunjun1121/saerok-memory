import hashlib
import json
from pathlib import Path
from sqlalchemy import select, func
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.models import User, Episode, Entity, EventEntity, QuestionRecord, ReviewItem
from app.services.embedding import embed_text
from app.services.extraction import extract_items, canonicalize
from app.services.graph_store import Neo4jStore

def _id(prefix: str, *parts: str) -> str:
    digest = hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:16]
    return f"{prefix}-{digest}"

def ingest_payload(payload: dict) -> dict:
    store = Neo4jStore()
    if store.available:
        store.ensure_constraints()

    user_raw = payload["user"]
    user_id = user_raw["user_id"]
    counters = {"users": 0, "episodes": 0, "entities": 0, "questions": 0}

    with SessionLocal() as db:
        user = db.get(User, user_id)
        if not user:
            user = User(
                id=user_id,
                display_name=user_raw.get("display_name", user_id),
                profile=user_raw,
                consent=user_raw.get("consents", {})
            )
            db.add(user)
            counters["users"] += 1
        else:
            user.profile = user_raw
            user.consent = user_raw.get("consents", {})

        db.flush()
        store.upsert_user({
            "id": user.id,
            "display_name": user.display_name,
            "profile": user.profile
        })

        # Initial long-term profile facts become a synthetic registration episode.
        profile_episode_id = f"PROFILE-{user_id}"
        if not db.get(Episode, profile_episode_id):
            text = "초기 등록 정보: " + ", ".join(
                f"{k}={v}" for k, v in user_raw.get("registered_profile_fields", {}).items()
            )
            ep = Episode(
                id=profile_episode_id, user_id=user_id, session_id="PROFILE",
                question_id="PROFILE", occurred_at=payload["dataset"]["period"]["start"],
                transcript=text, raw_payload={"source": "registered_profile_fields"},
                confidence=1.0, sensitive=False, embedding=embed_text(text)
            )
            db.add(ep)
            counters["episodes"] += 1
            for etype, value in user_raw.get("registered_profile_fields", {}).items():
                canonical = canonicalize(str(value))
                ent_id = _id("ENT", user_id, etype, canonical)
                ent = db.get(Entity, ent_id)
                if not ent:
                    ent = Entity(
                        id=ent_id, user_id=user_id, entity_type=etype,
                        value=str(value), canonical_value=canonical,
                        first_seen_at=ep.occurred_at, last_seen_at=ep.occurred_at,
                        sensitive=("복약" in etype)
                    )
                    db.add(ent)
                    counters["entities"] += 1
                db.add(EventEntity(
                    episode_id=profile_episode_id, entity_id=ent_id,
                    relation="PROFILE_FACT", confidence=1.0
                ))

        for session in payload.get("sessions", []):
            date = session["session_date"]
            for qr in session.get("question_records", []):
                q = qr["question"]
                if not db.get(QuestionRecord, q["question_id"]):
                    db.add(QuestionRecord(
                        id=q["question_id"], user_id=user_id,
                        session_id=session["session_id"], session_date=date,
                        domain=q.get("domain", ""), prompt=q.get("prompt_text", ""),
                        response_type=q.get("response_type", ""),
                        scored=bool(q.get("scored")), source_note=q.get("personalization_source_note"),
                        payload=qr
                    ))
                    counters["questions"] += 1

                response = qr.get("response", {})
                transcript = (
                    response.get("user_correction", {}).get("corrected_transcript")
                    if response.get("user_correction", {}).get("was_corrected")
                    else response.get("stt", {}).get("transcript")
                ) or response.get("raw_user_utterance_transcript")
                if not transcript:
                    continue

                episode_id = response.get("response_id") or _id("EP", session["session_id"], q["question_id"])
                confidence = float(response.get("stt", {}).get("confidence") or 1.0)
                items = extract_items(qr)
                sensitive = any(i["sensitive"] for i in items)

                if not db.get(Episode, episode_id):
                    ep = Episode(
                        id=episode_id, user_id=user_id, session_id=session["session_id"],
                        question_id=q["question_id"], occurred_at=date,
                        transcript=transcript, raw_payload=qr, confidence=confidence,
                        sensitive=sensitive, embedding=embed_text(transcript)
                    )
                    db.add(ep)
                    counters["episodes"] += 1
                else:
                    ep = db.get(Episode, episode_id)

                db.flush()
                neo_entities = []
                for item in items:
                    ent_id = _id("ENT", user_id, item["entity_type"], item["canonical_value"])
                    ent = db.get(Entity, ent_id)
                    if not ent:
                        ent = Entity(
                            id=ent_id, user_id=user_id,
                            entity_type=item["entity_type"], value=item["value"],
                            canonical_value=item["canonical_value"],
                            first_seen_at=date, last_seen_at=date,
                            sensitive=item["sensitive"]
                        )
                        db.add(ent)
                        counters["entities"] += 1
                    else:
                        ent.last_seen_at = max(ent.last_seen_at, date)
                    db.flush()
                    exists = db.scalar(select(func.count()).select_from(EventEntity).where(
                        EventEntity.episode_id == episode_id,
                        EventEntity.entity_id == ent_id,
                        EventEntity.relation == item["relation"]
                    ))
                    if not exists:
                        db.add(EventEntity(
                            episode_id=episode_id, entity_id=ent_id,
                            relation=item["relation"], confidence=item["confidence"]
                        ))
                    neo_entities.append({
                        "entity_id": ent_id,
                        "entity_type": item["entity_type"],
                        "value": item["value"],
                        "canonical_value": item["canonical_value"],
                        "sensitive": item["sensitive"],
                        "relation": item["relation"],
                        "confidence": item["confidence"]
                    })

                if confidence < settings.min_question_confidence or sensitive:
                    reason = "low_confidence" if confidence < settings.min_question_confidence else "sensitive"
                    exists_review = db.scalar(select(func.count()).select_from(ReviewItem).where(
                        ReviewItem.episode_id == episode_id,
                        ReviewItem.reason == reason
                    ))
                    if not exists_review:
                        db.add(ReviewItem(
                            user_id=user_id, episode_id=episode_id, reason=reason,
                            details={"confidence": confidence, "sensitive": sensitive}
                        ))

                store.upsert_episode({
                    "id": episode_id, "user_id": user_id,
                    "occurred_at": date, "transcript": transcript,
                    "confidence": confidence, "sensitive": sensitive
                }, neo_entities)

        db.commit()

    store.close()
    return {
        **counters,
        "neo4j_synced": store.available,
        "details": {"dataset_id": payload.get("dataset", {}).get("dataset_id")}
    }

def ingest_file(path: str | Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return ingest_payload(json.load(f))

def ingest_seed_if_empty() -> dict:
    with SessionLocal() as db:
        count = db.scalar(select(func.count()).select_from(User)) or 0
    if count:
        return {"status": "already_seeded", "users": count}
    return ingest_file(settings.seed_json_path)
