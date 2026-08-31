from __future__ import annotations

import copy

from sqlalchemy import select

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.models import Episode, User
from app.services.extraction import transcript_requires_sensitive_handling


JP_USER = "JP-USER-0001"


def _headers(key: str) -> dict[str, str]:
    return {
        "Authorization": "Bearer test-local-token",
        "Idempotency-Key": key,
        "X-Haru-Content-Hash": key.removeprefix("haru-"),
    }


def _jp_payload() -> dict:
    return {
        "schema": {
            "name": "haru_kiosk_usage_record",
            "version": "2.0.0",
        },
        "dataset": {
            "dataset_id": "HARU-JP-USER-0001-WEEK-01",
            "market": "jp",
            "ui_locale": "ja-JP",
            "period": {"start": "2026-07-27", "end": "2026-08-02"},
        },
        "user": {
            "user_id": JP_USER,
            "display_name": "山田春子",
            "market": "jp",
            "ui_locale": "ja-JP",
            "registered_profile_fields": {
                "出身地": "北海道",
                "好きな食べ物": "うどん",
            },
            "consents": {
                "voice_recording": True,
                "stt_processing": True,
                "longitudinal_usage_storage": True,
                "personalized_question_use": True,
            },
        },
        "sessions": [
            {
                "session_id": "SES-20260727-JPUSER0001",
                "user_id": JP_USER,
                "session_date": "2026-07-27",
                "question_records": [
                    {
                        "question": {
                            "question_id": "JP-D1-Q01",
                            "response_type": "voice",
                            "prompt_text": "昨日の出来事を教えてください。",
                        },
                        "response": {
                            "response_id": "JP-D1-R01",
                            "input_mode": "voice",
                            "stt": {
                                "engine": "qwen3-asr",
                                "language": "ja-JP",
                                "transcript": (
                                    "田中和子さんと地域の交流センターで輪投げをして、"
                                    "うどんを食べました。"
                                ),
                                "confidence": None,
                            },
                            "derived_annotations": {
                                "status": "completed",
                                "items": [
                                    {"entity_type": "人物", "value": "田中和子さん"},
                                    {"entity_type": "場所", "value": "地域の交流センター"},
                                    {"entity_type": "活動", "value": "輪投げ"},
                                    {"entity_type": "食べ物", "value": "うどん"},
                                    {"entity_type": "購入品", "value": "1,000ウォン"},
                                    {"entity_type": "場所", "value": "儒城市場"},
                                ],
                            },
                        },
                    }
                ],
            }
        ],
    }


def test_japanese_context_is_persisted_and_localizes_evidence_qa_and_questions(
    client,
    auth_headers,
    monkeypatch,
):
    payload = _jp_payload()
    response = client.post(
        "/api/ingest/json",
        json=payload,
        headers=_headers("haru-jp-market-flow"),
    )
    assert response.status_code == 200, response.text
    assert response.json()["market"] == "jp"
    assert response.json()["locale"] == "ja-JP"

    with SessionLocal() as db:
        user = db.get(User, JP_USER)
        assert user is not None
        assert user.profile["market"] == "jp"
        assert user.profile["locale"] == "ja-JP"
        evidence_texts = list(
            db.scalars(
                select(Episode.evidence_text)
                .where(Episode.user_id == JP_USER)
                .order_by(Episode.response_type)
            )
        )
    assert any(text.startswith("初回登録情報:") for text in evidence_texts)
    assert any("質問:" in text and "音声回答:" in text for text in evidence_texts)
    assert all("문항:" not in text and "초기 등록 정보:" not in text for text in evidence_texts)

    galaxy = client.get(
        f"/api/users/{JP_USER}/galaxy",
        headers=auth_headers,
    )
    assert galaxy.status_code == 200
    profile_nodes = [
        node
        for node in galaxy.json()["nodes"]
        if node["response_type"] == "profile"
    ]
    assert profile_nodes[0]["label"] == "初回プロフィール"

    generated = client.post(
        f"/api/users/{JP_USER}/questions/generate",
        json={
            "target_date": "2026-07-28",
            "count": 10,
            "market": "jp",
            "locale": "ja-JP",
        },
        headers=auth_headers,
    )
    assert generated.status_code == 200, generated.text
    generated_body = generated.json()
    assert generated_body["market"] == "jp"
    assert generated_body["locale"] == "ja-JP"
    questions = generated_body["questions"]
    assert questions
    assert {question["prompt"] for question in questions} >= {
        "昨日、一緒に過ごした方はどなたでしたか？",
        "昨日、どこで過ごしましたか？",
        "昨日、何をして過ごしましたか？",
        "昨日、一緒に食べたものは何でしたか？",
    }
    rendered = str(questions)
    assert "ウォン" not in rendered
    assert "儒城市場" not in rendered
    assert not any("가" <= character <= "힣" for character in rendered)

    monkeypatch.setattr(settings, "qa_min_similarity", -1.0)
    qa = client.post(
        f"/api/users/{JP_USER}/qa",
        json={
            "question": "昨日は誰と過ごしましたか？",
            "top_k": 3,
            "market": "jp",
            "locale": "ja-JP",
        },
        headers=auth_headers,
    )
    assert qa.status_code == 200, qa.text
    qa_body = qa.json()
    assert qa_body["market"] == "jp"
    assert qa_body["locale"] == "ja-JP"
    assert qa_body["evidence"]
    assert "保存された回答" in qa_body["answer"]
    assert "臨床的な解釈ではありません" in qa_body["uncertainty"]


