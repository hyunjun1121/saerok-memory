"""Configuration for the local Haru Qwen3-ASR service.

Model weights are deliberately loaded from pinned local directories.  The
service never downloads weights during startup; a missing checkpoint leaves
the readiness endpoint available with ``ready=false``.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MODEL_ID = "Qwen/Qwen3-ASR-1.7B"
DEFAULT_MODEL_REVISION = "7278e1e70fe206f11671096ffdd38061171dd6e5"
DEFAULT_ALIGNER_ID = "Qwen/Qwen3-ForcedAligner-0.6B"
DEFAULT_ALIGNER_REVISION = "c7cbfc2048c462b0d63a45797104fc9db3ad62b7"


def _truthy(value: str | None) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _load_dotenv() -> None:
    """Load backend/.env or cwd/.env without overriding real environment."""
    candidates = [BACKEND_ROOT / ".env", Path.cwd() / ".env"]
    for path in candidates:
        if not path.is_file():
            continue
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
        break


def torch_device_count() -> int:
    """Number of CUDA devices visible to PyTorch, or zero without PyTorch."""
    try:
        import torch

        return int(torch.cuda.device_count()) if torch.cuda.is_available() else 0
    except Exception:
        return 0


def _resolve_device(raw: str) -> str:
    value = raw.strip().lower()
    if value == "auto":
        return "cuda:0" if torch_device_count() > 0 else "cpu"
    if value == "cuda":
        return "cuda:0"
    return value


def _resolve_dtype(raw: str, device: str) -> str:
    value = raw.strip().lower()
    if value != "auto":
        return value
    if device.startswith("cuda"):
        try:
            import torch

            if torch.cuda.is_bf16_supported():
                return "bfloat16"
        except Exception:
            pass
        return "float16"
    return "float32"


def _resolve_model_path(raw: str | None, default_name: str) -> Path:
    path = Path(raw).expanduser() if raw else BACKEND_ROOT / "models" / default_name
    if not path.is_absolute():
        path = BACKEND_ROOT / path
    return path.resolve()


@dataclass(frozen=True)
class Settings:
    model_id: str
    model_revision: str
    model_path: Path
    aligner_id: str
    aligner_revision: str
    aligner_path: Path
    backend: str
    device: str
    dtype: str
    language: str
    output_language: str
    return_timestamps: bool
    max_inference_batch_size: int
    max_new_tokens: int
    warmup: bool
    host: str
    port: int
    max_audio_duration_seconds: float
    max_pending_requests: int
    queue_retry_after_seconds: int
    cors_origins: list[str] = field(
        default_factory=lambda: [
            "http://127.0.0.1:5173",
            "http://localhost:5173",
            "http://127.0.0.1:4173",
            "http://localhost:4173",
        ]
    )
    max_upload_bytes: int = 25 * 1024 * 1024


def get_settings() -> Settings:
    _load_dotenv()
    device = _resolve_device(os.getenv("STT_DEVICE", "auto"))
    dtype = _resolve_dtype(os.getenv("STT_DTYPE", "auto"), device)
    origins_raw = os.getenv(
        "STT_CORS_ORIGINS",
        "http://127.0.0.1:5173,http://localhost:5173,"
        "http://127.0.0.1:4173,http://localhost:4173",
    )
    origins = [origin.strip() for origin in origins_raw.split(",") if origin.strip()] or [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:4173",
        "http://localhost:4173",
    ]
    return Settings(
        model_id=os.getenv("STT_MODEL_ID", DEFAULT_MODEL_ID),
        model_revision=os.getenv("STT_MODEL_REVISION", DEFAULT_MODEL_REVISION),
        model_path=_resolve_model_path(os.getenv("STT_MODEL_PATH"), "Qwen3-ASR-1.7B"),
        aligner_id=os.getenv("STT_ALIGNER_ID", DEFAULT_ALIGNER_ID),
        aligner_revision=os.getenv("STT_ALIGNER_REVISION", DEFAULT_ALIGNER_REVISION),
        aligner_path=_resolve_model_path(
            os.getenv("STT_ALIGNER_PATH"), "Qwen3-ForcedAligner-0.6B"
        ),
        backend="transformers",
        device=device,
        dtype=dtype,
        language=os.getenv("STT_LANGUAGE", "Korean"),
        output_language=os.getenv("STT_OUTPUT_LANGUAGE", "ko-KR"),
        return_timestamps=_truthy(os.getenv("STT_RETURN_TIMESTAMPS", "true")),
        max_inference_batch_size=max(
            1, int(os.getenv("STT_MAX_INFERENCE_BATCH_SIZE", "1"))
        ),
        max_new_tokens=max(1, int(os.getenv("STT_MAX_NEW_TOKENS", "256"))),
        warmup=_truthy(os.getenv("STT_WARMUP", "true")),
        host=os.getenv("STT_HOST", "127.0.0.1"),
        port=int(os.getenv("STT_PORT", "8765")),
        max_audio_duration_seconds=max(
            0.1, float(os.getenv("STT_MAX_AUDIO_SECONDS", "65"))
        ),
        max_pending_requests=max(0, int(os.getenv("STT_MAX_PENDING_REQUESTS", "2"))),
        queue_retry_after_seconds=max(
            1, int(os.getenv("STT_QUEUE_RETRY_AFTER_SECONDS", "1"))
        ),
        cors_origins=origins,
        max_upload_bytes=int(os.getenv("STT_MAX_UPLOAD_MB", "25")) * 1024 * 1024,
    )
