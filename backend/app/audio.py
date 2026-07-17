"""Decode and conservatively condition browser audio for Qwen3-ASR.

The output remains the same length as the decoded recording: pauses are never
trimmed.  Conditioning follows the supplied STT design: DC removal, an 80 Hz
high-pass, and bounded RMS normalization.
"""
from __future__ import annotations

import io
import math

import av
import numpy as np


TARGET_SAMPLE_RATE = 16000
HIGH_PASS_CUTOFF_HZ = 80.0
TARGET_RMS = 0.08
MAX_RMS_GAIN = 3.0
MIN_RMS_GAIN = 0.5
PEAK_LIMIT = 0.98
SILENCE_RMS_FLOOR = 1e-4

# Conservative whole-utterance activity gate. Thresholds intentionally sit well
# below ordinary close-mic speech so a soft older speaker and long pauses remain
# valid. The adaptive frame test rejects steady room noise; the low-level voiced
# fallback keeps continuous, softly spoken phrases from being mistaken for
# silence.
ACTIVITY_FRAME_MS = 30
ACTIVITY_HOP_MS = 10
ACTIVITY_PEAK_FLOOR = 5e-4
ACTIVITY_GLOBAL_RMS_FLOOR = 1e-4
ACTIVITY_FRAME_RMS_FLOOR = 5e-4
ACTIVITY_MIN_ACTIVE_MS = 120
ACTIVITY_NOISE_RATIO = 2.5
ACTIVITY_VOICED_RMS_FLOOR = 4e-4
ACTIVITY_VOICED_PEAK_FLOOR = 1e-3
ACTIVITY_MIN_ZCR = 0.005
ACTIVITY_MAX_ZCR = 0.35


def remove_dc(audio: np.ndarray) -> np.ndarray:
    """Remove constant offset without changing sample count."""
    signal = np.asarray(audio, dtype=np.float32)
    if signal.size == 0:
        return signal.copy()
    dc = float(np.mean(signal, dtype=np.float64))
    return (signal - dc).astype(np.float32, copy=False)


def high_pass_filter(
    audio: np.ndarray,
    sample_rate: int = TARGET_SAMPLE_RATE,
    cutoff_hz: float = HIGH_PASS_CUTOFF_HZ,
) -> np.ndarray:
    """First-order 80 Hz high-pass filter with no trimming or padding."""
    signal = np.asarray(audio, dtype=np.float32)
    if signal.size == 0:
        return signal.copy()
    if sample_rate <= 0 or cutoff_hz <= 0:
        raise ValueError("sample rate and cutoff must be positive")

    rc = 1.0 / (2.0 * math.pi * cutoff_hz)
    dt = 1.0 / float(sample_rate)
    alpha = rc / (rc + dt)
    output = np.empty_like(signal)
    output[0] = 0.0
    previous_input = float(signal[0])
    previous_output = 0.0
    for index in range(1, signal.size):
        current_input = float(signal[index])
        current_output = alpha * (
            previous_output + current_input - previous_input
        )
        output[index] = current_output
        previous_input = current_input
        previous_output = current_output
    return output


def normalize_rms(
    audio: np.ndarray,
    target_rms: float = TARGET_RMS,
    min_gain: float = MIN_RMS_GAIN,
    max_gain: float = MAX_RMS_GAIN,
    peak_limit: float = PEAK_LIMIT,
) -> np.ndarray:
    """Apply bounded RMS gain and a final peak guard.

    Very quiet input is left untouched instead of amplifying room noise.
    """
    signal = np.asarray(audio, dtype=np.float32)
    if signal.size == 0:
        return signal.copy()
    rms = float(np.sqrt(np.mean(np.square(signal, dtype=np.float64))))
    if not math.isfinite(rms) or rms < SILENCE_RMS_FLOOR:
        return signal.copy()
    gain = float(np.clip(target_rms / rms, min_gain, max_gain))
    output = signal * gain
    peak = float(np.max(np.abs(output)))
    if peak > peak_limit:
        output = output * (peak_limit / peak)
    return output.astype(np.float32, copy=False)


