from __future__ import annotations

import copy
import gzip
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import event, func, inspect, select, text

from app.core.config import settings
from app.core.database import SessionLocal, engine
from app.core.models import (
    CanonicalSnapshot,
    DeletionTombstone,
    Entity,
    Episode,
    EventEntity,
    IngestionReceipt,
    Projection,
    QuestionRecord,
    User,
)
from app.services.ingestion import _stable_id
from app.services.question_generator import _distractors
from app.services.query import semantic_search


USER = "USR-000001"


def _headers(key: str) -> dict[str, str]:
    return {
        "Authorization": "Bearer test-local-token",
        "Content-Type": "application/json",
        "Idempotency-Key": key,
        "X-Haru-Content-Hash": key.removeprefix("haru-"),
    }


def _first_voice_record(payload: dict) -> dict:
    for session in payload["sessions"]:
        for record in session["question_records"]:
            if record["question"]["response_type"] == "voice":
                return record
    raise AssertionError("voice record missing")


def _without_voice_history(payload: dict) -> dict:
    result = copy.deepcopy(payload)
    for session in result["sessions"]:
        session["question_records"] = [
            record
            for record in session["question_records"]
            if record["question"]["response_type"] != "voice"
        ]
        session["question_count"] = len(session["question_records"])
    return result


def _small_payload(payload: dict) -> dict:
    result = _without_voice_history(payload)
    first_session = result["sessions"][0]
    first_session["question_records"] = first_session["question_records"][:1]
    first_session["question_count"] = 1
    result["sessions"] = [first_session]
    return result


def test_stable_id_v2_cannot_collide_through_delimiters():
    left = _stable_id("TEST", "person|dataset", "session")
    right = _stable_id("TEST", "person", "dataset|session")

    assert left != right
    assert left.startswith("TEST-v2-")
    assert right.startswith("TEST-v2-")


def test_ingest_preserves_exact_request_bytes_and_exposes_raw_snapshot(
    client,
    seed_payload,
    auth_headers,
):
    raw = json.dumps(seed_payload, ensure_ascii=False, indent=2).encode("utf-8") + b"\n"
    response = client.post(
        "/api/ingest/json",
        content=raw,
        headers=_headers("haru-raw-round-trip"),
    )
    assert response.status_code == 200, response.text

    with SessionLocal() as db:
        snapshot = db.scalar(select(CanonicalSnapshot))
        assert snapshot is not None
        assert snapshot.raw_size_bytes == len(raw)
        assert snapshot.raw_sha256 == hashlib.sha256(raw).hexdigest()
        assert gzip.decompress(snapshot.raw_payload_gzip) == raw

    snapshots = client.get(
        f"/api/users/{USER}/snapshots",
        headers=auth_headers,
    ).json()
    raw_response = client.get(
        f"/api/users/{USER}/snapshots/{snapshots[0]['snapshot_id']}/raw",
        headers=auth_headers,
    )
    assert raw_response.status_code == 200
    assert raw_response.content == raw
    assert raw_response.headers["x-haru-body-sha256"] == hashlib.sha256(raw).hexdigest()


def test_ingest_rejects_oversize_stream_before_persistence(
    client,
    seed_payload,
    monkeypatch,
):
    raw = json.dumps(seed_payload, ensure_ascii=False).encode("utf-8")
    monkeypatch.setattr(settings, "max_json_bytes", len(raw) - 1)

    response = client.post(
        "/api/ingest/json",
        content=raw,
        headers=_headers("haru-too-large"),
    )

    assert response.status_code == 413
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(IngestionReceipt)) == 0
        assert db.scalar(select(func.count()).select_from(CanonicalSnapshot)) == 0


def test_voice_payload_requires_voice_and_stt_consents(client, seed_payload):
    for denied in ("voice_recording", "stt_processing"):
        payload = copy.deepcopy(seed_payload)
        payload["user"]["consents"][denied] = False
        response = client.post(
            "/api/ingest/json",
            json=payload,
            headers=_headers(f"haru-denied-{denied}"),
        )
        assert response.status_code == 403

    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(IngestionReceipt)) == 0


