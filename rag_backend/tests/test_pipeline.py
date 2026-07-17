from __future__ import annotations

import copy

from sqlalchemy import func, select

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
from app.services.query import semantic_search


USER = "USR-000001"


def ingest(client, payload, key="haru-fnv1a64-0000000000000001", token=True):
    headers = {
        "Idempotency-Key": key,
        "X-Haru-Content-Hash": key.removeprefix("haru-"),
    }
    if token:
        headers["Authorization"] = "Bearer test-local-token"
    return client.post("/api/ingest/json", json=payload, headers=headers)


def first_voice_record(payload):
    for session in payload["sessions"]:
        for record in session["question_records"]:
            if record["question"]["response_type"] == "voice":
                return session, record
    raise AssertionError("voice record missing")


def test_health_exposes_ready_model_and_revision(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["ready"] is True
    assert body["embedding"] == {
        "ready": True,
        "backend": "sentence_transformers",
        "model": "fake/e5",
        "revision": "test-revision",
        "checkpoint_revision": "test-revision",
        "dimension": 8,
        "model_path": str((__import__("pathlib").Path(__file__).parent / "fake-model").resolve()),
        "error": None,
    }


def test_ingests_all_response_types_and_replays_idempotently(
    client,
    seed_payload,
    isolated_database,
):
    response = ingest(client, seed_payload)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["questions_created"] == 42
    assert body["evidence_created"] == 43  # 42 responses + registered profile
    assert body["idempotent_replay"] is False

    with SessionLocal() as db:
        counts = dict(
            db.execute(
                select(Episode.response_type, func.count()).group_by(Episode.response_type)
            ).all()
        )
        assert counts == {
            "button_sequence": 2,
            "profile": 1,
            "single_choice": 33,
            "voice": 7,
        }
        linked_types = set(
            db.scalars(
                select(Episode.response_type)
                .join(EventEntity, EventEntity.episode_id == Episode.id)
                .distinct()
            )
        )
        assert linked_types == {"voice"}
        assert db.scalar(select(func.count()).select_from(IngestionReceipt)) == 1
        snapshot = db.scalar(select(CanonicalSnapshot))
        assert snapshot is not None
        assert snapshot.payload == seed_payload

    passage_calls = list(isolated_database[1].calls)
    assert len(passage_calls) == 43
    assert all(call.startswith("passage: ") for call in passage_calls)

    replay = ingest(client, seed_payload)
    assert replay.status_code == 200
    assert replay.json()["idempotent_replay"] is True
    assert isolated_database[1].calls == passage_calls

    snapshots = client.get(
        f"/api/users/{USER}/snapshots",
        headers={"Authorization": "Bearer test-local-token"},
    ).json()
    detail = client.get(
        f"/api/users/{USER}/snapshots/{snapshots[0]['snapshot_id']}",
        headers={"Authorization": "Bearer test-local-token"},
    )
    assert detail.status_code == 200
    assert detail.json()["payload"] == seed_payload


def test_same_body_new_receipt_keeps_one_immutable_snapshot(client, seed_payload):
    assert ingest(client, seed_payload, "haru-fnv1a64-snapshot-first").status_code == 200
    assert ingest(client, seed_payload, "haru-fnv1a64-snapshot-second").status_code == 200
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(IngestionReceipt)) == 2
        snapshots = list(db.scalars(select(CanonicalSnapshot)))
        assert len(snapshots) == 1
        assert snapshots[0].payload == seed_payload
        assert snapshots[0].content_hash_header == "fnv1a64-snapshot-first"


def test_partial_reset_snapshot_never_deletes_longitudinal_rows(client, seed_payload):
    assert ingest(client, seed_payload).status_code == 200
    partial = copy.deepcopy(seed_payload)
    first_record = partial["sessions"][0]["question_records"][0]
    first_record["response"] = None
    partial["sessions"] = [
        {**partial["sessions"][0], "question_records": [first_record]}
    ]
    response = ingest(client, partial, "haru-fnv1a64-partial-reset")
    assert response.status_code == 200, response.text
    assert response.json()["evidence_deleted"] == 0
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(QuestionRecord)) == 42
        assert db.scalar(select(func.count()).select_from(Episode)) == 43
        assert db.scalar(select(func.count()).select_from(CanonicalSnapshot)) == 2
        preserved = db.scalar(
            select(QuestionRecord).where(
                QuestionRecord.external_question_id
                == first_record["question"]["question_id"]
            )
        )
        assert preserved is not None
        assert isinstance(preserved.payload.get("response"), dict)


