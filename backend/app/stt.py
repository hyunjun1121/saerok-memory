"""Microsoft MAI-Transcribe-2 client behind Haru's local STT gateway."""
from __future__ import annotations

import io
import json
import logging
import wave
from typing import Any

import numpy as np
import requests

from .audio import (
    TARGET_SAMPLE_RATE,
    decode_audio,
    duration_seconds,
    has_speech_activity,
)
from .config import Settings
from .windows_credentials import get_speech_api_key


log = logging.getLogger("haru.stt")
ENGINE_NAME = "microsoft-azure-speech"
PREPROCESSING_VERSION = "haru-dc-hp80-rms-v2"

SUPPORTED_LANGUAGES = {
    "ko-KR": ("Korean", "ko-KR"),
    "ja-JP": ("Japanese", "ja-JP"),
    "en-US": ("English", "en-US"),
}


def resolve_language(
    language_locale: str | None,
    *,
    default_language: str,
    default_output_language: str,
) -> tuple[str, str]:
    if language_locale is None:
        return default_language, default_output_language
    try:
        return SUPPORTED_LANGUAGES[language_locale]
    except KeyError as exc:
        raise ValueError("unsupported_language") from exc


class STTEngine:
    """Thin client for the Microsoft transcription resource configured in NexQ."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._api_key: str | None = None

    @property
    def cuda_devices(self) -> int:
        return 0

    @property
    def is_ready(self) -> bool:
        return self._api_key is not None

    def load(self) -> None:
        """Read the NexQ credential without making a startup API request."""
        self._api_key = get_speech_api_key()
        if not self._api_key:
            raise RuntimeError("microsoft_speech_api_key_missing")
        log.info("Microsoft STT credential available; model=%s", self.settings.model_id)

    def transcribe_bytes(
        self, data: bytes, *, language_locale: str | None = None
    ) -> dict[str, Any]:
        audio = decode_audio(
            data,
            max_duration_seconds=self.settings.max_audio_duration_seconds,
        )
        settings = self.settings
        _, output_language = resolve_language(
            language_locale,
            default_language=settings.language,
            default_output_language=settings.output_language,
        )
        audio_duration = round(duration_seconds(audio), 3)
        if not has_speech_activity(audio):
            return self._result("", output_language, audio_duration)
        if self._api_key is None:
            raise RuntimeError("microsoft_speech_api_key_missing")

        pcm = np.clip(audio, -1.0, 1.0)
        pcm_bytes = (pcm * 32767).astype("<i2").tobytes()
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(TARGET_SAMPLE_RATE)
            wav_file.writeframes(pcm_bytes)

        with requests.post(
            settings.endpoint,
            headers={
                "Ocp-Apim-Subscription-Key": self._api_key,
                "Accept": "application/json",
            },
            data={
                "definition": json.dumps(
                    {"enhancedMode": {"enabled": True, "model": settings.model_id}}
                )
            },
            files={"audio": ("recording.wav", wav_buffer.getvalue(), "audio/wav")},
            timeout=(10, 60),
        ) as response:
            if not response.ok:
                raise RuntimeError(f"microsoft_speech_http_{response.status_code}")
            try:
                result = response.json()
            except ValueError as exc:
                raise RuntimeError("microsoft_speech_invalid_response") from exc

        phrases = result.get("combinedPhrases", []) if isinstance(result, dict) else []
        text = " ".join(
            phrase["text"].strip()
            for phrase in phrases
            if isinstance(phrase, dict)
            and isinstance(phrase.get("text"), str)
            and phrase["text"].strip()
        )
        return self._result(text, output_language, audio_duration)

    def _result(
        self, text: str, language: str, audio_duration: float
    ) -> dict[str, Any]:
        segments = (
            [{"id": 0, "start": 0.0, "end": audio_duration, "text": text}]
            if text
            else []
        )
        return {
            "text": text,
            "noSpeech": not bool(text),
            "language": language,
            "durationSec": audio_duration,
            "confidence": None,
            "segments": segments,
            "engine": ENGINE_NAME,
            "model": self.settings.model_id,
            "modelRevision": self.settings.model_revision,
            "alignerModel": None,
            "alignerRevision": None,
            "preprocessingVersion": PREPROCESSING_VERSION,
        }
