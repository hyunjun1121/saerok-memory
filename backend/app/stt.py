"""Qwen3-ASR transformers engine for final Korean transcription.

One model and one forced aligner stay resident on the local RTX 3090.  Input
audio is final, conditioned 16 kHz mono PCM; Qwen word timestamps are mapped to
the existing Haru segment contract.  Qwen does not expose a calibrated
confidence value, so the API deliberately returns ``confidence: null``.
"""
from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import Any

import numpy as np

from .audio import (
    TARGET_SAMPLE_RATE,
    decode_audio,
    duration_seconds,
    has_speech_activity,
)
from .config import Settings, torch_device_count


log = logging.getLogger("haru.stt")
ENGINE_NAME = "qwen3-asr"
PREPROCESSING_VERSION = "haru-dc-hp80-rms-v2"
_WARMUP_SAMPLES = TARGET_SAMPLE_RATE


def _require_checkpoint(path: Path, label: str, expected_revision: str) -> None:
    if not path.is_dir():
        raise FileNotFoundError(f"{label} checkpoint directory not found: {path}")
    if not (path / "config.json").is_file():
        raise FileNotFoundError(f"{label} checkpoint config.json not found: {path}")
    metadata_path = path / ".cache" / "huggingface" / "download" / "config.json.metadata"
    if not metadata_path.is_file():
        log.warning("%s checkpoint revision metadata unavailable: %s", label, path)
        return
    metadata_lines = metadata_path.read_text(encoding="utf-8").splitlines()
    if not metadata_lines:
        raise RuntimeError(f"{label} checkpoint revision metadata is empty: {path}")
    actual_revision = metadata_lines[0].strip()
    if actual_revision != expected_revision:
        raise RuntimeError(
            f"{label} checkpoint revision mismatch: expected={expected_revision} "
            f"actual={actual_revision}"
        )


class STTEngine:
    """Thin, thread-safe wrapper around a Qwen3ASRModel singleton."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._model: Any = None
        self._cuda_devices = torch_device_count()
        self._inference_lock = threading.Lock()

    @property
    def cuda_devices(self) -> int:
        return self._cuda_devices

    @property
    def is_ready(self) -> bool:
        return self._model is not None

    def _load_model(self) -> Any:
        """Load only the two local, revision-pinned checkpoint directories."""
        s = self.settings
        _require_checkpoint(s.model_path, "ASR", s.model_revision)
        if s.return_timestamps:
            _require_checkpoint(s.aligner_path, "forced aligner", s.aligner_revision)

        import torch
        from qwen_asr import Qwen3ASRModel

        try:
            dtype = getattr(torch, s.dtype)
        except AttributeError as exc:
            raise ValueError(f"unsupported torch dtype: {s.dtype}") from exc

        aligner_path = str(s.aligner_path) if s.return_timestamps else None
        aligner_kwargs = (
            {"dtype": dtype, "device_map": s.device}
            if s.return_timestamps
            else None
        )
        return Qwen3ASRModel.from_pretrained(
            str(s.model_path),
            dtype=dtype,
            device_map=s.device,
            forced_aligner=aligner_path,
            forced_aligner_kwargs=aligner_kwargs,
            max_inference_batch_size=s.max_inference_batch_size,
            max_new_tokens=s.max_new_tokens,
        )

    def load(self) -> None:
        """Load and warm the model; any failure leaves the service not ready."""
        s = self.settings
        log.info(
            "loading model=%s revision=%s aligner=%s device=%s dtype=%s",
            s.model_id,
            s.model_revision,
            s.aligner_id if s.return_timestamps else "disabled",
            s.device,
            s.dtype,
        )
        self._model = None
        self._model = self._load_model()
        if not s.warmup:
            return
        try:
            self._transcribe(
                np.zeros(_WARMUP_SAMPLES, dtype=np.float32),
                bypass_no_speech_detection=True,
            )
            log.info("Qwen3-ASR warm-up complete")
        except Exception as exc:
            log.error("warm-up transcribe failed; marking not ready: %s", exc)
            self._model = None

    def transcribe_bytes(self, data: bytes) -> dict[str, Any]:
        audio = decode_audio(
            data,
            max_duration_seconds=self.settings.max_audio_duration_seconds,
        )
        return self._transcribe(audio)

    def _transcribe(
        self,
        audio: np.ndarray,
        *,
        bypass_no_speech_detection: bool = False,
    ) -> dict[str, Any]:
        if self._model is None:
            raise RuntimeError("model_not_loaded")

        s = self.settings
        audio_duration = round(duration_seconds(audio), 3)
        if not bypass_no_speech_detection and not has_speech_activity(audio):
            return {
                "text": "",
                "noSpeech": True,
                "language": s.output_language,
                "durationSec": audio_duration,
                "confidence": None,
                "segments": [],
                "engine": ENGINE_NAME,
                "model": s.model_id,
                "modelRevision": s.model_revision,
                "alignerModel": s.aligner_id if s.return_timestamps else None,
                "alignerRevision": s.aligner_revision if s.return_timestamps else None,
                "preprocessingVersion": PREPROCESSING_VERSION,
            }

        with self._inference_lock:
            results = self._model.transcribe(
                audio=(audio, TARGET_SAMPLE_RATE),
                language=s.language,
                return_time_stamps=s.return_timestamps,
            )
        if not isinstance(results, list) or len(results) != 1:
            raise RuntimeError("unexpected_qwen_result_count")

        result = results[0]
        text = str(getattr(result, "text", "") or "").strip()
        time_stamps = getattr(result, "time_stamps", None)
        items = list(time_stamps) if time_stamps is not None else []
        segments = []
        for index, item in enumerate(items):
            token_text = str(getattr(item, "text", "") or "").strip()
            start = max(0.0, float(getattr(item, "start_time", 0.0) or 0.0))
            end = max(start, float(getattr(item, "end_time", start) or start))
            segments.append(
                {
                    "id": index,
                    "start": round(start, 3),
                    "end": round(end, 3),
                    "text": token_text,
                }
            )

        return {
            "text": text,
            "noSpeech": False,
            "language": s.output_language,
            "durationSec": audio_duration,
            "confidence": None,
            "segments": segments,
            "engine": ENGINE_NAME,
            "model": s.model_id,
            "modelRevision": s.model_revision,
            "alignerModel": s.aligner_id if s.return_timestamps else None,
            "alignerRevision": s.aligner_revision if s.return_timestamps else None,
            "preprocessingVersion": PREPROCESSING_VERSION,
        }
