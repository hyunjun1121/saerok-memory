from __future__ import annotations

import json
import math
import shutil
import subprocess
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path

import numpy as np
import soundfile as sf

from comparison_utils import parse_ebur128_summary, validate_generation_provenance


ROOT = Path(__file__).resolve().parent
NATIVE_DIR = ROOT / "outputs" / "native"
WORK_DIR = ROOT / ".work"
CANDIDATE_WAV_DIR = WORK_DIR / "candidates" / "wav"
CANDIDATE_OGG_DIR = WORK_DIR / "candidates" / "ogg"
REJECTED_DIR = WORK_DIR / "rejected"
AUDIO_DIR = ROOT / "audio"
TARGET_I = -16.0
TARGET_TP = -1.0
TARGET_LRA = 7.0
SILENCE_DBFS = -45.0
FRAME_MS = 50
SELECTED_COUNT = 10
EXPECTED_SEEDS = tuple(range(4201, 4221))
EXPECTED_TEXT = "春子さん、今日の気分はいかがですか。"
EXPECTED_MAX_NEW_TOKENS = 256
SOURCE_REVISION = "e5e292632cb11e7a27b2b7487f58f612bc101e13"
MODEL_ID = "fishaudio/s2-pro"
MODEL_REVISION = "1de9996b6be38b745688de084d87a5633f714e4e"
INVALID_MEASUREMENT_SENTINEL = 10_000_000.0


def run(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, check=True, capture_output=True, text=True)


def ebur128_measure(path: Path) -> dict[str, float]:
    result = run(
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
            "-",
        ]
    )
    return parse_ebur128_summary(f"{result.stdout}\n{result.stderr}")


def probe(path: Path) -> dict[str, object]:
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


def acoustic_metrics(path: Path) -> dict[str, float | int | bool]:
    samples, sample_rate = sf.read(path, dtype="float32", always_2d=False)
    samples = np.asarray(samples, dtype=np.float32)
    finite = bool(np.isfinite(samples).all())
    if not finite:
        return {
            "finite": False,
            "clipSamples": int(np.count_nonzero(np.abs(samples) >= 0.999)),
            "silenceRatio": 1.0,
            "maxSilenceMs": 10_000_000,
            "envelopeCv": 10_000_000.0,
            "voicedFrames": 0,
        }

    frame_length = max(1, round(sample_rate * FRAME_MS / 1000))
    frame_count = max(1, int(np.ceil(len(samples) / frame_length)))
    padded = np.pad(samples, (0, frame_count * frame_length - len(samples)))
    frames = padded.reshape(frame_count, frame_length)
    rms = np.sqrt(np.mean(np.square(frames, dtype=np.float64), axis=1))
    silence_threshold = 10 ** (SILENCE_DBFS / 20)
    silent = rms < silence_threshold
    longest_run = 0
    current_run = 0
    for is_silent in silent:
        current_run = current_run + 1 if is_silent else 0
        longest_run = max(longest_run, current_run)
    voiced_rms = rms[~silent]
    envelope_cv = (
        float(np.std(voiced_rms) / np.mean(voiced_rms))
        if voiced_rms.size and float(np.mean(voiced_rms)) > 0
        else 10_000_000.0
    )
    return {
        "finite": True,
        "clipSamples": int(np.count_nonzero(np.abs(samples) >= 0.999)),
        "silenceRatio": round(float(np.mean(silent)), 6),
        "maxSilenceMs": int(longest_run * FRAME_MS),
        "envelopeCv": round(envelope_cv, 6),
        "voicedFrames": int(voiced_rms.size),
    }


