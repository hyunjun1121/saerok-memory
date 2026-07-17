"""HTTP contract tests with the Qwen engine monkeypatched (no model/GPU)."""
from __future__ import annotations

import asyncio
import concurrent.futures
import contextlib
import threading
import time
from dataclasses import replace

import httpx
import pytest
from fastapi.testclient import TestClient

import app.main as main_module
from app.audio import AudioDurationExceeded
from app.config import get_settings
from app.stt import PREPROCESSING_VERSION, STTEngine


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
        "preprocessingVersion": PREPROCESSING_VERSION,
    }


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(STTEngine, "load", lambda self: None)
    monkeypatch.setattr(main_module.engine, "_model", object())
    with TestClient(main_module.app) as test_client:
        _wait_for_lifecycle(test_client, "ready")
        yield test_client


@pytest.fixture
def not_ready_client(monkeypatch):
    monkeypatch.setattr(STTEngine, "load", lambda self: None)
    monkeypatch.setattr(main_module.engine, "_model", None)
    with TestClient(main_module.app) as test_client:
        _wait_for_lifecycle(test_client, "failed")
        yield test_client


def _upload_bytes(data: bytes):
    return {"file": ("story.webm", data, "audio/webm")}


def _wait_for_lifecycle(client: TestClient, expected: str) -> None:
    deadline = time.monotonic() + 2
    while time.monotonic() < deadline:
        if client.get("/health").json()["lifecycle"] == expected:
            return
        time.sleep(0.01)
    raise AssertionError(
        f"lifecycle never reached {expected}: "
        f"{client.get('/health').json()['lifecycle']}"
    )


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


def test_local_network_safety_defaults(monkeypatch):
    monkeypatch.delenv("STT_HOST", raising=False)
    monkeypatch.delenv("STT_CORS_ORIGINS", raising=False)

    settings = get_settings()

    assert settings.host == "127.0.0.1"
    assert settings.cors_origins == [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:4173",
        "http://localhost:4173",
    ]


def test_create_app_keeps_engine_and_lifecycle_state_isolated(monkeypatch):
    class FakeEngine:
        cuda_devices = 0

        def __init__(self, ready: bool) -> None:
            self.is_ready = ready
            self.load_calls = 0

        def load(self) -> None:
            self.load_calls += 1

    ready_engine = FakeEngine(True)
    failed_engine = FakeEngine(False)
    ready_app = main_module.create_app(settings=get_settings(), engine=ready_engine)
    failed_app = main_module.create_app(settings=get_settings(), engine=failed_engine)

    with TestClient(ready_app) as ready_client, TestClient(failed_app) as failed_client:
        _wait_for_lifecycle(ready_client, "ready")
        _wait_for_lifecycle(failed_client, "failed")
        assert ready_client.get("/health").json()["lifecycle"] == "ready"
        assert failed_client.get("/health").json()["lifecycle"] == "failed"
        assert ready_app.state.engine is ready_engine
        assert failed_app.state.engine is failed_engine

    assert ready_engine.load_calls == 1
    assert failed_engine.load_calls == 1
    assert ready_app.state.lifecycle == "draining"
    assert failed_app.state.lifecycle == "draining"


def test_health_observes_loading_while_model_load_runs_in_background():
    class SlowEngine:
        cuda_devices = 0

        def __init__(self) -> None:
            self.is_ready = False
            self.started = threading.Event()

        def load(self) -> None:
            # Model object can exist before warm-up completes. Health must still
            # report ready=false until lifecycle reaches ready.
            self.is_ready = True
            self.started.set()
            time.sleep(0.25)

    async def scenario() -> None:
        slow_engine = SlowEngine()
        application = main_module.create_app(
            settings=get_settings(), engine=slow_engine
        )
        lifespan = application.router.lifespan_context(application)
        started_at = time.monotonic()
        await lifespan.__aenter__()
        try:
            assert time.monotonic() - started_at < 0.1
            assert await asyncio.to_thread(slow_engine.started.wait, 1)
            transport = httpx.ASGITransport(app=application)
            async with httpx.AsyncClient(
                transport=transport, base_url="http://test"
            ) as async_client:
                response = await async_client.get("/health")
                assert response.status_code == 200
                assert response.json()["lifecycle"] == "loading"
                assert response.json()["ready"] is False
                deadline = time.monotonic() + 2
                while application.state.lifecycle == "loading":
                    assert time.monotonic() < deadline
                    await asyncio.sleep(0.01)
                assert application.state.lifecycle == "ready"
        finally:
            await lifespan.__aexit__(None, None, None)

    asyncio.run(scenario())


