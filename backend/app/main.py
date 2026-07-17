"""FastAPI app for the local Haru Qwen3-ASR service.

Endpoints:
  GET  /                – service banner
  GET  /health          – readiness (local model loaded? CUDA? device/dtype)
  POST /api/stt         – transcribe an uploaded audio file (multipart "file")
  POST /api/transcribe  – alias (OpenAI-style path)

The blocking transcribe runs in a thread pool (run_in_executor) so the event
loop stays responsive. The service starts even if local checkpoints are missing
or the GPU runtime cannot load them: /health then reports
ready=false and /api/stt returns 503 until the model is available.
"""
from __future__ import annotations

import asyncio
import contextlib
import logging
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .schemas import HealthResponse, TranscribeResponse
from .stt import STTEngine

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
)
log = logging.getLogger("haru")

settings = get_settings()
engine = STTEngine(settings)


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("starting Haru STT service (model=%s)", settings.model_id)
    # One inference worker protects the single Qwen model + aligner in VRAM.
    # Created per-app so a test/client teardown never poisons another client.
    app.state.executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="stt")
    try:
        engine.load()
    except Exception as exc:  # don't crash the process — serve /health instead
        log.exception("model load failed; serving in not-ready state: %s", exc)
    app.state.engine = engine
    app.state.settings = settings
    try:
        yield
    finally:
        app.state.executor.shutdown(wait=False, cancel_futures=True)


app = FastAPI(title="Haru STT", version="2.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "service": "haru-stt",
        "version": "2.0.0",
        "endpoints": {"health": "/health", "transcribe": "POST /api/stt"},
    }


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        service="haru-stt",
        engine="qwen3-asr",
        backend=settings.backend,
        model=settings.model_id,
        modelRevision=settings.model_revision,
        alignerModel=settings.aligner_id if settings.return_timestamps else None,
        alignerRevision=(
            settings.aligner_revision if settings.return_timestamps else None
        ),
        device=settings.device,
        dtype=settings.dtype,
        cuda_devices=engine.cuda_devices,
        ready=engine.is_ready,
    )


async def _transcribe_request(request: Request, raw: bytes) -> dict:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        request.app.state.executor, engine.transcribe_bytes, raw
    )


@app.post("/api/stt", response_model=TranscribeResponse)
async def transcribe(request: Request, file: UploadFile = File(...)):
    if not engine.is_ready:
        raise HTTPException(status_code=503, detail="model_not_loaded")
    # Stream into a bounded buffer and reject the instant the limit is crossed,
    # so an oversized/malicious body is never fully buffered into RAM (OOM guard
    # for a process holding the Qwen model and aligner in VRAM).
    buf = bytearray()
    while True:
        chunk = await file.read(1 << 20)  # 1 MiB at a time
        if not chunk:
            break
        buf += chunk
        if len(buf) > settings.max_upload_bytes:
            raise HTTPException(status_code=413, detail="audio_too_large")
    raw = bytes(buf)
    if not raw:
        raise HTTPException(status_code=400, detail="empty_audio")
    try:
        result = await _transcribe_request(request, raw)
    except ValueError as exc:
        log.warning("audio decode failed: %s", exc)
        raise HTTPException(status_code=422, detail="decode_failed")
    except Exception:
        log.exception("transcribe failed")
        raise HTTPException(status_code=500, detail="transcribe_failed")
    return TranscribeResponse(**result)


# OpenAI-style alias (some clients prefer /audio/transcriptions naming).
@app.post("/api/transcribe", response_model=TranscribeResponse, include_in_schema=False)
async def transcribe_alias(request: Request, file: UploadFile = File(...)):
    return await transcribe(request=request, file=file)
