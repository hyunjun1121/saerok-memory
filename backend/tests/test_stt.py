"""Qwen adapter unit tests; all model objects are local fakes."""
from __future__ import annotations

import sys
import types
from dataclasses import replace

import numpy as np
import pytest

from app.config import get_settings
from app.stt import PREPROCESSING_VERSION, STTEngine


class FakeTimestamp:
    def __init__(self, text: str, start: float, end: float) -> None:
        self.text = text
        self.start_time = start
        self.end_time = end


class FakeTranscription:
    language = "Korean"
    text = "오늘 산책했어요."
    time_stamps = [
        FakeTimestamp("오늘", 0.1, 0.4),
        FakeTimestamp("산책했어요", 0.5, 1.2),
    ]


class FakeModel:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    def transcribe(self, **kwargs):
        self.calls.append(kwargs)
        return [FakeTranscription()]


def test_transcribe_maps_qwen_result_to_haru_contract():
    settings = replace(get_settings(), output_language="ko-KR")
    engine = STTEngine(settings)
    fake_model = FakeModel()
    engine._model = fake_model
    time = np.arange(32000, dtype=np.float32) / 16000
    audio = (0.02 * np.sin(2 * np.pi * 180.0 * time)).astype(np.float32)

    result = engine._transcribe(audio)

    assert fake_model.calls == [
        {
            "audio": (audio, 16000),
            "language": "Korean",
            "return_time_stamps": True,
        }
    ]
    assert result["text"] == "오늘 산책했어요."
    assert result["noSpeech"] is False
    assert result["language"] == "ko-KR"
    assert result["durationSec"] == 2.0
    assert result["confidence"] is None
    assert result["engine"] == "qwen3-asr"
    assert result["modelRevision"] == settings.model_revision
    assert result["segments"] == [
        {"id": 0, "start": 0.1, "end": 0.4, "text": "오늘"},
        {"id": 1, "start": 0.5, "end": 1.2, "text": "산책했어요"},
    ]
    assert result["preprocessingVersion"] == PREPROCESSING_VERSION


def test_transcribe_bytes_enforces_configured_decoded_duration_cap(monkeypatch):
    settings = replace(get_settings(), max_audio_duration_seconds=65.0)
    engine = STTEngine(settings)
    engine._model = object()
    captured: dict[str, float] = {}

    def fake_decode(data: bytes, *, max_duration_seconds: float):
        captured["max_duration_seconds"] = max_duration_seconds
        return np.zeros(16000, dtype=np.float32)

    monkeypatch.setattr("app.stt.decode_audio", fake_decode)
    monkeypatch.setattr(engine, "_transcribe", lambda audio: {"ok": True})

    assert engine.transcribe_bytes(b"audio") == {"ok": True}
    assert captured == {"max_duration_seconds": 65.0}


def test_no_speech_returns_explicit_empty_result_without_calling_qwen():
    settings = replace(get_settings(), output_language="ko-KR")
    engine = STTEngine(settings)
    fake_model = FakeModel()
    engine._model = fake_model

    result = engine._transcribe(np.zeros(16000 * 30, dtype=np.float32))

    assert fake_model.calls == []
    assert result["text"] == ""
    assert result["noSpeech"] is True
    assert result["segments"] == []
    assert result["durationSec"] == 30.0
    assert result["model"] == settings.model_id
    assert result["modelRevision"] == settings.model_revision


def test_load_uses_only_local_model_and_aligner_paths(tmp_path, monkeypatch):
    model_path = tmp_path / "asr"
    aligner_path = tmp_path / "aligner"
    model_path.mkdir()
    aligner_path.mkdir()
    (model_path / "config.json").write_text("{}", encoding="utf-8")
    (aligner_path / "config.json").write_text("{}", encoding="utf-8")
    settings = replace(
        get_settings(),
        model_path=model_path,
        aligner_path=aligner_path,
        device="cuda:0",
        dtype="bfloat16",
        warmup=False,
    )
    sentinel = object()
    captured: dict = {}

    class FakeQwenFactory:
        @staticmethod
        def from_pretrained(path, **kwargs):
            captured["path"] = path
            captured.update(kwargs)
            return sentinel

    fake_dtype = object()
    monkeypatch.setitem(sys.modules, "torch", types.SimpleNamespace(bfloat16=fake_dtype))
    monkeypatch.setitem(
        sys.modules,
        "qwen_asr",
        types.SimpleNamespace(Qwen3ASRModel=FakeQwenFactory),
    )

    engine = STTEngine(settings)
    engine.load()

    assert engine.is_ready is True
    assert captured["path"] == str(model_path)
    assert captured["dtype"] is fake_dtype
    assert captured["device_map"] == "cuda:0"
    assert captured["forced_aligner"] == str(aligner_path)
    assert captured["forced_aligner_kwargs"] == {
        "dtype": fake_dtype,
        "device_map": "cuda:0",
    }
    assert captured["max_inference_batch_size"] == 1
    assert captured["max_new_tokens"] == 256


def test_missing_local_checkpoint_fails_without_importing_qwen(tmp_path):
    settings = replace(
        get_settings(),
        model_path=tmp_path / "missing",
        warmup=False,
    )
    with pytest.raises(FileNotFoundError, match="ASR checkpoint"):
        STTEngine(settings)._load_model()


def test_checkpoint_revision_mismatch_fails_before_model_load(tmp_path):
    model_path = tmp_path / "asr"
    metadata_path = model_path / ".cache" / "huggingface" / "download"
    metadata_path.mkdir(parents=True)
    (model_path / "config.json").write_text("{}", encoding="utf-8")
    (metadata_path / "config.json.metadata").write_text(
        "wrong-revision\nblob\ntimestamp\n", encoding="utf-8"
    )
    settings = replace(
        get_settings(),
        model_path=model_path,
        return_timestamps=False,
        warmup=False,
    )
    with pytest.raises(RuntimeError, match="revision mismatch"):
        STTEngine(settings)._load_model()


def test_warmup_failure_marks_not_ready(monkeypatch):
    settings = replace(get_settings(), warmup=True)
    engine = STTEngine(settings)

    class BrokenModel:
        def transcribe(self, **kwargs):
            raise RuntimeError("CUDA warmup failed")

    monkeypatch.setattr(engine, "_load_model", lambda: BrokenModel())
    engine.load()
    assert engine.is_ready is False
