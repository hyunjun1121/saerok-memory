"""FastAPI app for the local Haru Qwen3-ASR service.

The app factory keeps model, executor, admission queue, settings, and lifecycle
state on ``request.app.state``. A default ``app`` remains for Uvicorn and the
public HTTP contract remains compatible with existing SPA clients.
"""
from __future__ import annotations

import asyncio
import contextlib
import logging
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from .admission import AdmissionQueueFull, InferenceAdmission
from .audio import AudioDurationExceeded
from .config import Settings, get_settings
from .errors import ERROR_SCHEMA_VERSION, STTServiceError
from .schemas import HealthResponse, TranscribeResponse
from .stt import STTEngine
from .upload import read_multipart_audio, verify_browser_origin


logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
)
log = logging.getLogger("haru")

SERVICE_VERSION = "2.1.0"


def _request_id(request: Request) -> str:
    return str(getattr(request.state, "request_id", "") or uuid.uuid4().hex)


def create_app(
    *,
    settings: Settings | None = None,
    engine: STTEngine | Any | None = None,
) -> FastAPI:
    """Build an isolated STT app without loading or downloading model weights."""

    resolved_settings = settings or get_settings()
    resolved_engine = engine or STTEngine(resolved_settings)

    @contextlib.asynccontextmanager
    async def lifespan(application: FastAPI):
        application.state.settings = resolved_settings
        application.state.engine = resolved_engine
        application.state.lifecycle = "loading"
        application.state.executor = ThreadPoolExecutor(
            max_workers=1, thread_name_prefix="stt"
        )
        application.state.admission = InferenceAdmission(
            max_active=1,
            max_pending=resolved_settings.max_pending_requests,
            retry_after_seconds=resolved_settings.queue_retry_after_seconds,
        )
        # Gate request parsing separately from GPU admission. This bounds
        # multipart spooling/buffering to the same total active + pending
        # capacity without reserving the GPU slot during a slow upload.
        application.state.upload_admission = InferenceAdmission(
            max_active=1 + resolved_settings.max_pending_requests,
            max_pending=0,
            retry_after_seconds=resolved_settings.queue_retry_after_seconds,
        )
        application.state.inference_tasks = {}
        log.info(
            "starting Haru STT service (model=%s)", resolved_settings.model_id
        )

        async def load_engine() -> None:
            loop = asyncio.get_running_loop()
            try:
                await loop.run_in_executor(
                    application.state.executor, resolved_engine.load
                )
                next_lifecycle = (
                    "ready" if resolved_engine.is_ready else "failed"
                )
            except Exception as exc:  # health remains available on load failure
                next_lifecycle = "failed"
                log.exception(
                    "model load failed; serving in not-ready state: %s", exc
                )
            if application.state.lifecycle != "draining":
                application.state.lifecycle = next_lifecycle

        application.state.load_task = asyncio.create_task(load_engine())
        try:
            yield
        finally:
            application.state.lifecycle = "draining"
            load_task = application.state.load_task
            tracked = dict(application.state.inference_tasks)

            # Waiting jobs have not entered the executor and are safe to cancel.
            waiting = [
                task for task, started in tracked.items() if not started.is_set()
            ]
            for task in waiting:
                task.cancel()
            if waiting:
                await asyncio.gather(*waiting, return_exceptions=True)

            # Python cannot interrupt model loading or an already-running Qwen
            # thread. Drain those jobs before executor shutdown so lifecycle and
            # GPU admission never claim completion while work is still alive.
            draining = [
                task for task, started in tracked.items() if started.is_set()
            ]
            if not load_task.done():
                draining.append(load_task)
            if draining:
                await asyncio.gather(*draining, return_exceptions=True)
            application.state.executor.shutdown(wait=True, cancel_futures=True)

    application = FastAPI(
        title="Haru STT", version=SERVICE_VERSION, lifespan=lifespan
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=resolved_settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["accept", "content-type", "x-request-id", "x-haru-language"],
    )

    @application.middleware("http")
    async def request_identity(request: Request, call_next):
        supplied = request.headers.get("x-request-id", "").strip()
        request.state.request_id = supplied[:128] if supplied else uuid.uuid4().hex
        response = await call_next(request)
        response.headers["x-request-id"] = request.state.request_id
        return response

    @application.exception_handler(STTServiceError)
    async def service_error_handler(
        request: Request, exc: STTServiceError
    ) -> JSONResponse:
        request_id = _request_id(request)
        headers = {"x-request-id": request_id}
        if exc.retry_after_seconds is not None:
            headers["retry-after"] = str(exc.retry_after_seconds)
        return JSONResponse(
            status_code=exc.status_code,
            headers=headers,
            content={
                "detail": exc.code,
                "error": {
                    "version": ERROR_SCHEMA_VERSION,
                    "code": exc.code,
                    "retryable": exc.retryable,
                    "requestId": request_id,
                },
            },
        )

    @application.get("/")
    async def root():
        return {
            "service": "haru-stt",
            "version": SERVICE_VERSION,
            "endpoints": {"health": "/health", "transcribe": "POST /api/stt"},
        }

    @application.get("/health", response_model=HealthResponse)
    async def health(request: Request):
        state = request.app.state
        current_settings: Settings = state.settings
        current_engine = state.engine
        return HealthResponse(
            status="ok",
            service="haru-stt",
            engine="qwen3-asr",
            backend=current_settings.backend,
            model=current_settings.model_id,
            modelRevision=current_settings.model_revision,
            alignerModel=(
                current_settings.aligner_id
                if current_settings.return_timestamps
                else None
            ),
            alignerRevision=(
                current_settings.aligner_revision
                if current_settings.return_timestamps
                else None
            ),
            device=current_settings.device,
            dtype=current_settings.dtype,
            cuda_devices=current_engine.cuda_devices,
            ready=(state.lifecycle == "ready" and current_engine.is_ready),
            lifecycle=state.lifecycle,
        )

    def queue_error(exc: AdmissionQueueFull) -> STTServiceError:
        return STTServiceError(
            status_code=429,
            code="busy",
            retryable=True,
            retry_after_seconds=exc.retry_after_seconds,
        )

    async def transcribe_request(
        request: Request,
        raw: bytes,
        language_locale: str | None,
    ) -> dict[str, Any]:
        state = request.app.state
        if state.lifecycle != "ready":
            raise STTServiceError(
                status_code=503, code="model_not_loaded", retryable=True
            )
        executor_started = asyncio.Event()

        async def admitted_inference() -> dict[str, Any]:
            async with state.admission.slot():
                loop = asyncio.get_running_loop()
                if language_locale is None:
                    future = loop.run_in_executor(
                        state.executor, state.engine.transcribe_bytes, raw
                    )
                else:
                    future = loop.run_in_executor(
                        state.executor,
                        lambda: state.engine.transcribe_bytes(
                            raw, language_locale=language_locale
                        ),
                    )
                executor_started.set()
                return await future

        # The background task, not the HTTP request task, owns admission. If a
        # client disconnects after inference starts, Python cannot stop the
        # worker thread; the slot therefore remains occupied until it finishes.
        task = asyncio.create_task(admitted_inference())
        state.inference_tasks[task] = executor_started

        def consume_result(completed: asyncio.Task) -> None:
            state.inference_tasks.pop(completed, None)
            if not completed.cancelled():
                completed.exception()

        task.add_done_callback(consume_result)
        try:
            return await asyncio.shield(task)
        except asyncio.CancelledError:
            if not executor_started.is_set():
                # Still waiting for GPU admission: remove abandoned work before
                # it can reach the executor. Once submitted, Python cannot stop
                # the worker thread, so the task keeps ownership until finish.
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
            raise
        except AdmissionQueueFull as exc:
            raise queue_error(exc) from exc

    async def handle_transcribe(request: Request) -> TranscribeResponse:
        state = request.app.state
        current_settings: Settings = state.settings
        verify_browser_origin(request, current_settings)
        language_locale = request.headers.get("x-haru-language")
        if language_locale not in {None, "ko-KR", "ja-JP", "en-US"}:
            raise STTServiceError(
                status_code=422, code="unsupported_language", retryable=False
            )
        if state.lifecycle != "ready" or not state.engine.is_ready:
            raise STTServiceError(
                status_code=503, code="model_not_loaded", retryable=True
            )

        try:
            async with state.upload_admission.slot():
                # Parse only after admission. Starlette spools large file parts,
                # while bounded_stream enforces the complete multipart envelope.
                raw = await read_multipart_audio(request, current_settings)
                result = await transcribe_request(request, raw, language_locale)
        except AdmissionQueueFull as exc:
            raise queue_error(exc) from exc
        except AudioDurationExceeded as exc:
            log.warning("decoded audio exceeded duration cap: %s", exc)
            raise STTServiceError(
                status_code=413, code="audio_too_long", retryable=False
            ) from exc
        except STTServiceError:
            raise
        except ValueError as exc:
            log.warning("audio decode failed: %s", exc)
            raise STTServiceError(
                status_code=422, code="decode_failed", retryable=False
            ) from exc
        except Exception as exc:
            log.exception("transcribe failed")
            raise STTServiceError(
                status_code=500, code="transcribe_failed", retryable=True
            ) from exc
        try:
            return TranscribeResponse(**result)
        except ValidationError as exc:
            log.exception("invalid transcribe response")
            raise STTServiceError(
                status_code=500, code="transcribe_failed", retryable=True
            ) from exc

    @application.post("/api/stt", response_model=TranscribeResponse)
    async def transcribe(request: Request):
        return await handle_transcribe(request)

    @application.post(
        "/api/transcribe",
        response_model=TranscribeResponse,
        include_in_schema=False,
    )
    async def transcribe_alias(request: Request):
        return await handle_transcribe(request)

    return application


# Compatibility aliases for Uvicorn and tests. Route handlers use app.state,
# never these globals, so independently constructed apps cannot share runtime.
settings = get_settings()
engine = STTEngine(settings)
app = create_app(settings=settings, engine=engine)
