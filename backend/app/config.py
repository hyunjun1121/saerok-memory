"""Configuration for Haru's local Microsoft Speech gateway."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SPEECH_ENDPOINT = (
    "https://mai-transcribe-2-mnb9227.cognitiveservices.azure.com/"
    "speechtotext/transcriptions:transcribe?api-version=2025-10-15"
)


def _load_dotenv() -> None:
    for path in (BACKEND_ROOT / ".env", Path.cwd() / ".env"):
        if not path.is_file():
            continue
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
        break


@dataclass(frozen=True)
class Settings:
    model_id: str
    model_revision: str
    endpoint: str
    backend: str
    device: str
    dtype: str
    language: str
    output_language: str
    return_timestamps: bool
    warmup: bool
    host: str
    port: int
    max_audio_duration_seconds: float
    max_pending_requests: int
    queue_retry_after_seconds: int
    cors_origins: list[str] = field(default_factory=list)
    max_upload_bytes: int = 25 * 1024 * 1024


def get_settings() -> Settings:
    _load_dotenv()
    origins_raw = os.getenv(
        "STT_CORS_ORIGINS",
        "http://127.0.0.1:5173,http://localhost:5173,"
        "http://127.0.0.1:4173,http://localhost:4173",
    )
    origins = [origin.strip() for origin in origins_raw.split(",") if origin.strip()]
    return Settings(
        model_id=os.getenv("STT_MODEL_ID", "MAI-Transcribe-2"),
        model_revision="2025-10-15",
        endpoint=os.getenv("STT_ENDPOINT", DEFAULT_SPEECH_ENDPOINT).strip(),
        backend="microsoft-azure-speech",
        device="remote",
        dtype="pcm_s16le_16000_mono",
        language="auto",
        output_language=os.getenv("STT_OUTPUT_LANGUAGE", "ko-KR"),
        return_timestamps=False,
        warmup=False,
        host=os.getenv("STT_HOST", "127.0.0.1"),
        port=int(os.getenv("STT_PORT", "8765")),
        max_audio_duration_seconds=max(0.1, float(os.getenv("STT_MAX_AUDIO_SECONDS", "65"))),
        max_pending_requests=max(0, int(os.getenv("STT_MAX_PENDING_REQUESTS", "2"))),
        queue_retry_after_seconds=max(1, int(os.getenv("STT_QUEUE_RETRY_AFTER_SECONDS", "1"))),
        cors_origins=origins or [
            "http://127.0.0.1:5173",
            "http://localhost:5173",
            "http://127.0.0.1:4173",
            "http://localhost:4173",
        ],
        max_upload_bytes=int(os.getenv("STT_MAX_UPLOAD_MB", "25")) * 1024 * 1024,
    )