def process_candidate(native_path: Path) -> dict[str, object]:
    seed = int(native_path.stem.rsplit("_", maxsplit=1)[-1])
    intermediate_path = CANDIDATE_WAV_DIR / native_path.name
    final_path = CANDIDATE_OGG_DIR / f"fish_reference_free_seed_{seed}.ogg"

    run(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(native_path),
            "-ac",
            "1",
            "-ar",
            "24000",
            "-c:a",
            "pcm_s24le",
            str(intermediate_path),
        ]
    )

    run(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(intermediate_path),
            "-af",
            f"loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA={TARGET_LRA}",
            "-ac",
            "1",
            "-ar",
            "24000",
            "-c:a",
            "libopus",
            "-b:a",
            "48k",
            "-vbr",
            "on",
            "-compression_level",
            "10",
            str(final_path),
        ]
    )

    final_probe = probe(final_path)
    final_loudness = ebur128_measure(final_path)
    metrics = acoustic_metrics(final_path)
    measurement_valid = all(math.isfinite(value) for value in final_loudness.values())
    integrated_lufs = (
        final_loudness["integratedLufs"]
        if measurement_valid
        else INVALID_MEASUREMENT_SENTINEL
    )
    true_peak_dbtp = (
        final_loudness["truePeakDbtp"]
        if measurement_valid
        else INVALID_MEASUREMENT_SENTINEL
    )
    stream = final_probe["streams"][0]
    duration_ms = round(float(final_probe["format"]["duration"]) * 1000)
    record: dict[str, object] = {
        "id": f"fish-reference-free-seed-{seed}",
        "seed": seed,
        "candidateWav": str(intermediate_path.relative_to(ROOT)).replace("\\", "/"),
        "candidateOgg": str(final_path.relative_to(ROOT)).replace("\\", "/"),
        "sha256": sha256(final_path.read_bytes()).hexdigest(),
        "durationMs": duration_ms,
        "codec": stream["codec_name"],
        "container": "ogg",
        "channels": int(stream["channels"]),
        "sourceSampleRateHz": 24000,
        "sampleRateHz": int(stream["sample_rate"]),
        "measurementValid": measurement_valid,
        "integratedLufs": integrated_lufs,
        "truePeakDbtp": true_peak_dbtp,
        **metrics,
    }
    record["eligible"] = bool(
        2000 <= duration_ms <= 8000
        and record["codec"] == "opus"
        and record["channels"] == 1
        and record["sampleRateHz"] == 48000
        and record["measurementValid"]
        and record["finite"]
        and record["voicedFrames"] > 0
        and record["clipSamples"] == 0
        and -18.0 <= record["integratedLufs"] <= -14.0
        and record["truePeakDbtp"] <= -0.4
    )
    record["technicalScore"] = round(
        float(record["silenceRatio"]) * 10
        + float(record["maxSilenceMs"]) / 1000 * 4
        + float(record["envelopeCv"]) * 2
        + abs(duration_ms / 1000 - 4.0) * 0.25,
        6,
    )
    return record


def archive_existing_generated() -> None:
    existing_audio = [path for path in AUDIO_DIR.iterdir() if path.is_file()]
    existing_rejected = [path for path in REJECTED_DIR.iterdir() if path.is_file()]
    if not existing_audio and not existing_rejected:
        return
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    archive_root = WORK_DIR / f"archive-{timestamp}"
    for source, group in (
        *((path, "audio") for path in existing_audio),
        *((path, "rejected") for path in existing_rejected),
    ):
        destination_dir = archive_root / group
        destination_dir.mkdir(parents=True, exist_ok=True)
        shutil.move(str(source), destination_dir / source.name)


def main() -> None:
    for directory in (
        CANDIDATE_WAV_DIR,
        CANDIDATE_OGG_DIR,
        REJECTED_DIR,
        AUDIO_DIR,
    ):
        directory.mkdir(parents=True, exist_ok=True)

    native_paths = sorted(NATIVE_DIR.glob("fish_reference_free_seed_*.wav"))
    if len(native_paths) != 20:
        raise RuntimeError(f"Expected 20 native samples, found {len(native_paths)}")
    native_by_seed = {
        int(path.stem.rsplit("_", maxsplit=1)[-1]): str(path.relative_to(ROOT)).replace(
            "\\", "/"
        )
        for path in native_paths
    }
    generation_records = json.loads(
        (NATIVE_DIR / "generation-metadata.json").read_text(encoding="utf-8")
    )
    generation_summary = json.loads(
        (NATIVE_DIR / "generation-summary.json").read_text(encoding="utf-8")
    )
    validate_generation_provenance(
        generation_records,
        generation_summary,
        native_paths=native_by_seed,
        expected_seeds=EXPECTED_SEEDS,
        expected_text=EXPECTED_TEXT,
        expected_max_new_tokens=EXPECTED_MAX_NEW_TOKENS,
        expected_source_revision=SOURCE_REVISION,
        expected_model_id=MODEL_ID,
        expected_model_revision=MODEL_REVISION,
    )
    records = [process_candidate(path) for path in native_paths]
    eligible = sorted(
        (record for record in records if record["eligible"]),
        key=lambda record: (float(record["technicalScore"]), int(record["seed"])),
    )
    if len(eligible) < SELECTED_COUNT:
        raise RuntimeError(f"Only {len(eligible)} of 20 samples passed technical gates")

    selected_seeds = {int(record["seed"]) for record in eligible[:SELECTED_COUNT]}
    archive_existing_generated()

    for record in records:
        seed = int(record["seed"])
        candidate_wav = ROOT / str(record["candidateWav"])
        candidate_ogg = ROOT / str(record["candidateOgg"])
        selected = seed in selected_seeds
        record["selected"] = selected
        destination_dir = AUDIO_DIR if selected else REJECTED_DIR
        shutil.copy2(candidate_wav, destination_dir / candidate_wav.name)
        shutil.copy2(candidate_ogg, destination_dir / candidate_ogg.name)
        if selected:
            record["path"] = f"fish/audio/{candidate_ogg.name}"
            record["wavPath"] = f"fish/audio/{candidate_wav.name}"

    ordered = sorted(
        records,
        key=lambda record: (
            not bool(record["selected"]),
            float(record["technicalScore"]),
            int(record["seed"]),
        ),
    )
    (ROOT / "outputs" / "postprocess-metadata.json").write_text(
        json.dumps(ordered, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