def test_full_history_voice_revocation_purges_prior_voice_material(client, seed_payload):
    first = client.post(
        "/api/ingest/json",
        json=seed_payload,
        headers=_headers("haru-before-full-voice-revoke"),
    )
    assert first.status_code == 200, first.text

    revoked = copy.deepcopy(seed_payload)
    revoked["user"]["consents"]["voice_recording"] = False
    response = client.post(
        "/api/ingest/json",
        json=revoked,
        headers=_headers("haru-full-voice-revoke"),
    )
    assert response.status_code == 403

    with SessionLocal() as db:
        user = db.get(User, USER)
        assert user is not None
        assert user.consent["voice_recording"] is False
        assert db.scalar(
            select(func.count()).select_from(Episode).where(Episode.response_type == "voice")
        ) == 0
        assert db.scalar(
            select(func.count()).select_from(QuestionRecord).where(
                QuestionRecord.response_type == "voice"
            )
        ) == 0
        assert db.scalar(select(func.count()).select_from(CanonicalSnapshot)) == 0
        assert db.scalar(select(func.count()).select_from(IngestionReceipt)) == 0
        assert db.scalar(select(func.count()).select_from(EventEntity)) == 0
        assert db.scalar(select(func.count()).select_from(Entity)) == 0


def test_partial_history_stt_revocation_purges_then_stores_only_safe_snapshot(
    client,
    seed_payload,
):
    first = client.post(
        "/api/ingest/json",
        json=seed_payload,
        headers=_headers("haru-before-partial-stt-revoke"),
    )
    assert first.status_code == 200, first.text

    partial = _without_voice_history(seed_payload)
    partial["user"]["consents"]["stt_processing"] = False
    response = client.post(
        "/api/ingest/json",
        json=partial,
        headers=_headers("haru-partial-stt-revoke"),
    )
    assert response.status_code == 200, response.text

    with SessionLocal() as db:
        assert db.scalar(
            select(func.count()).select_from(Episode).where(Episode.response_type == "voice")
        ) == 0
        assert db.scalar(select(func.count()).select_from(CanonicalSnapshot)) == 1
        snapshot = db.scalar(select(CanonicalSnapshot))
        assert snapshot is not None
        raw = json.loads(gzip.decompress(snapshot.raw_payload_gzip).decode("utf-8"))
        assert all(
            record["question"]["response_type"] != "voice"
            for session in raw["sessions"]
            for record in session["question_records"]
        )


def test_voice_revocation_purges_voice_input_hidden_under_nonvoice_type(
    client,
    seed_payload,
):
    disguised = _small_payload(seed_payload)
    record = disguised["sessions"][0]["question_records"][0]
    record["question"]["response_type"] = "single_choice"
    record["response"] = {
        "response_id": "RSP-DISGUISED-VOICE",
        "input_mode": "voice",
        "stt": {"engine": "qwen3-asr", "transcript": "숨은 음성 기록"},
        "raw_user_utterance_transcript": "숨은 음성 기록",
    }
    first = client.post(
        "/api/ingest/json",
        json=disguised,
        headers=_headers("haru-disguised-voice"),
    )
    assert first.status_code == 200, first.text

    revoked = _small_payload(seed_payload)
    revoked["user"]["consents"]["voice_recording"] = False
    response = client.post(
        "/api/ingest/json",
        json=revoked,
        headers=_headers("haru-purge-disguised-voice"),
    )
    assert response.status_code == 200, response.text
    with SessionLocal() as db:
        assert db.scalar(
            select(func.count()).select_from(Episode).where(
                Episode.response_id == "RSP-DISGUISED-VOICE"
            )
        ) == 0
        assert all(
            row.payload.get("response", {}).get("response_id")
            != "RSP-DISGUISED-VOICE"
            for row in db.scalars(select(QuestionRecord))
        )


def test_personalization_revocation_purges_all_derivations_and_neo4j(
    client,
    seed_payload,
    monkeypatch,
):
    first = client.post(
        "/api/ingest/json",
        json=seed_payload,
        headers=_headers("haru-before-personalization-revoke"),
    )
    assert first.status_code == 200, first.text
    calls: list[str] = []
    import app.services.ingestion as ingestion_service

    monkeypatch.setattr(settings, "neo4j_enabled", True)
    monkeypatch.setattr(
        ingestion_service,
        "delete_user_from_neo4j",
        lambda user_id: calls.append(user_id) is None,
    )
    revoked = copy.deepcopy(seed_payload)
    revoked["user"]["consents"]["personalized_question_use"] = False
    response = client.post(
        "/api/ingest/json",
        json=revoked,
        headers=_headers("haru-personalization-revoke"),
    )
    assert response.status_code == 200, response.text
    assert response.json()["neo4j_synced"] is False
    assert response.json()["neo4j_purged"] is True
    assert calls == [USER]

    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(EventEntity)) == 0
        assert db.scalar(select(func.count()).select_from(Entity)) == 0
        assert db.scalar(select(func.count()).select_from(Projection)) == 0
        assert all(not episode.embedding for episode in db.scalars(select(Episode)))


