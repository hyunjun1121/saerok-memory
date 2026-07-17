"""Audio decode tests (no model, no GPU needed).

Round-trips a synthesized tone through PyAV encode -> decode_audio for the two
containers the client sends (wav and webm/opus), asserting the decoder yields
mono float32 at 16 kHz.
"""
from __future__ import annotations

import io
import struct
import wave

import av
import numpy as np
import pytest

from app.audio import (
    _frame_rms_levels,
    AudioDurationExceeded,
    TARGET_RMS,
    TARGET_SAMPLE_RATE,
    decode_audio,
    duration_seconds,
    has_speech_activity,
    high_pass_filter,
    normalize_rms,
    preprocess_audio,
    remove_dc,
)


def _tone(seconds: float = 1.0, sr: int = 16000, freq: float = 440.0) -> np.ndarray:
    n = int(sr * seconds)
    t = np.arange(n, dtype=np.float32) / sr
    return (0.3 * np.sin(2 * np.pi * freq * t)).astype(np.float32)


def _encode_wav(pcm: np.ndarray, sr: int = 16000) -> bytes:
    """Plain PCM wav via the stdlib — guaranteed decodable by PyAV."""
    ints = np.clip(pcm, -1.0, 1.0)
    ints = (ints * 32767).astype("<i2")
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sr)
        wav.writeframes(ints.tobytes())
    return buf.getvalue()


def _encode_webm_opus(pcm: np.ndarray, sr: int = 16000) -> bytes:
    """webm/opus container — what MediaRecorder produces in Chrome."""
    out = io.BytesIO()
    container = av.open(out, mode="w", format="webm")
    try:
        stream = container.add_stream("libopus", rate=sr, layout="mono")
    except Exception as exc:  # encoder missing in this PyAV build
        container.close()
        pytest.skip(f"libopus encoder unavailable: {exc}")

    ints = np.clip(pcm, -1.0, 1.0)
    ints = (ints * 32767).astype("<i2")
    frame_size = 1024
    for offset in range(0, len(ints), frame_size):
        chunk = ints[offset : offset + frame_size].reshape(1, -1)
        frame = av.AudioFrame.from_ndarray(chunk, format="s16", layout="mono")
        frame.sample_rate = sr
        for packet in stream.encode(frame):
            container.mux(packet)
    for packet in stream.encode():
        container.mux(packet)
    container.close()
    return out.getvalue()


def test_decode_empty_raises():
    with pytest.raises(ValueError):
        decode_audio(b"")


def test_decode_garbage_raises():
    with pytest.raises(Exception):
        decode_audio(b"not audio at all")


def test_decode_wav_roundtrip():
    pcm = _tone(1.0)
    decoded = decode_audio(_encode_wav(pcm))
    assert decoded.dtype == np.float32
    assert decoded.ndim == 1
    assert np.max(np.abs(decoded)) <= 1.0
    # 1s @ 16kHz -> ~16000 samples (wav is exact).
    assert abs(len(decoded) - TARGET_SAMPLE_RATE) <= 10


def test_decode_resamples_to_16k():
    # Encode a 1s clip at 8 kHz; decode_audio must resample up to 16 kHz.
    pcm8k = _tone(1.0, sr=8000)
    decoded = decode_audio(_encode_wav(pcm8k, sr=8000))
    assert decoded.dtype == np.float32
    assert abs(len(decoded) - TARGET_SAMPLE_RATE) <= 200  # ~16k after resample


def test_decode_webm_opus_roundtrip():
    pcm = _tone(1.0)
    decoded = decode_audio(_encode_webm_opus(pcm))
    assert decoded.dtype == np.float32
    assert decoded.ndim == 1
    assert np.max(np.abs(decoded)) <= 1.0
    # Opus frames at 16k for ~1s land close to 16000 samples.
    assert 14000 <= len(decoded) <= 18000


def test_decode_rejects_audio_longer_than_hard_duration_cap_without_trimming():
    pcm = _tone(65.1)
    with pytest.raises(AudioDurationExceeded) as caught:
        decode_audio(_encode_wav(pcm), max_duration_seconds=65.0)

    assert caught.value.max_duration_seconds == 65.0


def test_decode_accepts_audio_exactly_at_hard_duration_cap():
    pcm = _tone(65.0)
    decoded = decode_audio(_encode_wav(pcm), max_duration_seconds=65.0)

    assert len(decoded) == TARGET_SAMPLE_RATE * 65


def test_duration_seconds():
    pcm = np.zeros(TARGET_SAMPLE_RATE, dtype=np.float32)
    assert duration_seconds(pcm) == pytest.approx(1.0)


def test_remove_dc_centers_signal_without_changing_length():
    signal = _tone(0.2) + 0.2
    centered = remove_dc(signal)
    assert len(centered) == len(signal)
    assert float(np.mean(centered)) == pytest.approx(0.0, abs=1e-6)