def test_rejects_idempotency_key_reuse_for_changed_payload(client, seed_payload):
    assert ingest(client, seed_payload).status_code == 200
    changed = copy.deepcopy(seed_payload)
    changed["user"]["display_name"] = "다른 이름"
    response = ingest(client, changed)
    assert response.status_code == 409


def test_missing_and_zero_confidence_never_become_one(client, seed_payload):
    session, record = first_voice_record(seed_payload)
    record["response"]["stt"]["confidence"] = None
    assert ingest(client, seed_payload, "haru-fnv1a64-0000000000000002").status_code == 200

    with SessionLocal() as db:
        episode = db.scalar(
            select(Episode).where(Episode.question_id == record["question"]["question_id"])
        )
        assert episode is not None
        episode_id = episode.id
        assert episode.confidence is None
        reasons = set(
            db.scalars(select(ReviewItem.reason).where(ReviewItem.episode_id == episode.id))
        )
        assert "missing_confidence" in reasons

    changed = copy.deepcopy(seed_payload)
    _, changed_record = first_voice_record(changed)
    changed_record["response"]["stt"]["engine"] = (
        "qwen3-asr:Qwen/Qwen3-ASR-1.7B@test-revision"
    )
    changed_record["response"]["stt"]["confidence"] = 0
    response = ingest(client, changed, "haru-fnv1a64-0000000000000003")
    assert response.status_code == 200, response.text
    with SessionLocal() as db:
        episode = db.scalar(select(Episode).where(Episode.id == episode_id))
        assert episode is not None
        assert episode.confidence == 0.0
        reasons = set(
            db.scalars(select(ReviewItem.reason).where(ReviewItem.episode_id == episode.id))
        )
        assert "low_confidence" in reasons
        assert "missing_confidence" not in reasons


def test_qwen_null_confidence_can_ground_reviewable_draft_question(
    client,
    seed_payload,
    auth_headers,
):
    _, record = first_voice_record(seed_payload)
    record["response"]["stt"]["engine"] = "qwen3-asr"
    record["response"]["stt"]["confidence"] = None
    assert ingest(client, seed_payload, "haru-fnv1a64-null-qwen-draft").status_code == 200

    response = client.post(
        f"/api/users/{USER}/questions/generate",
        json={"target_date": "2026-07-21", "count": 4},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    questions = response.json()["questions"]
    assert questions
    assert all(question["confidence"] is None for question in questions)
    assert all(question["safety"]["requires_review"] is True for question in questions)
    assert all(
        question["safety"]["review_reason"] == "confidence_unavailable"
        for question in questions
    )
    assert all("그 일와" not in question["prompt"] for question in questions)


def test_placeholder_stt_confidence_is_ignored_without_mutating_snapshot(
    client,
    seed_payload,
):
    canonical = copy.deepcopy(seed_payload)
    _, record = first_voice_record(seed_payload)
    assert record["response"]["stt"]["engine"] == "demo-stt-placeholder"
    assert record["response"]["stt"]["confidence"] == 0.91

    response = ingest(client, seed_payload, "haru-fnv1a64-placeholder-confidence")
    assert response.status_code == 200, response.text

    with SessionLocal() as db:
        episode = db.scalar(
            select(Episode).where(
                Episode.question_id == record["question"]["question_id"]
            )
        )
        assert episode is not None
        assert episode.confidence is None
        reasons = set(
            db.scalars(
                select(ReviewItem.reason).where(ReviewItem.episode_id == episode.id)
            )
        )
        assert "missing_confidence" in reasons
        snapshot = db.scalar(select(CanonicalSnapshot))
        assert snapshot is not None
        assert snapshot.payload == canonical
        snapshot_record = first_voice_record(snapshot.payload)[1]
        assert snapshot_record["response"]["stt"]["confidence"] == 0.91


def test_reingest_updates_evidence_and_removes_stale_links(client, seed_payload):
    assert ingest(client, seed_payload).status_code == 200
    _, record = first_voice_record(seed_payload)
    question_id = record["question"]["question_id"]
    with SessionLocal() as db:
        before = db.scalar(select(Episode).where(Episode.question_id == question_id))
        assert before is not None
        episode_id = before.id
        assert db.scalar(
            select(func.count()).select_from(EventEntity).where(
                EventEntity.episode_id == episode_id
            )
        ) > 0

    changed = copy.deepcopy(seed_payload)
    _, changed_record = first_voice_record(changed)
    changed_record["response"]["stt"]["transcript"] = "수정된 음성 기록입니다."
    changed_record["response"]["raw_user_utterance_transcript"] = "수정된 음성 기록입니다."
    changed_record["response"]["derived_annotations"] = {
        "status": "empty",
        "items": [],
        "note": "",
    }
    response = ingest(client, changed, "haru-fnv1a64-0000000000000004")
    assert response.status_code == 200, response.text

    with SessionLocal() as db:
        rows = list(db.scalars(select(Episode).where(Episode.question_id == question_id)))
        assert len(rows) == 1
        assert rows[0].id == episode_id
        assert rows[0].transcript == "수정된 음성 기록입니다."
        assert db.scalar(
            select(func.count()).select_from(EventEntity).where(
                EventEntity.episode_id == episode_id
            )
        ) == 0


def test_composite_ids_allow_same_external_ids_for_another_user(client, seed_payload):
    assert ingest(client, seed_payload).status_code == 200
    other = copy.deepcopy(seed_payload)
    other["user"]["user_id"] = "USR-000002"
    other["dataset"]["dataset_id"] = "HARU-DEMO-USER-002-WEEK-01"
    for session in other["sessions"]:
        session["user_id"] = "USR-000002"
    response = ingest(client, other, "haru-fnv1a64-0000000000000005")
    assert response.status_code == 200, response.text
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(User)) == 2
        assert db.scalar(select(func.count()).select_from(QuestionRecord)) == 84
        assert db.scalar(select(func.count()).select_from(Episode)) == 86
        ids = list(db.scalars(select(QuestionRecord.id)))
        assert len(ids) == len(set(ids))