def test_personalization_revocation_never_completes_when_neo4j_purge_fails(
    client,
    seed_payload,
    monkeypatch,
):
    first = client.post(
        "/api/ingest/json",
        json=seed_payload,
        headers=_headers("haru-before-failed-neo-purge"),
    )
    assert first.status_code == 200, first.text
    import app.services.ingestion as ingestion_service

    monkeypatch.setattr(settings, "neo4j_enabled", True)
    monkeypatch.setattr(ingestion_service, "delete_user_from_neo4j", lambda _user_id: False)
    revoked = copy.deepcopy(seed_payload)
    revoked["user"]["consents"]["personalized_question_use"] = False
    response = client.post(
        "/api/ingest/json",
        json=revoked,
        headers=_headers("haru-failed-neo-purge"),
    )
    assert response.status_code == 503
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(EventEntity)) == 0
        assert db.scalar(select(func.count()).select_from(Entity)) == 0
        assert db.scalar(select(func.count()).select_from(Projection)) == 0


def test_personalization_consent_blocks_derivation_and_retrieval(
    client,
    seed_payload,
    isolated_database,
):
    seed_payload["user"]["consents"]["personalized_question_use"] = False
    response = client.post(
        "/api/ingest/json",
        json=seed_payload,
        headers=_headers("haru-no-personalization"),
    )
    assert response.status_code == 200, response.text
    assert isolated_database[1].batches == []
    assert semantic_search(USER, "시장 방문", top_k=100, include_sensitive=True) == []


def test_unknown_response_type_is_sensitive_and_default_excluded(client, seed_payload):
    record = seed_payload["sessions"][0]["question_records"][0]
    record["question"]["response_type"] = "future_sensor_payload"
    record["response"] = {
        "response_id": "RSP-UNKNOWN-001",
        "opaque_value": "not-yet-reviewed",
    }
    response = client.post(
        "/api/ingest/json",
        json=seed_payload,
        headers=_headers("haru-unknown-sensitive"),
    )
    assert response.status_code == 200, response.text

    with SessionLocal() as db:
        episode = db.scalar(
            select(Episode).where(Episode.response_id == "RSP-UNKNOWN-001")
        )
        assert episode is not None
        assert episode.sensitive is True
        episode_id = episode.id

    assert episode_id not in {
        episode.id for _, episode in semantic_search(USER, "not-yet-reviewed", top_k=100)
    }


def test_changed_snapshot_embeds_only_changed_evidence(
    client,
    seed_payload,
    isolated_database,
):
    first = client.post(
        "/api/ingest/json",
        json=seed_payload,
        headers=_headers("haru-incremental-first"),
    )
    assert first.status_code == 200, first.text
    fake_encoder = isolated_database[1]
    assert len(fake_encoder.batches) == 1
    assert len(fake_encoder.batches[0]) == 43

    fake_encoder.calls.clear()
    fake_encoder.batches.clear()
    changed = copy.deepcopy(seed_payload)
    record = _first_voice_record(changed)
    record["response"]["stt"]["transcript"] = "한 문항만 바뀐 음성 기록"
    record["response"]["raw_user_utterance_transcript"] = "한 문항만 바뀐 음성 기록"
    second = client.post(
        "/api/ingest/json",
        json=changed,
        headers=_headers("haru-incremental-second"),
    )
    assert second.status_code == 200, second.text
    assert len(fake_encoder.batches) == 1
    assert len(fake_encoder.batches[0]) == 1
    assert "한 문항만 바뀐 음성 기록" in fake_encoder.batches[0][0]

    fake_encoder.calls.clear()
    fake_encoder.batches.clear()
    replay = client.post(
        "/api/ingest/json",
        json=changed,
        headers=_headers("haru-incremental-second"),
    )
    assert replay.status_code == 200
    assert fake_encoder.batches == []


