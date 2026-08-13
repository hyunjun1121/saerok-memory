from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
from pathlib import Path
from typing import Any

from normalize_samples import loudnorm_measure


ROOT = Path(__file__).resolve().parent
COMPARISON_ROOT = ROOT.parent
METHOD_PATH = ROOT / "method.json"
REQUIRED_SAMPLE_FIELDS = {
    "id",
    "voice",
    "label",
    "path",
    "sha256",
    "durationMs",
    "codec",
    "container",
    "channels",
    "sourceSampleRateHz",
    "sampleRateHz",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def ffprobe(path: Path) -> dict[str, Any]:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration,format_name:stream=codec_name,sample_rate,channels",
            "-of",
            "json",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return json.loads(result.stdout)


def ebur128_integrated_lufs(path: Path) -> float:
    result = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-nostats",
            "-i",
            str(path),
            "-filter_complex",
            "ebur128=peak=true",
            "-f",
            "null",
            "NUL" if os.name == "nt" else "/dev/null",
        ],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    matches = re.findall(r"I:\s*(-?[0-9.]+) LUFS", f"{result.stdout}\n{result.stderr}")
    if not matches:
        raise RuntimeError(f"Could not parse EBU R128 output for {path}")
    return float(matches[-1])


def main() -> None:
    method = json.loads(METHOD_PATH.read_text(encoding="utf-8"))
    if method["id"] != "kokoro":
        raise RuntimeError("method.id must be kokoro")
    if method["voiceInventory"] != {
        **method["voiceInventory"],
        "kind": "finite",
        "total": 54,
    }:
        raise RuntimeError("voiceInventory must declare finite total 54")

    samples = method["samples"]
    if len(samples) != 10:
        raise RuntimeError(f"Expected 10 samples, got {len(samples)}")
    ids = [sample["id"] for sample in samples]
    paths = [sample["path"] for sample in samples]
    if len(ids) != len(set(ids)) or len(paths) != len(set(paths)):
        raise RuntimeError("Sample ids and paths must be unique")

    referenced_paths: set[Path] = set()
    for sample in samples:
        missing = REQUIRED_SAMPLE_FIELDS - sample.keys()
        if missing:
            raise RuntimeError(f"{sample.get('id')} missing fields: {sorted(missing)}")
        path = (COMPARISON_ROOT / sample["path"]).resolve()
        if path.parent != (ROOT / "audio").resolve():
            raise RuntimeError(f"Sample must be a direct kokoro/audio child: {path}")
        if not path.is_file():
            raise RuntimeError(f"Missing sample: {path}")
        referenced_paths.add(path)

        if sha256(path) != sample["sha256"]:
            raise RuntimeError(f"SHA256 mismatch: {path}")
        probe = ffprobe(path)
        stream = probe["streams"][0]
        duration_ms = round(float(probe["format"]["duration"]) * 1000)
        if (
            stream["codec_name"] != "opus"
            or int(stream["sample_rate"]) != 48_000
            or int(stream["channels"]) != 1
            or "ogg" not in probe["format"]["format_name"]
            or sample["codec"] != "opus"
            or sample["container"] != "ogg"
            or sample["channels"] != 1
            or sample["sourceSampleRateHz"] != 24_000
            or sample["sampleRateHz"] != 48_000
            or duration_ms != sample["durationMs"]
        ):
            raise RuntimeError(f"Metadata mismatch for {path}: {probe}")

        loudness = loudnorm_measure(path)
        integrated_lufs = ebur128_integrated_lufs(path)
        true_peak_dbtp = float(loudness["input_tp"])
        if not (-18.0 <= integrated_lufs <= -14.0):
            raise RuntimeError(f"LUFS out of range for {path}: {integrated_lufs}")
        if true_peak_dbtp > -0.4:
            raise RuntimeError(f"True peak out of range for {path}: {true_peak_dbtp}")
        if abs(integrated_lufs - sample["integratedLufs"]) > 0.05:
            raise RuntimeError(f"Stored LUFS drift for {path}: {integrated_lufs}")
        if abs(true_peak_dbtp - sample["truePeakDbtp"]) > 0.05:
            raise RuntimeError(f"Stored true peak drift for {path}: {true_peak_dbtp}")

        wav_path = ROOT / "audio" / "wav" / f"{sample['id']}.wav"
        if not wav_path.is_file():
            raise RuntimeError(f"Missing source WAV: {wav_path}")
        wav_probe = ffprobe(wav_path)
        wav_stream = wav_probe["streams"][0]
        if (
            wav_stream["codec_name"] != "pcm_s16le"
            or int(wav_stream["sample_rate"]) != 24_000
            or int(wav_stream["channels"]) != 1
        ):
            raise RuntimeError(f"Unexpected source WAV format: {wav_path}")

        print(
            f"PASS {sample['id']}: {duration_ms} ms, "
            f"{integrated_lufs:.1f} EBU R128 LUFS, {true_peak_dbtp:.2f} dBTP"
        )

    actual_paths = {path.resolve() for path in (ROOT / "audio").glob("*.ogg")}
    if actual_paths != referenced_paths:
        raise RuntimeError(
            f"Orphan/missing OGG files: actual={sorted(actual_paths)}, "
            f"referenced={sorted(referenced_paths)}"
        )
    print("PASS: method.json references exactly 10 validated OGG files and 10 WAV sources")


if __name__ == "__main__":
    main()
