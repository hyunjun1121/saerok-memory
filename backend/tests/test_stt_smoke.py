"""Real Qwen3-ASR + forced-aligner smoke test, opt-in with STT_RUN_GPU=1."""
from __future__ import annotations

import io
import wave

import numpy as np
import pytest

from app.config import get_settings
from app.stt import STTEngine


pytestmark = pytest.mark.gpu


def test_engine_load_and_transcribe_silence():
    engine = STTEngine(get_settings())
    engine.load()
    assert engine.is_ready
    result = engine.transcribe_bytes(_wav_bytes(np.zeros(16000, dtype=np.float32)))
    assert result["text"] == ""
    assert result["noSpeech"] is True
    assert result["language"] == "ko-KR"
    assert result["durationSec"] >= 0.0
    assert result["confidence"] is None
    assert result["engine"] == "qwen3-asr"
    assert result["model"] == "Qwen/Qwen3-ASR-1.7B"
    assert result["segments"] == []


def _wav_bytes(pcm: np.ndarray, sample_rate: int = 16000) -> bytes:
    integers = (np.clip(pcm, -1.0, 1.0) * 32767).astype("<i2")
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(integers.tobytes())
    return buffer.getvalue()
