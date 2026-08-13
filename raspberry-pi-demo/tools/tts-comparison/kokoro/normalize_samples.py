from __future__ import annotations

import hashlib
import json
import re
import subprocess
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
GENERATION_RESULTS = ROOT / "generation_results.json"
NORMALIZATION_RESULTS = ROOT / "normalization_results.json"
AUDIO_DIR = ROOT / "audio"

TARGET_LUFS = -16.0
TARGET_TRUE_PEAK_DBTP = -1.0
TARGET_LRA = 7.0
ENCODE_SAMPLE_RATE_HZ = 24_000
OPUS_CLOCK_RATE_HZ = 48_000
OUTPUT_BITRATE = "48k"


def run(command: list[str]) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        command,
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"Command failed ({result.returncode}): {' '.join(command)}\n"
            f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
        )
    return result


def loudnorm_measure(path: Path) -> dict[str, str]:
    result = run(
        [
            "ffmpeg",
            "-hide_banner",
            "-nostats",
            "-i",
            str(path),
            "-af",
            (
                f"loudnorm=I={TARGET_LUFS}:TP={TARGET_TRUE_PEAK_DBTP}:"
                f"LRA={TARGET_LRA}:print_format=json"
            ),
            "-f",
            "null",
            "NUL",
        ]
    )
    matches = re.findall(r"\{\s*\"input_i\".*?\}", result.stderr, flags=re.DOTALL)
    if not matches:
        raise RuntimeError(f"Could not parse loudnorm output for {path}")
    return json.loads(matches[-1])


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def ffprobe(path: Path) -> dict[str, Any]:
    result = run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration,format_name:stream=codec_name,sample_rate,channels",
            "-of",
            "json",
            str(path),
        ]
    )
    return json.loads(result.stdout)


def main() -> None:
    generation = json.loads(GENERATION_RESULTS.read_text(encoding="utf-8"))
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    normalized: list[dict[str, Any]] = []

    for sample in generation["samples"]:
        wav_path = ROOT / sample["wavPath"]
        ogg_path = AUDIO_DIR / f"{sample['id']}.ogg"
        run(
            [
                "ffmpeg",
                "-hide_banner",
                "-nostats",
                "-y",
                "-i",
                str(wav_path),
                "-af",
                f"loudnorm=I={TARGET_LUFS}:TP={TARGET_TRUE_PEAK_DBTP}:LRA={TARGET_LRA}",
                "-ar",
                str(ENCODE_SAMPLE_RATE_HZ),
                "-ac",
                "1",
                "-c:a",
                "libopus",
                "-b:a",
                OUTPUT_BITRATE,
                "-vbr",
                "on",
                "-compression_level",
                "10",
                str(ogg_path),
            ]
        )

        probe = ffprobe(ogg_path)
        if len(probe.get("streams", [])) != 1:
            raise RuntimeError(f"Expected one audio stream in {ogg_path}")
        stream = probe["streams"][0]
        if (
            stream.get("codec_name") != "opus"
            or int(stream.get("sample_rate", 0)) != OPUS_CLOCK_RATE_HZ
            or int(stream.get("channels", 0)) != 1
            or "ogg" not in probe.get("format", {}).get("format_name", "")
        ):
            raise RuntimeError(f"Unexpected OGG format for {ogg_path}: {probe}")

        final_loudness = loudnorm_measure(ogg_path)
        integrated_lufs = float(final_loudness["input_i"])
        true_peak_dbtp = float(final_loudness["input_tp"])
        if not (-18.0 <= integrated_lufs <= -14.0):
            raise RuntimeError(
                f"Integrated loudness outside tolerance for {ogg_path}: "
                f"{integrated_lufs} LUFS"
            )
        if true_peak_dbtp > -0.4:
            raise RuntimeError(
                f"True peak outside tolerance for {ogg_path}: {true_peak_dbtp} dBTP"
            )

        duration_ms = round(float(probe["format"]["duration"]) * 1000)
        normalized.append(
            {
                "id": sample["id"],
                "voice": sample["voice"],
                "label": sample["label"],
                "path": str(ogg_path.relative_to(ROOT)).replace("\\", "/"),
                "sha256": sha256(ogg_path),
                "durationMs": duration_ms,
                "codec": "opus",
                "container": "ogg",
                "channels": 1,
                "sourceSampleRateHz": generation["sourceSampleRateHz"],
                "sampleRateHz": OPUS_CLOCK_RATE_HZ,
                "integratedLufs": integrated_lufs,
                "truePeakDbtp": true_peak_dbtp,
                "nativeJapanese": sample["nativeJapanese"],
                "gender": sample["gender"],
                "speed": sample["speed"],
            }
        )
        print(
            f"normalized {sample['voice']}: {duration_ms} ms, "
            f"{integrated_lufs:.1f} LUFS, {true_peak_dbtp:.1f} dBTP"
        )

    NORMALIZATION_RESULTS.write_text(
        json.dumps(
            {
                "targetIntegratedLufs": TARGET_LUFS,
                "targetTruePeakDbtp": TARGET_TRUE_PEAK_DBTP,
                "targetLra": TARGET_LRA,
                "codec": "opus",
                "container": "ogg",
                "channels": 1,
                "sourceSampleRateHz": generation["sourceSampleRateHz"],
                "sampleRateHz": OPUS_CLOCK_RATE_HZ,
                "samples": normalized,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