def preprocess_audio(audio: np.ndarray, sample_rate: int = TARGET_SAMPLE_RATE) -> np.ndarray:
    """Run the versioned Haru Qwen input conditioning pipeline."""
    conditioned = remove_dc(audio)
    conditioned = high_pass_filter(conditioned, sample_rate=sample_rate)
    return normalize_rms(conditioned)


def has_speech_activity(
    audio: np.ndarray,
    sample_rate: int = TARGET_SAMPLE_RATE,
) -> bool:
    """Conservatively detect whether a complete recording contains speech.

    This is not a trimming VAD: it never changes samples or removes pauses. It
    only rejects an entirely silent/steady-noise utterance before Qwen, avoiding
    language-model filler hallucinations on recordings with no spoken response.
    """
    if sample_rate <= 0:
        raise ValueError("sample rate must be positive")
    signal = np.asarray(audio, dtype=np.float32).reshape(-1)
    if signal.size == 0:
        return False
    signal = np.nan_to_num(signal, nan=0.0, posinf=0.0, neginf=0.0)
    peak = float(np.max(np.abs(signal)))
    global_rms = float(np.sqrt(np.mean(np.square(signal, dtype=np.float64))))
    if peak < ACTIVITY_PEAK_FLOOR or global_rms < ACTIVITY_GLOBAL_RMS_FLOOR:
        return False

    frame_size = max(1, int(sample_rate * ACTIVITY_FRAME_MS / 1000))
    hop_size = max(1, int(sample_rate * ACTIVITY_HOP_MS / 1000))
    frame_rms: list[float] = []
    if signal.size <= frame_size:
        frame_rms.append(global_rms)
    else:
        for start in range(0, signal.size - frame_size + 1, hop_size):
            frame = signal[start : start + frame_size]
            frame_rms.append(
                float(np.sqrt(np.mean(np.square(frame, dtype=np.float64))))
            )

    levels = np.asarray(frame_rms, dtype=np.float64)
    noise_floor = float(np.percentile(levels, 20))
    active_threshold = max(
        ACTIVITY_FRAME_RMS_FLOOR,
        noise_floor * ACTIVITY_NOISE_RATIO,
    )
    active_duration_ms = (
        int(np.count_nonzero(levels >= active_threshold)) * ACTIVITY_HOP_MS
    )
    if active_duration_ms >= ACTIVITY_MIN_ACTIVE_MS:
        return True

    # Continuous soft speech may have no low-energy frames for an adaptive SNR
    # estimate. A voice-band zero-crossing rate is a conservative fallback;
    # broadband steady noise normally exceeds this range.
    sign_changes = np.count_nonzero(signal[:-1] * signal[1:] < 0)
    zcr = float(sign_changes) / float(max(1, signal.size - 1))
    return (
        global_rms >= ACTIVITY_VOICED_RMS_FLOOR
        and peak >= ACTIVITY_VOICED_PEAK_FLOOR
        and ACTIVITY_MIN_ZCR <= zcr <= ACTIVITY_MAX_ZCR
    )


def decode_audio(data: bytes, target_sr: int = TARGET_SAMPLE_RATE) -> np.ndarray:
    """Decode any PyAV-supported audio bytes to conditioned mono float32."""
    if not data:
        raise ValueError("empty audio payload")

    container = av.open(io.BytesIO(data))
    resampler = av.AudioResampler(format="fltp", layout="mono", rate=target_sr)
    chunks: list[np.ndarray] = []
    try:
        for frame in container.decode(audio=0):
            for resampled in resampler.resample(frame):
                chunks.append(resampled.to_ndarray())
        for resampled in resampler.resample(None):
            chunks.append(resampled.to_ndarray())
    finally:
        container.close()

    if not chunks:
        raise ValueError("no audio frames decoded")

    audio = np.concatenate(chunks, axis=1)[0].astype(np.float32, copy=False)
    peak = float(np.max(np.abs(audio))) if audio.size else 0.0
    if peak > 1.0:
        audio = audio / peak
    return preprocess_audio(audio, sample_rate=target_sr)


def duration_seconds(audio: np.ndarray, sample_rate: int = TARGET_SAMPLE_RATE) -> float:
    return float(len(audio)) / float(sample_rate)
