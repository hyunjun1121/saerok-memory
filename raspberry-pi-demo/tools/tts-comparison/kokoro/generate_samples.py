from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf
import torch
from huggingface_hub import hf_hub_download
from kokoro import KModel, KPipeline


ROOT = Path(__file__).resolve().parent
MODEL_DIR = ROOT / "model"
WAV_DIR = ROOT / "audio" / "wav"
RESULTS_PATH = ROOT / "generation_results.json"

REPO_ID = "hexgrad/Kokoro-82M"
REVISION = "f3ff3571791e39611d31c381e3a41a3af07b4987"
MODEL_SHA256 = "496dba118d1a58f5f3db2efc88dbdc216e0483fc89fe6e47ee1f2c53f18ad1e4"
TEXT = "春子さん、今日の気分はいかがですか。"
SOURCE_SAMPLE_RATE_HZ = 24_000
SPEED = 1.0

VOICE_SPECS = [
    {
        "id": "01_jf_alpha",
        "voice": "jf_alpha",
        "label": "JF Alpha — 日本語・女性",
        "gender": "female",
        "nativeJapanese": True,
        "officialGrade": "C+",
        "officialSha256Prefix": "1bf4c9dc",
    },
    {
        "id": "02_jf_gongitsune",
        "voice": "jf_gongitsune",
        "label": "JF Gongitsune — 日本語・女性",
        "gender": "female",
        "nativeJapanese": True,
        "officialGrade": "C",
        "officialSha256Prefix": "1b171917",
    },
    {
        "id": "03_jf_nezumi",
        "voice": "jf_nezumi",
        "label": "JF Nezumi — 日本語・女性",
        "gender": "female",
        "nativeJapanese": True,
        "officialGrade": "C-",
        "officialSha256Prefix": "d83f007a",
    },
    {
        "id": "04_jf_tebukuro",
        "voice": "jf_tebukuro",
        "label": "JF Tebukuro — 日本語・女性",
        "gender": "female",
        "nativeJapanese": True,
        "officialGrade": "C",
        "officialSha256Prefix": "0d691790",
    },
    {
        "id": "05_jm_kumo",
        "voice": "jm_kumo",
        "label": "JM Kumo — 日本語・男性",
        "gender": "male",
        "nativeJapanese": True,
        "officialGrade": "C-",
        "officialSha256Prefix": "98340afd",
    },
    {
        "id": "06_af_heart_cross_ja",
        "voice": "af_heart",
        "label": "AF Heart — 英語音色・日本語音素",
        "gender": "female",
        "nativeJapanese": False,
        "officialGrade": "A",
        "officialSha256Prefix": "0ab5709b",
    },
    {
        "id": "07_af_bella_cross_ja",
        "voice": "af_bella",
        "label": "AF Bella — 英語音色・日本語音素",
        "gender": "female",
        "nativeJapanese": False,
        "officialGrade": "A-",
        "officialSha256Prefix": "8cb64e02",
    },
    {
        "id": "08_am_puck_cross_ja",
        "voice": "am_puck",
        "label": "AM Puck — 英語音色・日本語音素",
        "gender": "male",
        "nativeJapanese": False,
        "officialGrade": "C+",
        "officialSha256Prefix": "dd1d8973",
    },
    {
        "id": "09_am_michael_cross_ja",
        "voice": "am_michael",
        "label": "AM Michael — 英語音色・日本語音素",
        "gender": "male",
        "nativeJapanese": False,
        "officialGrade": "C+",
        "officialSha256Prefix": "9a443b79",
    },
    {
        "id": "10_bf_emma_cross_ja",
        "voice": "bf_emma",
        "label": "BF Emma — 英語音色・日本語音素",
        "gender": "female",
        "nativeJapanese": False,
        "officialGrade": "B-",
        "officialSha256Prefix": "d0a423de",
    },
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def download(filename: str) -> Path:
    return Path(
        hf_hub_download(
            repo_id=REPO_ID,
            filename=filename,
            revision=REVISION,
            local_dir=MODEL_DIR,
        )
    )


def audio_stats(audio: np.ndarray) -> dict[str, Any]:
    absolute = np.abs(audio)
    peak = float(absolute.max(initial=0.0))
    rms = float(np.sqrt(np.mean(np.square(audio), dtype=np.float64)))
    return {
        "sampleCount": int(audio.size),
        "durationMs": round(audio.size / SOURCE_SAMPLE_RATE_HZ * 1000),
        "peak": peak,
        "peakDbfs": None if peak == 0 else 20 * float(np.log10(peak)),
        "rms": rms,
        "rmsDbfs": None if rms == 0 else 20 * float(np.log10(rms)),
        "clippedSampleCount": int(np.count_nonzero(absolute >= 0.999)),
    }


def main() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    WAV_DIR.mkdir(parents=True, exist_ok=True)

    torch.manual_seed(0)
    torch.set_num_threads(max(1, min(8, os.cpu_count() or 1)))

    config_path = download("config.json")
    model_path = download("kokoro-v1_0.pth")
    actual_model_sha = sha256(model_path)
    if actual_model_sha != MODEL_SHA256:
        raise RuntimeError(
            f"Model SHA256 mismatch: expected {MODEL_SHA256}, got {actual_model_sha}"
        )

    voice_paths: dict[str, Path] = {}
    for spec in VOICE_SPECS:
        voice_path = download(f"voices/{spec['voice']}.pt")
        actual_voice_sha = sha256(voice_path)
        if not actual_voice_sha.startswith(spec["officialSha256Prefix"]):
            raise RuntimeError(
                f"Voice SHA256 mismatch for {spec['voice']}: {actual_voice_sha}"
            )
        voice_paths[spec["voice"]] = voice_path

    model = KModel(
        repo_id=REPO_ID,
        config=str(config_path),
        model=str(model_path),
    ).to("cpu").eval()
    pipeline = KPipeline(
        lang_code="j",
        repo_id=REPO_ID,
        model=model,
        device="cpu",
    )

    generated: list[dict[str, Any]] = []
    for spec in VOICE_SPECS:
        chunks: list[np.ndarray] = []
        graphemes: list[str] = []
        phonemes: list[str] = []
        local_voice_path = voice_paths[spec["voice"]]

        for result in pipeline(
            TEXT,
            voice=str(local_voice_path),
            speed=SPEED,
            split_pattern=None,
        ):
            graphemes.append(result.graphemes)
            phonemes.append(result.phonemes)
            chunks.append(result.audio.detach().cpu().numpy().astype(np.float32))

        if not chunks:
            raise RuntimeError(f"No audio generated for {spec['voice']}")

        audio = np.concatenate(chunks)
        wav_path = WAV_DIR / f"{spec['id']}.wav"
        sf.write(wav_path, audio, SOURCE_SAMPLE_RATE_HZ, subtype="PCM_16")
        readback, readback_rate = sf.read(wav_path, dtype="float32", always_2d=False)
        if readback_rate != SOURCE_SAMPLE_RATE_HZ or readback.ndim != 1:
            raise RuntimeError(
                f"Unexpected WAV format for {spec['voice']}: "
                f"rate={readback_rate}, ndim={readback.ndim}"
            )

        generated.append(
            {
                **spec,
                "text": TEXT,
                "speed": SPEED,
                "graphemes": "".join(graphemes),
                "phonemes": "".join(phonemes),
                "voicePackPath": str(local_voice_path.relative_to(ROOT)).replace("\\", "/"),
                "voicePackSha256": sha256(local_voice_path),
                "wavPath": str(wav_path.relative_to(ROOT)).replace("\\", "/"),
                "wavSha256": sha256(wav_path),
                **audio_stats(readback),
            }
        )
        print(
            f"generated {spec['voice']}: "
            f"{generated[-1]['durationMs']} ms, {wav_path.name}"
        )

    RESULTS_PATH.write_text(
        json.dumps(
            {
                "repoId": REPO_ID,
                "revision": REVISION,
                "modelSha256": actual_model_sha,
                "text": TEXT,
                "langCode": "j",
                "speed": SPEED,
                "sourceSampleRateHz": SOURCE_SAMPLE_RATE_HZ,
                "samples": generated,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
