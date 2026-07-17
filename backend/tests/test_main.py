"""HTTP contract tests with the Qwen engine monkeypatched (no model/GPU)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import app.main as main_module
from app.stt import STTEngine


def _canned(text: str = "오늘 딸이랑 공원을 산책했어요.") -> dict:
    return {
        "text": text,
        "noSpeech": False,
        "language": "ko-KR",
        "durationSec": 4.2,
        "confidence": None,
        "segments": [{"id": 0, "start": 0.0, "end": 4.2, "text": text}],
        "engine": "qwen3-asr",
        "model": "Qwen/Qwen3-ASR-1.7B",
        "modelRevision": "7278e1e70fe206f11671096ffdd38061171dd6e5",
        "alignerModel": "Qwen/Qwen3-ForcedAligner-0.6B",
        "alignerRevision": "c7cbfc2048c462b0d63a45797104fc9db3ad62b7",
        "preprocessingVersion": "haru-dc-hp80-rms-v1",
    }


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(STTEngine, "load", lambda self: None)
    monkeypatch.setattr(main_module.engine, "_model", object())
    with TestClient(main_module.app) as test_client:
        yield test_client


@pytest.fixture
def not_ready_client(monkeypatch):
    monkeypatch.setattr(STTEngine, "load", lambda self: None)
    monkeypatch.setattr(main_module.engine, "_model", None)
    with TestClient(main_module.app) as test_client:
        yield test_client


def _upload_bytes(data: bytes):
    return {"file": ("story.webm", data, "audio/webm")}


def test_root_banner(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["service"] == "haru-stt"
    assert "/api/stt" in response.json()["endpoints"]["transcribe"]


def test_health_ready_exposes_pinned_qwen_runtime(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["ready"] is True
    assert body["engine"] == "qwen3-asr"
    assert body["backend"] == "transformers"
    assert body["model"] == "Qwen/Qwen3-ASR-1.7B"
    assert body["modelRevision"] == "7278e1e70fe206f11671096ffdd38061171dd6e5"
    assert body["device"] == "cpu" or body["device"].startswith("cuda")
    assert body["dtype"] in {"float32", "float16", "bfloat16"}


def test_health_not_ready(not_ready_client):
    response = not_ready_client.get("/health")
    assert response.status_code == 200
    assert response.json()["ready"] is False


def test_stt_503_when_not_ready(not_ready_client):
    response = not_ready_client.post("/api/stt", files=_upload_bytes(b"\x00\x00\x00"))
    assert response.status_code == 503


def test_stt_happy_path_returns_qwen_metadata_and_null_confidence(client, monkeypatch):
    canned = _canned()
    monkeypatch.setattr(main_module.engine, "transcribe_bytes", lambda data: canned)

    response = client.post("/api/stt", files=_upload_bytes(b"\x1a\x2b\x3c"))
    assert response.status_code == 200
    body = response.json()
    assert body == canned
    assert body["confidence"] is None


def test_stt_no_speech_is_an_explicit_empty_success(client, monkeypatch):
    canned = _canned("")
    canned["noSpeech"] = True
    canned["segments"] = []
    monkeypatch.setattr(main_module.engine, "transcribe_bytes", lambda data: canned)

    response = client.post("/api/stt", files=_upload_bytes(b"\x00\x00"))

    assert response.status_code == 200
    assert response.json()["noSpeech"] is True
    assert response.json()["text"] == ""
    assert response.json()["segments"] == []


def test_stt_empty_audio_400(client):
    response = client.post("/api/stt", files=_upload_bytes(b""))
    assert response.status_code == 400


def test_stt_decode_failure_422(client, monkeypatch):
    def raise_decode_failure(data):
        raise ValueError("no audio frames decoded")

    monkeypatch.setattr(main_module.engine, "transcribe_bytes", raise_decode_failure)
    response = client.post("/api/stt", files=_upload_bytes(b"\x00\x01"))
    assert response.status_code == 422
    assert "decode_failed" in response.json()["detail"]


def test_transcribe_alias_matches(client, monkeypatch):
    canned = _canned("안녕")
    monkeypatch.setattr(main_module.engine, "transcribe_bytes", lambda data: canned)
    response = client.post("/api/transcribe", files=_upload_bytes(b"\x09"))
    assert response.status_code == 200
    assert response.json()["text"] == "안녕"
    assert response.json()["engine"] == "qwen3-asr"


def test_cors_header_present(client):
    response = client.options(
        "/api/stt",
        headers={
            "Origin": "http://127.0.0.1:5173",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.status_code in (200, 204)
    assert response.headers.get("access-control-allow-origin") in {
        "*",
        "http://127.0.0.1:5173",
    }