def test_delete_tombstone_rejects_stale_reingest(
    client,
    seed_payload,
    auth_headers,
):
    first = client.post(
        "/api/ingest/json",
        json=seed_payload,
        headers=_headers("haru-before-delete"),
    )
    assert first.status_code == 200, first.text
    deleted = client.delete(f"/api/users/{USER}", headers=auth_headers)
    assert deleted.status_code == 200
    assert deleted.json()["complete"] is True

    stale = client.post(
        "/api/ingest/json",
        json=seed_payload,
        headers=_headers("haru-stale-after-delete"),
    )
    assert stale.status_code == 410
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(Episode)) == 0


def test_delete_generation_requires_explicit_current_generation_reenrollment(
    client,
    seed_payload,
    auth_headers,
):
    payload = _small_payload(seed_payload)
    first = client.post(
        "/api/ingest/json",
        json=payload,
        headers=_headers("haru-generation-first"),
    )
    assert first.status_code == 200, first.text
    deleted = client.delete(f"/api/users/{USER}", headers=auth_headers)
    assert deleted.status_code == 200
    assert deleted.json()["generation"] == 1

    reenroll_headers = {
        **_headers("haru-generation-reenroll-1"),
        "X-Haru-Sync-Generation": "1",
        "X-Haru-Reenroll": "true",
    }
    reenrolled = client.post("/api/ingest/json", json=payload, headers=reenroll_headers)
    assert reenrolled.status_code == 200, reenrolled.text
    assert reenrolled.json()["sync_generation"] == 1
    reenroll_retry = client.post(
        "/api/ingest/json",
        json=payload,
        headers=reenroll_headers,
    )
    assert reenroll_retry.status_code == 200, reenroll_retry.text
    assert reenroll_retry.json()["idempotent_replay"] is True

    stale = client.post(
        "/api/ingest/json",
        json=payload,
        headers=_headers("haru-generation-stale-zero"),
    )
    assert stale.status_code == 410
    current = client.post(
        "/api/ingest/json",
        json=payload,
        headers={
            **_headers("haru-generation-current"),
            "X-Haru-Sync-Generation": "1",
        },
    )
    assert current.status_code == 200, current.text

    deleted_again = client.delete(f"/api/users/{USER}", headers=auth_headers)
    assert deleted_again.json()["generation"] == 2
    old_generation = client.post(
        "/api/ingest/json",
        json=payload,
        headers={
            **_headers("haru-generation-old-reenroll"),
            "X-Haru-Sync-Generation": "1",
            "X-Haru-Reenroll": "true",
        },
    )
    assert old_generation.status_code == 410


def test_delete_and_ingest_same_user_are_serialized(
    client,
    seed_payload,
    auth_headers,
):
    payload = _small_payload(seed_payload)

    with ThreadPoolExecutor(max_workers=2) as executor:
        ingest_future = executor.submit(
            client.post,
            "/api/ingest/json",
            json=payload,
            headers=_headers("haru-race-ingest"),
        )
        delete_future = executor.submit(
            client.delete,
            f"/api/users/{USER}",
            headers=auth_headers,
        )
        ingest_response = ingest_future.result()
        delete_response = delete_future.result()

    assert ingest_response.status_code in {200, 410}
    assert delete_response.status_code == 200
    with SessionLocal() as db:
        assert db.get(User, USER) is None
        tombstone = db.get(DeletionTombstone, USER)
        assert tombstone is not None
        assert tombstone.active is True


def test_sqlite_safety_pragmas_and_search_indexes_are_enabled():
    with engine.connect() as connection:
        assert connection.execute(text("PRAGMA foreign_keys")).scalar_one() == 1
        assert connection.execute(text("PRAGMA busy_timeout")).scalar_one() >= 5_000
        assert str(connection.execute(text("PRAGMA journal_mode")).scalar_one()).lower() == "wal"

    indexes = {index["name"] for index in inspect(engine).get_indexes("episodes")}
    assert {"ix_episode_user_date", "ix_episode_search_scope"} <= indexes