def test_ingest_rejects_invalid_or_mismatched_market_locale(client):
    missing_context = _jp_payload()
    for section in (missing_context["dataset"], missing_context["user"]):
        section.pop("market")
        section.pop("ui_locale")
    response = client.post(
        "/api/ingest/json",
        json=missing_context,
        headers=_headers("haru-v2-missing-context"),
    )
    assert response.status_code == 422

    wrong_pair = _jp_payload()
    wrong_pair["dataset"]["ui_locale"] = "ko-KR"
    response = client.post(
        "/api/ingest/json",
        json=wrong_pair,
        headers=_headers("haru-jp-invalid-pair"),
    )
    assert response.status_code == 422

    split_context = _jp_payload()
    split_context["user"]["market"] = "kr"
    split_context["user"]["ui_locale"] = "ko-KR"
    response = client.post(
        "/api/ingest/json",
        json=split_context,
        headers=_headers("haru-jp-split-context"),
    )
    assert response.status_code == 422


def test_existing_user_cannot_change_market_and_requests_must_match_profile(
    client,
    auth_headers,
):
    payload = _jp_payload()
    assert client.post(
        "/api/ingest/json",
        json=payload,
        headers=_headers("haru-jp-original-context"),
    ).status_code == 200

    changed = copy.deepcopy(payload)
    changed["dataset"]["dataset_id"] = "HARU-KR-USER-0001-WEEK-02"
    changed["dataset"]["market"] = "kr"
    changed["dataset"]["ui_locale"] = "ko-KR"
    changed["user"]["market"] = "kr"
    changed["user"]["ui_locale"] = "ko-KR"
    changed_response = client.post(
        "/api/ingest/json",
        json=changed,
        headers=_headers("haru-jp-market-switch"),
    )
    assert changed_response.status_code == 409
    assert changed_response.json()["detail"] == "market_locale_mismatch"

    for endpoint, body in (
        (
            f"/api/users/{JP_USER}/qa",
            {"question": "기록", "market": "kr", "locale": "ko-KR"},
        ),
        (
            f"/api/users/{JP_USER}/questions/generate",
            {
                "target_date": "2026-07-28",
                "market": "kr",
                "locale": "ko-KR",
            },
        ),
    ):
        response = client.post(endpoint, json=body, headers=auth_headers)
        assert response.status_code == 409
        assert response.json()["detail"] == "market_locale_mismatch"


def test_legacy_payload_and_requests_default_to_korean_context(
    client,
    seed_payload,
    auth_headers,
):
    response = client.post(
        "/api/ingest/json",
        json=seed_payload,
        headers=_headers("haru-legacy-korean-context"),
    )
    assert response.status_code == 200, response.text
    assert response.json()["market"] == "kr"
    assert response.json()["locale"] == "ko-KR"

    generated = client.post(
        "/api/users/USR-000001/questions/generate",
        json={"target_date": "2026-07-21", "count": 1},
        headers=auth_headers,
    )
    assert generated.status_code == 200
    assert generated.json()["market"] == "kr"
    assert generated.json()["locale"] == "ko-KR"


def test_japanese_contact_and_health_text_is_treated_as_sensitive():
    assert transcript_requires_sensitive_handling(
        "電話番号は090-1234-5678です。"
    ) is True
    assert transcript_requires_sensitive_handling(
        "病院で薬について相談しました。"
    ) is True