def test_private_routes_require_local_token_and_cors_is_exact(client, seed_payload):
    assert ingest(client, seed_payload).status_code == 200
    assert client.get(f"/api/users/{USER}/timeline").status_code == 401
    assert client.get(
        f"/api/users/{USER}/timeline",
        headers={"X-Haru-Local-Token": "test-local-token"},
    ).status_code == 200

    allowed = client.options(
        "/api/ingest/json",
        headers={
            "Origin": "http://127.0.0.1:5173",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert allowed.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"
    denied = client.options(
        "/api/ingest/json",
        headers={
            "Origin": "https://attacker.example",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert "access-control-allow-origin" not in denied.headers


def test_qa_uses_query_embedding_and_returns_grounded_evidence(
    client,
    seed_payload,
    auth_headers,
    isolated_database,
):
    assert ingest(client, seed_payload).status_code == 200
    response = client.post(
        f"/api/users/{USER}/qa",
        json={"question": "시장 방문 기록", "top_k": 5},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["evidence"]
    assert isolated_database[1].calls[-1].startswith("query: ")


def test_qa_rejects_hits_below_conservative_similarity_threshold(
    client,
    seed_payload,
    auth_headers,
    monkeypatch,
):
    assert ingest(client, seed_payload).status_code == 200
    monkeypatch.setattr(settings, "qa_min_similarity", 1.0)
    response = client.post(
        f"/api/users/{USER}/qa",
        json={"question": "전혀 관련 없는 우주선 정비 기록", "top_k": 8},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["evidence"] == []
    assert body["minimum_similarity"] == 1.0
    assert body.get("time_range") is None


def test_unannotated_sensitive_transcript_is_default_excluded(
    client,
    seed_payload,
):
    _, record = first_voice_record(seed_payload)
    record["response"]["stt"]["transcript"] = "오늘 혈압약을 먹고 병원에 다녀왔어요."
    record["response"]["raw_user_utterance_transcript"] = "오늘 혈압약을 먹고 병원에 다녀왔어요."
    record["response"]["derived_annotations"] = {"status": "empty", "items": [], "note": ""}
    assert ingest(client, seed_payload, "haru-fnv1a64-sensitive-voice").status_code == 200
    with SessionLocal() as db:
        episode = db.scalar(
            select(Episode).where(Episode.question_id == record["question"]["question_id"])
        )
        assert episode is not None
        assert episode.sensitive is True
        episode_id = episode.id
    assert episode_id not in {
        episode.id
        for _, episode in semantic_search(USER, "혈압약 병원", top_k=100)
    }
    assert episode_id in {
        episode.id
        for _, episode in semantic_search(
            USER,
            "혈압약 병원",
            top_k=100,
            include_sensitive=True,
        )
    }


def test_invalid_period_session_date_and_target_date_return_422(
    client,
    seed_payload,
    auth_headers,
):
    reversed_period = copy.deepcopy(seed_payload)
    reversed_period["dataset"]["period"] = {
        "start": "2026-07-26",
        "end": "2026-07-20",
    }
    assert ingest(client, reversed_period, "haru-fnv1a64-bad-period").status_code == 422

    outside = copy.deepcopy(seed_payload)
    outside["sessions"][0]["session_date"] = "2026-07-19"
    assert ingest(client, outside, "haru-fnv1a64-bad-session-date").status_code == 422

    malformed = copy.deepcopy(seed_payload)
    malformed["sessions"][0]["session_date"] = "not-a-date"
    assert ingest(client, malformed, "haru-fnv1a64-malformed-date").status_code == 422

    generated = client.post(
        f"/api/users/{USER}/questions/generate",
        json={"target_date": "not-a-date", "count": 4},
        headers=auth_headers,
    )
    assert generated.status_code == 422


def test_replay_resumes_pending_projection_and_neo4j(
    client,
    seed_payload,
    monkeypatch,
):
    key = "haru-fnv1a64-resume-derived"
    assert ingest(client, seed_payload, key).status_code == 200
    with SessionLocal() as db:
        receipt = db.scalar(select(IngestionReceipt))
        assert receipt is not None
        receipt.result = {
            **receipt.result,
            "projection": {"count": 0, "method": "pending"},
            "neo4j_synced": False,
        }
        db.commit()

    calls = {"projection": 0, "neo4j": 0}

    def projection(_user_id):
        calls["projection"] += 1
        return {"count": 43, "method": "pca"}

    def neo4j(_user_id):
        calls["neo4j"] += 1
        return True

    import app.services.ingestion as ingestion_service

    monkeypatch.setattr(ingestion_service, "refresh_projection", projection)
    monkeypatch.setattr(ingestion_service, "sync_user_to_neo4j", neo4j)
    monkeypatch.setattr(settings, "neo4j_enabled", True)
    replay = ingest(client, seed_payload, key)
    assert replay.status_code == 200
    assert replay.json()["idempotent_replay"] is True
    assert replay.json()["projection"] == {"count": 43, "method": "pca"}
    assert replay.json()["neo4j_synced"] is True
    assert calls == {"projection": 1, "neo4j": 1}


def test_qa_accepts_start_date_period_without_rendering_blank_range(
    client,
    seed_payload,
    auth_headers,
):
    seed_payload["dataset"]["period"] = {
        "start_date": "2026-07-20",
        "end_date": "2026-07-26",
    }
    assert ingest(client, seed_payload).status_code == 200
    response = client.post(
        f"/api/users/{USER}/qa",
        json={"question": "초기 등록 정보", "top_k": 3},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["time_range"]["start"]
    assert "기간은 부터" not in body["answer"]


def test_delete_cascades_sqlite_rows(client, seed_payload, auth_headers):
    assert ingest(client, seed_payload).status_code == 200
    response = client.delete(f"/api/users/{USER}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["sqlite_deleted"] is True
    with SessionLocal() as db:
        for model in (
            User,
            QuestionRecord,
            Episode,
            Entity,
            EventEntity,
            ReviewItem,
            Projection,
            IngestionReceipt,
            CanonicalSnapshot,
        ):
            assert db.scalar(select(func.count()).select_from(model)) == 0


def test_delete_retries_neo4j_after_sqlite_user_is_already_absent(
    client,
    seed_payload,
    auth_headers,
    monkeypatch,
):
    assert ingest(client, seed_payload).status_code == 200
    import app.services.deletion as deletion_service

    outcomes = iter([False, True])
    calls: list[str] = []

    def delete_neo4j(user_id: str) -> bool:
        calls.append(user_id)
        return next(outcomes)

    monkeypatch.setattr(settings, "neo4j_enabled", True)
    monkeypatch.setattr(deletion_service, "delete_user_from_neo4j", delete_neo4j)
    first = client.delete(f"/api/users/{USER}", headers=auth_headers)
    assert first.status_code == 200
    assert first.json()["sqlite_user_existed"] is True
    assert first.json()["complete"] is False
    second = client.delete(f"/api/users/{USER}", headers=auth_headers)
    assert second.status_code == 200
    assert second.json()["sqlite_user_existed"] is False
    assert second.json()["neo4j_deleted"] is True
    assert second.json()["complete"] is True
    assert calls == [USER, USER]


def test_rejects_missing_consent(client, seed_payload):
    seed_payload["user"]["consents"]["longitudinal_usage_storage"] = False
    response = ingest(client, seed_payload)
    assert response.status_code == 403
