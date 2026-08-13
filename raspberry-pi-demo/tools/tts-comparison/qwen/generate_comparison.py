"""Generate and validate one Japanese prompt with every Qwen3-TTS preset voice.

All writable paths stay below this script's directory. The existing Haru TTS
virtual environment and pinned Hugging Face snapshot are read-only inputs.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from typing import Any

import numpy as np
import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel


MODEL_ID = "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice"
MODEL_REVISION = "0c0e3051f131929182e2c023b9537f8b1c68adfe"
MODEL_URL = f"https://huggingface.co/{MODEL_ID}"
LICENSE = "Apache-2.0"
TEXT = "春子さん、今日の気分はいかがですか。"
LANGUAGE = "Japanese"
SEED = 20260811
TARGET_LUFS = -16.0
TARGET_TRUE_PEAK_DBTP = -1.0
OPUS_TRUE_PEAK_MAX_DBTP = -0.4
TARGET_SAMPLE_RATE = 24_000
OPUS_DECODE_SAMPLE_RATE = 48_000
SHORT_CLIP_MIN_LUFS = -18.0
SHORT_CLIP_MAX_LUFS = -14.0

VOICES = (
    ("Vivian", "vivian"),
    ("Serena", "serena"),
    ("Uncle_Fu", "uncle-fu"),
    ("Dylan", "dylan"),
    ("Eric", "eric"),
    ("Ryan", "ryan"),
    ("Aiden", "aiden"),
    ("Ono_Anna", "ono-anna"),
    ("Sohee", "sohee"),
)

HERE = Path(__file__).resolve().parent
AUDIO_DIR = HERE / "audio"
VERIFY_DIR = HERE / "verification"
RUNTIME_CACHE = HERE / ".runtime-cache"
EXISTING_TTS_DIR = HERE.parent.parent / "tts"
SNAPSHOT = (
    EXISTING_TTS_DIR
    / ".cache"
    / "huggingface"
    / "models--Qwen--Qwen3-TTS-12Hz-1.7B-CustomVoice"
    / "snapshots"
    / MODEL_REVISION
)


def require_executable(name: str) -> str:
    executable = shutil.which(name)
    if executable is None:
        raise RuntimeError(f"Required executable missing: {name}")
    return executable


def run(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, check=True, capture_output=True, text=True)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for block in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def normalize_ogg(ffmpeg: str, wav_path: Path, ogg_path: Path) -> None:
    # Keep exact parity with Haru's production narration pipeline. Short,
    # high-crest clips can measure below -16 LUFS when the -1 dBTP ceiling is
    # the binding constraint; preserve the model voice instead of compressing.
    filters = f"loudnorm=I={TARGET_LUFS}:TP={TARGET_TRUE_PEAK_DBTP}:LRA=7"
    run(
        [
            ffmpeg,
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(wav_path),
            "-af",
            filters,
            "-ac",
            "1",
            "-ar",
            str(TARGET_SAMPLE_RATE),
            "-c:a",
            "libopus",
            "-b:a",
            "48k",
            "-vbr",
            "on",
            "-compression_level",
            "10",
            str(ogg_path),
        ]
    )


def probe(ffprobe: str, path: Path) -> dict[str, Any]:
    result = run(
        [
            ffprobe,
            "-v",
            "error",
            "-select_streams",
            "a:0",
            "-show_entries",
            "stream=codec_name,sample_rate,channels,channel_layout,duration:format=duration,size",
            "-of",
            "json",
            str(path),
        ]
    )
    payload = json.loads(result.stdout)
    stream = payload["streams"][0]
    duration = stream.get("duration") or payload["format"]["duration"]
    return {
        "codec": stream["codec_name"],
        "sampleRateHz": int(stream["sample_rate"]),
        "channels": int(stream["channels"]),
        "channelLayout": stream.get("channel_layout"),
        "durationMs": round(float(duration) * 1000),
        "sizeBytes": int(payload["format"]["size"]),
    }


def measure_loudness(ffmpeg: str, path: Path) -> dict[str, float]:
    result = run(
        [
            ffmpeg,
            "-hide_banner",
            "-nostats",
            "-i",
            str(path),
            "-filter_complex",
            "ebur128=peak=true",
            "-f",
            "null",
            "NUL" if os.name == "nt" else "/dev/null",
        ]
    )
    integrated = re.findall(r"I:\s*(-?[0-9.]+) LUFS", result.stderr)
    true_peak = re.findall(r"Peak:\s*(-?[0-9.]+) dBFS", result.stderr)
    if not integrated or not true_peak:
        raise RuntimeError(f"Could not parse EBU R128 summary for {path.name}")
    return {"integratedLufs": float(integrated[-1]), "truePeakDbtp": float(true_peak[-1])}


def validate_probe(
    path: Path,
    metadata: dict[str, Any],
    *,
    codec: str,
    sample_rate_hz: int,
) -> None:
    errors = []
    if metadata["codec"] != codec:
        errors.append(f"codec={metadata['codec']} expected={codec}")
    if metadata["sampleRateHz"] != sample_rate_hz:
        errors.append(f"sampleRateHz={metadata['sampleRateHz']} expected={sample_rate_hz}")
    if metadata["channels"] != 1:
        errors.append(f"channels={metadata['channels']} expected=1")
    if metadata["durationMs"] <= 0:
        errors.append("durationMs must be positive")
    if metadata["sizeBytes"] <= 0:
        errors.append("sizeBytes must be positive")
    if errors:
        raise RuntimeError(f"Invalid {path.name}: {'; '.join(errors)}")


def main() -> int:
    if not SNAPSHOT.is_dir():
        raise RuntimeError(f"Pinned local snapshot missing: {SNAPSHOT}")
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA unavailable")

    ffmpeg = require_executable("ffmpeg")
    ffprobe = require_executable("ffprobe")
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    for temporary_name in (
        "02-serena-test.ogg",
        "02-serena-g0.8.ogg",
        "02-serena-g1.0.ogg",
        "02-serena-g1.2.ogg",
        "03-uncle-fu-linear-test.ogg",
        "03-uncle-fu-limit-0.841395.ogg",
        "03-uncle-fu-limit-0.870964.ogg",
        "04-dylan-single-test.ogg",
    ):
        (AUDIO_DIR / temporary_name).unlink(missing_ok=True)
    VERIFY_DIR.mkdir(parents=True, exist_ok=True)
    RUNTIME_CACHE.mkdir(parents=True, exist_ok=True)
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    os.environ["HF_HOME"] = str(RUNTIME_CACHE / "huggingface")
    os.environ["TORCH_HOME"] = str(RUNTIME_CACHE / "torch")

    print(f"GPU: {torch.cuda.get_device_name(0)}", flush=True)
    print(f"Loading pinned snapshot: {SNAPSHOT}", flush=True)
    model = Qwen3TTSModel.from_pretrained(
        str(SNAPSHOT),
        device_map="cuda:0",
        dtype=torch.bfloat16,
        attn_implementation="sdpa",
        local_files_only=True,
    )
    runtime_speakers = model.get_supported_speakers()
    if runtime_speakers is None:
        raise RuntimeError("Runtime did not expose a finite speaker inventory")
    expected = {speaker.casefold() for speaker, _ in VOICES}
    actual = {speaker.casefold() for speaker in runtime_speakers}
    if actual != expected:
        raise RuntimeError(f"Speaker inventory mismatch: actual={runtime_speakers}")
    print(f"Runtime speakers ({len(runtime_speakers)}): {', '.join(runtime_speakers)}", flush=True)

    samples: list[dict[str, Any]] = []
    for index, (speaker, slug) in enumerate(VOICES, start=1):
        wav_path = AUDIO_DIR / f"{index:02d}-{slug}.wav"
        ogg_path = AUDIO_DIR / f"{index:02d}-{slug}.ogg"
        torch.manual_seed(SEED)
        torch.cuda.manual_seed_all(SEED)
        print(f"[{index}/{len(VOICES)}] Generating {speaker}", flush=True)
        wavs, sample_rate = model.generate_custom_voice(
            text=TEXT,
            language=LANGUAGE,
            speaker=speaker,
            instruct="",
        )
        if len(wavs) != 1:
            raise RuntimeError(f"{speaker}: expected one waveform, got {len(wavs)}")
        waveform = np.asarray(wavs[0], dtype=np.float32).squeeze()
        if waveform.ndim != 1:
            raise RuntimeError(f"{speaker}: unexpected waveform shape {waveform.shape}")
        if not np.all(np.isfinite(waveform)):
            raise RuntimeError(f"{speaker}: waveform contains NaN or infinity")
        if int(sample_rate) != TARGET_SAMPLE_RATE:
            raise RuntimeError(f"{speaker}: model sample rate {sample_rate}, expected {TARGET_SAMPLE_RATE}")
        sf.write(wav_path, waveform, sample_rate, subtype="PCM_16")
        normalize_ogg(ffmpeg, wav_path, ogg_path)
        loudness = measure_loudness(ffmpeg, ogg_path)

        wav_probe = probe(ffprobe, wav_path)
        ogg_probe = probe(ffprobe, ogg_path)
        validate_probe(
            wav_path,
            wav_probe,
            codec="pcm_s16le",
            sample_rate_hz=TARGET_SAMPLE_RATE,
        )
        # Opus always exposes a 48 kHz decode clock in ffprobe. Its source PCM
        # remains the model-native mono 24 kHz WAV passed to the encoder.
        validate_probe(
            ogg_path,
            ogg_probe,
            codec="opus",
            sample_rate_hz=OPUS_DECODE_SAMPLE_RATE,
        )
        loudness_within_short_clip_range = (
            SHORT_CLIP_MIN_LUFS
            <= loudness["integratedLufs"]
            <= SHORT_CLIP_MAX_LUFS
        )
        if not loudness_within_short_clip_range:
            print(
                f"[{index}/{len(VOICES)}] WARNING {speaker}: short-clip loudness "
                f"outside {SHORT_CLIP_MIN_LUFS}..{SHORT_CLIP_MAX_LUFS}: {loudness}",
                flush=True,
            )
        if loudness["truePeakDbtp"] > OPUS_TRUE_PEAK_MAX_DBTP:
            raise RuntimeError(f"{speaker}: true peak exceeds ceiling: {loudness}")

        verification = {
            "speaker": speaker,
            "text": TEXT,
            "language": LANGUAGE,
            "seed": SEED,
            "loudnessWithinShortClipRange": loudness_within_short_clip_range,
            "wav": {"path": f"audio/{wav_path.name}", "sha256": sha256_file(wav_path), **wav_probe},
            "ogg": {
                "path": f"audio/{ogg_path.name}",
                "sha256": sha256_file(ogg_path),
                **ogg_probe,
                **loudness,
            },
        }
        (VERIFY_DIR / f"{index:02d}-{slug}.json").write_text(
            json.dumps(verification, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        samples.append(verification)
        print(
            f"[{index}/{len(VOICES)}] {speaker}: {ogg_probe['durationMs']} ms, "
            f"{loudness['integratedLufs']:.1f} LUFS, {loudness['truePeakDbtp']:.1f} dBTP",
            flush=True,
        )

    manifest = {
        "schemaVersion": 1,
        "method": "qwen",
        "model": {
            "id": MODEL_ID,
            "revision": MODEL_REVISION,
            "license": LICENSE,
            "sourceUrl": MODEL_URL,
        },
        "prompt": {"text": TEXT, "language": LANGUAGE},
        "generation": {"seed": SEED, "instruct": "", "attention": "sdpa", "dtype": "bfloat16"},
        "normalization": {
            "integratedLufs": TARGET_LUFS,
            "truePeakDbtp": TARGET_TRUE_PEAK_DBTP,
            "channels": 1,
            "sourceSampleRateHz": TARGET_SAMPLE_RATE,
            "sampleRateHz": OPUS_DECODE_SAMPLE_RATE,
            "codec": "opus",
            "container": "ogg",
        },
        "samples": samples,
    }
    (HERE / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    method = {
        "id": "qwen",
        "name": "Qwen3-TTS CustomVoice preset comparison",
        "model": {
            "id": MODEL_ID,
            "revision": MODEL_REVISION,
            "license": LICENSE,
            "sourceUrl": MODEL_URL,
        },
        "voiceInventory": {
            "kind": "finite",
            "total": len(VOICES),
            "selectionRationale": "Official model inventory contains 9 preset speakers, so all 9 were generated.",
        },
        "reportPath": "qwen/REPORT.md",
        "samples": [
            {
                "id": f"qwen-{sample['speaker'].lower().replace('_', '-')}",
                "voice": sample["speaker"],
                "label": sample["speaker"],
                "path": f"qwen/{sample['ogg']['path']}",
                "sha256": sample["ogg"]["sha256"],
                "durationMs": sample["ogg"]["durationMs"],
                "codec": sample["ogg"]["codec"],
                "container": "ogg",
                "channels": sample["ogg"]["channels"],
                "sampleRateHz": sample["ogg"]["sampleRateHz"],
                "sourceSampleRateHz": sample["wav"]["sampleRateHz"],
                **(
                    {
                        "normalizationException": (
                            "Production single loudnorm was applied; measured "
                            f"{sample['ogg']['integratedLufs']:.1f} LUFS / "
                            f"{sample['ogg']['truePeakDbtp']:.1f} dBTP. Source WAV passed "
                            "finite-value and PCM format checks; short high-crest speech made "
                            "the true-peak ceiling binding. No manual gain or extra compression."
                        ),
                        "note": (
                            "생산용 단일 loudnorm을 적용했으나 짧고 피크가 큰 발화 특성으로 "
                            f"{sample['ogg']['integratedLufs']:.1f} LUFS가 측정됨. "
                            "원본 WAV는 정상이며 수동 gain·추가 압축은 적용하지 않음."
                        ),
                    }
                    if not sample["loudnessWithinShortClipRange"]
                    else {}
                ),
            }
            for sample in samples
        ],
    }
    (HERE / "method.json").write_text(
        json.dumps(method, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Completed {len(samples)} voices. Manifest: {HERE / 'manifest.json'}", flush=True)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, subprocess.CalledProcessError) as error:
        print(f"Generation failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