def test_busy_queue_returns_versioned_retryable_429(client):
    class AlwaysFullAdmission:
        def slot(self):
            from app.admission import AdmissionQueueFull

            raise AdmissionQueueFull(retry_after_seconds=3)

    client.app.state.admission = AlwaysFullAdmission()
    response = client.post("/api/stt", files=_upload_bytes(b"\x01"))

    assert response.status_code == 429
    assert response.headers["retry-after"] == "3"
    assert response.headers["x-request-id"]
    assert response.json()["detail"] == "busy"
    assert response.json()["error"] == {
        "version": "1.0.0",
        "code": "busy",
        "retryable": True,
        "requestId": response.headers["x-request-id"],
    }


def test_http_admission_runs_one_queues_two_and_rejects_fourth(
    client, monkeypatch
):
    inference_started = threading.Event()
    release_inference = threading.Event()

    def blocking_transcribe(data):
        inference_started.set()
        if not release_inference.wait(timeout=5):
            raise TimeoutError("test did not release inference")
        return _canned()

    monkeypatch.setattr(main_module.engine, "transcribe_bytes", blocking_transcribe)
    pool = concurrent.futures.ThreadPoolExecutor(max_workers=3)
    futures = [
        pool.submit(client.post, "/api/stt", files=_upload_bytes(bytes([index + 1])))
        for index in range(3)
    ]
    try:
        assert inference_started.wait(timeout=2)
        deadline = time.monotonic() + 2
        while client.app.state.admission.pending < 2 and time.monotonic() < deadline:
            time.sleep(0.01)
        assert client.app.state.admission.active == 1
        assert client.app.state.admission.pending == 2

        rejected = client.post("/api/stt", files=_upload_bytes(b"\x04"))
        assert rejected.status_code == 429
        assert rejected.headers["retry-after"] == "1"
    finally:
        release_inference.set()
        responses = [future.result(timeout=3) for future in futures]
        pool.shutdown(wait=True)

    assert [response.status_code for response in responses] == [200, 200, 200]


def test_content_length_is_rejected_before_upload_body_processing(client):
    oversized_envelope = main_module.settings.max_upload_bytes + (2 << 20)
    response = client.post(
        "/api/stt",
        files=_upload_bytes(b"\x01"),
        headers={"content-length": str(oversized_envelope)},
    )

    assert response.status_code == 413
    assert response.json()["detail"] == "audio_too_large"


def test_chunked_multipart_is_stopped_when_stream_crosses_envelope_limit():
    class ReadyEngine:
        cuda_devices = 0
        is_ready = True

        def __init__(self) -> None:
            self.transcribe_calls = 0

        def load(self) -> None:
            return None

        def transcribe_bytes(self, data):
            self.transcribe_calls += 1
            return _canned()

    async def scenario() -> None:
        ready_engine = ReadyEngine()
        settings = replace(get_settings(), max_upload_bytes=1024)
        application = main_module.create_app(
            settings=settings, engine=ready_engine
        )
        boundary = "haru-boundary"

        async def oversized_body():
            yield (
                f"--{boundary}\r\n"
                'Content-Disposition: form-data; name="file"; filename="story.webm"\r\n'
                "Content-Type: audio/webm\r\n\r\n"
            ).encode()
            for _ in range(9):
                yield b"x" * (128 * 1024)
            yield f"\r\n--{boundary}--\r\n".encode()

        async with application.router.lifespan_context(application):
            deadline = time.monotonic() + 2
            while application.state.lifecycle == "loading":
                assert time.monotonic() < deadline
                await asyncio.sleep(0.01)
            transport = httpx.ASGITransport(app=application)
            async with httpx.AsyncClient(
                transport=transport, base_url="http://test"
            ) as async_client:
                response = await async_client.post(
                    "/api/stt",
                    content=oversized_body(),
                    headers={
                        "content-type": f"multipart/form-data; boundary={boundary}"
                    },
                )

        assert response.status_code == 413
        assert response.json()["detail"] == "audio_too_large"
        assert ready_engine.transcribe_calls == 0

    asyncio.run(scenario())