def test_timeline_fetches_entity_links_without_per_episode_n_plus_one(
    client,
    seed_payload,
    auth_headers,
):
    response = client.post(
        "/api/ingest/json",
        json=seed_payload,
        headers=_headers("haru-timeline-query-count"),
    )
    assert response.status_code == 200, response.text
    statements: list[str] = []

    def record_statement(_connection, _cursor, statement, _parameters, _context, _many):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    event.listen(engine, "before_cursor_execute", record_statement)
    try:
        timeline = client.get(f"/api/users/{USER}/timeline", headers=auth_headers)
    finally:
        event.remove(engine, "before_cursor_execute", record_statement)

    assert timeline.status_code == 200
    assert len(timeline.json()) == 43
    assert len(statements) <= 2


def test_legacy_canonical_receipt_hash_replays_without_conflict(client, seed_payload):
    key = "haru-legacy-canonical-replay"
    first = client.post("/api/ingest/json", json=seed_payload, headers=_headers(key))
    assert first.status_code == 200, first.text
    legacy_hash = hashlib.sha256(
        json.dumps(
            seed_payload,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
    ).hexdigest()
    with SessionLocal() as db:
        receipt = db.scalar(select(IngestionReceipt))
        assert receipt is not None
        receipt.body_sha256 = legacy_hash
        db.commit()

    replay = client.post("/api/ingest/json", json=seed_payload, headers=_headers(key))
    assert replay.status_code == 200, replay.text
    assert replay.json()["idempotent_replay"] is True


def test_legacy_receipt_resume_updates_actual_prior_id(
    client,
    seed_payload,
    monkeypatch,
):
    key = "haru-legacy-prior-id"
    first = client.post("/api/ingest/json", json=seed_payload, headers=_headers(key))
    assert first.status_code == 200, first.text
    legacy_id = "ING-legacy-prior-id"
    with SessionLocal() as db:
        receipt = db.scalar(select(IngestionReceipt))
        assert receipt is not None
        receipt.id = legacy_id
        receipt.result = {
            **receipt.result,
            "projection": {"count": 0, "method": "pending"},
        }
        db.commit()

    import app.services.ingestion as ingestion_service

    monkeypatch.setattr(
        ingestion_service,
        "refresh_projection",
        lambda _user_id: {"count": 43, "method": "test-resumed"},
    )
    replay = client.post("/api/ingest/json", json=seed_payload, headers=_headers(key))
    assert replay.status_code == 200, replay.text
    with SessionLocal() as db:
        receipt = db.get(IngestionReceipt, legacy_id)
        assert receipt is not None
        assert receipt.result["projection"]["method"] == "test-resumed"


def test_ingest_requires_json_content_type_and_configured_auth(
    client,
    seed_payload,
    monkeypatch,
):
    raw = json.dumps(seed_payload, ensure_ascii=False).encode("utf-8")
    wrong_type = client.post(
        "/api/ingest/json",
        content=raw,
        headers={**_headers("haru-wrong-type"), "Content-Type": "text/plain"},
    )
    assert wrong_type.status_code == 415

    monkeypatch.setattr(settings, "rag_api_token", None)
    unavailable = client.post(
        "/api/ingest/json",
        content=raw,
        headers={"Content-Type": "application/json"},
    )
    assert unavailable.status_code == 503


def test_async_ingest_route_offloads_sync_pipeline(client, seed_payload, monkeypatch):
    import app.api.routes as routes

    calls: list[str] = []

    async def recording_threadpool(function, *args, **kwargs):
        calls.append(function.__name__)
        return function(*args, **kwargs)

    monkeypatch.setattr(routes, "run_in_threadpool", recording_threadpool)
    response = client.post(
        "/api/ingest/json",
        json=_small_payload(seed_payload),
        headers=_headers("haru-threadpool"),
    )
    assert response.status_code == 200, response.text
    assert calls == ["ingest_payload"]


def test_sensitive_entities_are_never_distractors(client, seed_payload):
    response = client.post(
        "/api/ingest/json",
        json=seed_payload,
        headers=_headers("haru-sensitive-distractor"),
    )
    assert response.status_code == 200, response.text
    secret = "민감한 비밀 인물"
    with SessionLocal() as db:
        db.add(
            Entity(
                id="ENT-sensitive-distractor",
                user_id=USER,
                entity_type="인물",
                value=secret,
                canonical_value=secret,
                first_seen_at="2026-07-20",
                last_seen_at="2026-07-20",
                sensitive=True,
            )
        )
        db.commit()
        choices = _distractors(db, USER, "인물", "정답 인물", limit=100)
    assert secret not in choices