def test_high_pass_attenuates_20hz_more_than_voice_band():
    low = _tone(1.0, freq=20.0)
    voice = _tone(1.0, freq=440.0)
    low_filtered = high_pass_filter(low)
    voice_filtered = high_pass_filter(voice)
    # Ignore the short IIR startup transient.
    start = TARGET_SAMPLE_RATE // 10
    low_rms = float(np.sqrt(np.mean(low_filtered[start:] ** 2)))
    voice_rms = float(np.sqrt(np.mean(voice_filtered[start:] ** 2)))
    assert low_rms < voice_rms * 0.4


def test_vectorized_high_pass_matches_reference_recurrence():
    rng = np.random.default_rng(19)
    signal = rng.normal(0.0, 0.05, TARGET_SAMPLE_RATE * 2).astype(np.float32)
    cutoff_hz = 80.0
    rc = 1.0 / (2.0 * np.pi * cutoff_hz)
    alpha = rc / (rc + (1.0 / TARGET_SAMPLE_RATE))
    expected = np.empty_like(signal)
    expected[0] = 0.0
    previous_input = float(signal[0])
    previous_output = 0.0
    for index in range(1, signal.size):
        current_input = float(signal[index])
        current_output = alpha * (
            previous_output + current_input - previous_input
        )
        expected[index] = current_output
        previous_input = current_input
        previous_output = current_output

    actual = high_pass_filter(signal)

    assert actual.dtype == np.float32
    assert np.max(np.abs(actual - expected)) < 1e-6


def test_rms_normalization_is_bounded_and_peak_safe():
    normalized = normalize_rms(_tone(1.0, freq=440.0) * 0.3)
    rms = float(np.sqrt(np.mean(normalized.astype(np.float64) ** 2)))
    assert rms == pytest.approx(TARGET_RMS, rel=0.03)
    assert float(np.max(np.abs(normalized))) <= 0.98


def test_preprocessing_preserves_pauses_and_sample_count():
    signal = np.concatenate(
        [_tone(0.2), np.zeros(TARGET_SAMPLE_RATE, dtype=np.float32), _tone(0.2)]
    )
    conditioned = preprocess_audio(signal)
    assert len(conditioned) == len(signal)
    # No VAD/trimming: the one-second middle pause remains present.
    middle = conditioned[4000:12000]
    assert float(np.max(np.abs(middle))) < 1e-3


def test_silence_is_not_amplified():
    silence = np.zeros(TARGET_SAMPLE_RATE, dtype=np.float32)
    assert np.array_equal(preprocess_audio(silence), silence)


def test_activity_gate_rejects_silence_and_steady_low_room_noise():
    silence = np.zeros(TARGET_SAMPLE_RATE * 2, dtype=np.float32)
    rng = np.random.default_rng(7)
    room_noise = preprocess_audio(
        rng.normal(0.0, 0.0003, TARGET_SAMPLE_RATE * 2).astype(np.float32)
    )

    assert has_speech_activity(silence) is False
    assert has_speech_activity(room_noise) is False


def test_vectorized_frame_rms_matches_reference_windows():
    rng = np.random.default_rng(23)
    signal = rng.normal(0.0, 0.02, TARGET_SAMPLE_RATE * 2).astype(np.float32)
    frame_size = int(TARGET_SAMPLE_RATE * 30 / 1000)
    hop_size = int(TARGET_SAMPLE_RATE * 10 / 1000)
    expected = []
    for start in range(0, signal.size - frame_size + 1, hop_size):
        frame = signal[start : start + frame_size]
        expected.append(float(np.sqrt(np.mean(np.square(frame, dtype=np.float64)))))

    actual = _frame_rms_levels(signal, sample_rate=TARGET_SAMPLE_RATE)

    assert actual.shape == (len(expected),)
    assert np.allclose(actual, expected, rtol=1e-12, atol=1e-12)


def test_activity_gate_keeps_very_soft_voiced_audio_and_pauses():
    seconds = 2.0
    sample_count = int(TARGET_SAMPLE_RATE * seconds)
    time = np.arange(sample_count, dtype=np.float32) / TARGET_SAMPLE_RATE
    envelope = np.zeros(sample_count, dtype=np.float32)
    envelope[int(0.35 * TARGET_SAMPLE_RATE) : int(1.15 * TARGET_SAMPLE_RATE)] = 1.0
    # Roughly -68 dBFS before the bounded gain: intentionally softer than an
    # ordinary close-mic speaker, with long pauses on both sides.
    soft_voice = 0.0004 * np.sin(2 * np.pi * 180.0 * time) * envelope

    assert has_speech_activity(preprocess_audio(soft_voice)) is True


def test_struct_roundtrip_smoke():
    # Sanity: the wav helper produces a real header (RIFF).
    assert _encode_wav(_tone(0.1))[:4] == b"RIFF"