def test_missing_file_uses_versioned_error_contract(client):
    response = client.post(
        "/api/stt",
        files={"other": ("story.webm", b"\x01", "audio/webm")},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "file_required"
    assert response.json()["error"]["version"] == "1.0.0"


def test_untrusted_browser_origin_is_rejected_before_inference(client):
    response = client.post(
        "/api/stt",
        files=_upload_bytes(b"\x01"),
        headers={"origin": "https://attacker.example"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "origin_not_allowed"


def test_cancelled_active_request_keeps_slot_until_executor_finishes():
    class BlockingEngine:
        cuda_devices = 0
        is_ready = True

        def __init__(self) -> None:
            self.started = threading.Event()
            self.release = threading.Event()

        def load(self) -> None:
            return None

        def transcribe_bytes(self, data):
            self.started.set()
            if not self.release.wait(timeout=5):
                raise TimeoutError("test did not release inference")
            return _canned()

    async def scenario() -> None:
        blocking_engine = BlockingEngine()
        application = main_module.create_app(
            settings=get_settings(), engine=blocking_engine
        )
        async with application.router.lifespan_context(application):
            deadline = time.monotonic() + 2
            while application.state.lifecycle == "loading":
                assert time.monotonic() < deadline
                await asyncio.sleep(0.01)
            assert application.state.lifecycle == "ready"
            transport = httpx.ASGITransport(app=application)
            async with httpx.AsyncClient(
                transport=transport, base_url="http://test"
            ) as async_client:
                request_task = asyncio.create_task(
                    async_client.post("/api/stt", files=_upload_bytes(b"\x01"))
                )
                assert await asyncio.to_thread(blocking_engine.started.wait, 2)
                assert application.state.admission.active == 1
                request_task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await request_task

                assert application.state.admission.active == 1
                blocking_engine.release.set()
                deadline = time.monotonic() + 2
                while application.state.admission.active:
                    assert time.monotonic() < deadline
                    await asyncio.sleep(0.01)
                assert application.state.admission.active == 0

    asyncio.run(scenario())


def test_cancelled_pending_request_never_reaches_executor():
    class CountingBlockingEngine:
        cuda_devices = 0
        is_ready = True

        def __init__(self) -> None:
            self.started = threading.Event()
            self.release = threading.Event()
            self.transcribe_calls = 0

        def load(self) -> None:
            return None

        def transcribe_bytes(self, data):
            self.transcribe_calls += 1
            self.started.set()
            if not self.release.wait(timeout=5):
                raise TimeoutError("test did not release inference")
            return _canned()

    async def scenario() -> None:
        blocking_engine = CountingBlockingEngine()
        application = main_module.create_app(
            settings=get_settings(), engine=blocking_engine
        )
        async with application.router.lifespan_context(application):
            deadline = time.monotonic() + 2
            while application.state.lifecycle == "loading":
                assert time.monotonic() < deadline
                await asyncio.sleep(0.01)
            transport = httpx.ASGITransport(app=application)
            async with httpx.AsyncClient(
                transport=transport, base_url="http://test"
            ) as async_client:
                active_request = asyncio.create_task(
                    async_client.post("/api/stt", files=_upload_bytes(b"\x01"))
                )
                assert await asyncio.to_thread(blocking_engine.started.wait, 2)
                pending_request = asyncio.create_task(
                    async_client.post("/api/stt", files=_upload_bytes(b"\x02"))
                )
                deadline = time.monotonic() + 2
                while application.state.admission.pending < 1:
                    assert time.monotonic() < deadline
                    await asyncio.sleep(0.01)

                pending_request.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await pending_request
                deadline = time.monotonic() + 2
                while application.state.admission.pending:
                    assert time.monotonic() < deadline
                    await asyncio.sleep(0.01)

                blocking_engine.release.set()
                response = await active_request
                deadline = time.monotonic() + 2
                while application.state.inference_tasks:
                    assert time.monotonic() < deadline
                    await asyncio.sleep(0.01)

        assert response.status_code == 200
        assert blocking_engine.transcribe_calls == 1

    asyncio.run(scenario())


def test_shutdown_waits_for_in_progress_model_load():
    class BlockingLoadEngine:
        cuda_devices = 0
        is_ready = False

        def __init__(self) -> None:
            self.started = threading.Event()
            self.release = threading.Event()

        def load(self) -> None:
            self.started.set()
            if not self.release.wait(timeout=5):
                raise TimeoutError("test did not release model load")
            self.is_ready = True

    async def scenario() -> None:
        blocking_engine = BlockingLoadEngine()
        application = main_module.create_app(
            settings=get_settings(), engine=blocking_engine
        )
        lifespan = application.router.lifespan_context(application)
        await lifespan.__aenter__()
        assert await asyncio.to_thread(blocking_engine.started.wait, 2)
        shutdown = asyncio.create_task(lifespan.__aexit__(None, None, None))
        await asyncio.sleep(0.05)
        try:
            assert application.state.lifecycle == "draining"
            assert shutdown.done() is False
        finally:
            blocking_engine.release.set()
        await asyncio.wait_for(shutdown, timeout=2)

    asyncio.run(scenario())


def test_shutdown_waits_for_detached_active_inference():
    class BlockingEngine:
        cuda_devices = 0
        is_ready = True

        def __init__(self) -> None:
            self.started = threading.Event()
            self.release = threading.Event()

        def load(self) -> None:
            return None

        def transcribe_bytes(self, data):
            self.started.set()
            if not self.release.wait(timeout=5):
                raise TimeoutError("test did not release inference")
            return _canned()

    async def scenario() -> None:
        blocking_engine = BlockingEngine()
        application = main_module.create_app(
            settings=get_settings(), engine=blocking_engine
        )
        lifespan = application.router.lifespan_context(application)
        await lifespan.__aenter__()
        deadline = time.monotonic() + 2
        while application.state.lifecycle == "loading":
            assert time.monotonic() < deadline
            await asyncio.sleep(0.01)
        transport = httpx.ASGITransport(app=application)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as async_client:
            request_task = asyncio.create_task(
                async_client.post("/api/stt", files=_upload_bytes(b"\x01"))
            )
            assert await asyncio.to_thread(blocking_engine.started.wait, 2)
            request_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await request_task

            shutdown = asyncio.create_task(lifespan.__aexit__(None, None, None))
            await asyncio.sleep(0.05)
            try:
                assert application.state.lifecycle == "draining"
                assert shutdown.done() is False
            finally:
                blocking_engine.release.set()
            await asyncio.wait_for(shutdown, timeout=2)

        assert application.state.admission.active == 0
        assert not application.state.inference_tasks

    asyncio.run(scenario())


def test_decoded_duration_limit_returns_permanent_413(client, monkeypatch):
    def raise_too_long(data):
        raise AudioDurationExceeded(max_duration_seconds=65.0)

    monkeypatch.setattr(main_module.engine, "transcribe_bytes", raise_too_long)
    response = client.post("/api/stt", files=_upload_bytes(b"\x01"))

    assert response.status_code == 413
    assert response.json()["detail"] == "audio_too_long"
    assert response.json()["error"]["code"] == "audio_too_long"
    assert response.json()["error"]["retryable"] is False
