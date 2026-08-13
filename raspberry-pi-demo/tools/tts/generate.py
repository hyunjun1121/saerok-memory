"""Generate Haru narration assets with Qwen3-TTS on a development GPU.

Model weights and intermediate WAV files stay under tools/tts and are ignored.
Only normalized Ogg Opus files and their manifest ship to Raspberry Pi.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from typing import Any

MODEL_ID = "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice"
MODEL_REVISION = "0c0e3051f131929182e2c023b9537f8b1c68adfe"
MODEL_URL = f"https://huggingface.co/{MODEL_ID}"
TARGET_LUFS = -16
TRUE_PEAK_DBTP = -1

TOOL_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = TOOL_DIR.parent.parent
DEFAULT_SOURCE = TOOL_DIR / "narration-source.json"
DEFAULT_OUTPUT = PROJECT_ROOT / "public" / "assets" / "audio" / "narration"
DEFAULT_CACHE = TOOL_DIR / ".cache" / "huggingface"
DEFAULT_WORK = TOOL_DIR / ".work" / "wav"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    parser.add_argument("--work", type=Path, default=DEFAULT_WORK)
    parser.add_argument("--locale", choices=("ko", "ja"), action="append")
    parser.add_argument("--id", dest="entry_ids", action="append", help="Generate one stable id")
    parser.add_argument("--limit", type=int, help="Generate at most N filtered entries")
    parser.add_argument("--batch-size", type=int, default=2)
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--device", default="cuda:0")
    parser.add_argument("--attention", default="sdpa", choices=("sdpa", "eager", "flash_attention_2"))
    parser.add_argument(
        "--max-new-tokens",
        type=int,
        help="Bound generated audio tokens; use for one-at-a-time quality repair",
    )
    return parser.parse_args()


def canonical_bytes(payload: Any) -> bytes:
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for block in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def audio_key(entry: dict[str, str], voice: dict[str, str]) -> str:
    payload = {
        "locale": entry["locale"],
        "text": entry["text"],
        "speaker": voice["speaker"],
        "language": voice["language"],
        "instruct": voice["instruct"],
        "model": MODEL_ID,
        "revision": MODEL_REVISION,
    }
    return hashlib.sha256(canonical_bytes(payload)).hexdigest()[:24]


def output_paths(output_dir: Path, work_dir: Path, entry: dict[str, str], voice: dict[str, str]) -> tuple[Path, Path, str]:
    key = audio_key(entry, voice)
    locale = entry["locale"]
    relative_path = f"assets/audio/narration/{locale}/{key}.ogg"
    return output_dir / locale / f"{key}.ogg", work_dir / locale / f"{key}.wav", relative_path


def require_executable(name: str) -> str:
    executable = shutil.which(name)
    if executable is None:
        raise RuntimeError(f"Required executable is missing: {name}")
    return executable


def encode_ogg(ffmpeg: str, wav_path: Path, ogg_path: Path) -> None:
    ogg_path.parent.mkdir(parents=True, exist_ok=True)
    command = [
        ffmpeg,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(wav_path),
        "-af",
        f"loudnorm=I={TARGET_LUFS}:TP={TRUE_PEAK_DBTP}:LRA=7",
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
        str(ogg_path),
    ]
    subprocess.run(command, check=True)


def probe_duration_ms(ffprobe: str, path: Path) -> int:
    result = subprocess.run(
        [
            ffprobe,
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return max(1, round(float(result.stdout.strip()) * 1000))


def validate_source(source: dict[str, Any]) -> None:
    if source.get("schemaVersion") != 1:
        raise ValueError("Narration source schemaVersion must be 1")
    model = source.get("model")
    if not isinstance(model, dict) or model.get("id") != MODEL_ID or model.get("revision") != MODEL_REVISION:
        raise ValueError("Narration source does not pin the approved Qwen model revision")
    entries = source.get("entries")
    if not isinstance(entries, list) or not entries:
        raise ValueError("Narration source entries are missing")
    seen: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict):
            raise ValueError("Narration source entry must be an object")
        entry_id = entry.get("id")
        locale = entry.get("locale")
        text = entry.get("text")
        if not isinstance(entry_id, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", entry_id):
            raise ValueError(f"Invalid narration id: {entry_id!r}")
        if locale not in ("ko", "ja") or not isinstance(text, str) or not text.strip():
            raise ValueError(f"Invalid narration source entry: {entry_id}")
        key = f"{locale}:{entry_id}"
        if key in seen:
            raise ValueError(f"Duplicate narration source entry: {key}")
        seen.add(key)


def load_model(device: str, attention: str, cache_dir: Path):
    cache_dir.mkdir(parents=True, exist_ok=True)
    os.environ["HF_HOME"] = str(cache_dir)
    # Hugging Face Xet is extremely slow on some Windows networks. Plain HTTP
    # supports resuming and is more predictable for this one-time download.
    os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
    try:
        import torch
        from huggingface_hub import snapshot_download
        from qwen_tts import Qwen3TTSModel
    except ImportError as error:
        raise RuntimeError(
            "Qwen runtime missing. Create tools/tts/.venv and install tools/tts/requirements.txt"
        ) from error

    if not torch.cuda.is_available() and device.startswith("cuda"):
        raise RuntimeError("CUDA requested but torch.cuda.is_available() is false")

    print(f"Loading {MODEL_ID}@{MODEL_REVISION} on {device}", flush=True)
    # Resolve one complete local snapshot first. Qwen's nested speech-tokenizer
    # loader otherwise falls back to a second Hugging Face cache location.
    snapshot_path = snapshot_download(
        MODEL_ID,
        revision=MODEL_REVISION,
        cache_dir=str(cache_dir),
    )
    return Qwen3TTSModel.from_pretrained(
        snapshot_path,
        device_map=device,
        dtype=torch.bfloat16,
        attn_implementation=attention,
    )


def main() -> int:
    args = parse_args()
    if args.batch_size < 1:
        raise ValueError("--batch-size must be positive")
    source = json.loads(args.source.read_text(encoding="utf-8"))
    validate_source(source)
    source_hash = hashlib.sha256(canonical_bytes(source)).hexdigest()
    voices = source["model"]["voices"]

    selected = [
        entry
        for entry in source["entries"]
        if (not args.locale or entry["locale"] in args.locale)
        and (not args.entry_ids or entry["id"] in args.entry_ids)
    ]
    if args.limit is not None:
        selected = selected[: args.limit]
    if not selected:
        raise ValueError("No narration entries match the requested filters")

    ffmpeg = require_executable("ffmpeg")
    ffprobe = require_executable("ffprobe")
    args.output.mkdir(parents=True, exist_ok=True)
    args.work.mkdir(parents=True, exist_ok=True)

    unique: dict[str, dict[str, str]] = {}
    for entry in selected:
        key = audio_key(entry, voices[entry["locale"]])
        unique.setdefault(key, entry)

    pending = []
    for entry in unique.values():
        ogg_path, _, _ = output_paths(args.output, args.work, entry, voices[entry["locale"]])
        if args.overwrite or not ogg_path.is_file() or ogg_path.stat().st_size == 0:
            pending.append(entry)

    print(
        f"Selected {len(selected)} ids, {len(unique)} unique utterances, {len(pending)} pending",
        flush=True,
    )
    if args.dry_run:
        return 0

    model = load_model(args.device, args.attention, args.cache) if pending else None
    import soundfile as sf
    import torch

    batches = math.ceil(len(pending) / args.batch_size)
    for batch_index, offset in enumerate(range(0, len(pending), args.batch_size), start=1):
        batch = pending[offset : offset + args.batch_size]
        torch.manual_seed(int(hashlib.sha256(batch[0]["id"].encode()).hexdigest()[:8], 16))
        texts = [entry["text"] for entry in batch]
        locales = [entry["locale"] for entry in batch]
        batch_voices = [voices[locale] for locale in locales]
        print(f"Generating batch {batch_index}/{batches}: {', '.join(entry['id'] for entry in batch)}", flush=True)
        wavs, sample_rate = model.generate_custom_voice(
            text=texts,
            language=[voice["language"] for voice in batch_voices],
            speaker=[voice["speaker"] for voice in batch_voices],
            instruct=[voice["instruct"] for voice in batch_voices],
            **({"max_new_tokens": args.max_new_tokens} if args.max_new_tokens else {}),
        )
        if len(wavs) != len(batch):
            raise RuntimeError(f"Qwen returned {len(wavs)} waveforms for {len(batch)} inputs")
        for entry, waveform in zip(batch, wavs, strict=True):
            voice = voices[entry["locale"]]
            ogg_path, wav_path, _ = output_paths(args.output, args.work, entry, voice)
            wav_path.parent.mkdir(parents=True, exist_ok=True)
            sf.write(wav_path, waveform, sample_rate, subtype="PCM_16")
            encode_ogg(ffmpeg, wav_path, ogg_path)
            wav_path.unlink(missing_ok=True)

    manifest_entries = []
    missing = []
    for entry in selected:
        voice = voices[entry["locale"]]
        ogg_path, _, relative_path = output_paths(args.output, args.work, entry, voice)
        if not ogg_path.is_file():
            missing.append(f"{entry['locale']}:{entry['id']}")
            continue
        manifest_entries.append(
            {
                "id": entry["id"],
                "locale": entry["locale"],
                "text": entry["text"],
                "path": relative_path,
                "audioPath": relative_path,
                "sha256": sha256_file(ogg_path),
                "durationMs": probe_duration_ms(ffprobe, ogg_path),
            }
        )
    if missing:
        raise RuntimeError(f"Missing generated audio for {len(missing)} entries: {', '.join(missing[:5])}")

    manifest_entries.sort(key=lambda entry: (entry["locale"], entry["id"]))
    manifest = {
        "schemaVersion": 1,
        "sourceSha256": source_hash,
        "model": {
            "id": MODEL_ID,
            "revision": MODEL_REVISION,
            "license": "Apache-2.0",
            "sourceUrl": MODEL_URL,
        },
        "audio": {
            "codec": "opus",
            "container": "ogg",
            "channels": 1,
            "loudnessTargetLufs": TARGET_LUFS,
            "truePeakDbtp": TRUE_PEAK_DBTP,
        },
        "entries": manifest_entries,
    }
    manifest_path = args.output / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(manifest_entries)} entries to {manifest_path}", flush=True)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, ValueError, subprocess.CalledProcessError) as error:
        print(f"TTS generation failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
