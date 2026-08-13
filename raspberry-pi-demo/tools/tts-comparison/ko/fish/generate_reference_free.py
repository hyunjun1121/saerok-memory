from __future__ import annotations

import argparse
import json
import platform
import random
import subprocess
import sys
import time
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path

import numpy as np
import soundfile as sf
import torch

from comparison_utils import (
    merge_generation_records,
    validate_generation_request,
    validate_runtime_provenance,
)


ROOT = Path(__file__).resolve().parent
COMPARISON_ROOT = ROOT.parents[1]
SHARED_FISH_ROOT = COMPARISON_ROOT / "fish"
SOURCE = SHARED_FISH_ROOT / "source"
DEFAULT_CHECKPOINT = SHARED_FISH_ROOT / "models" / "s2-pro"
TEXT = "영자 어르신, 오늘 기분은 어떠세요?"
DEFAULT_SEEDS = tuple(range(5201, 5221))
SOURCE_REVISION = "e5e292632cb11e7a27b2b7487f58f612bc101e13"
MODEL_ID = "fishaudio/s2-pro"
MODEL_REVISION = "1de9996b6be38b745688de084d87a5633f714e4e"
MODEL_FILE_COUNT = 13
MIN_TOTAL_VRAM_BYTES = 24_000_000_000
MIN_FREE_VRAM_BYTES = 20 * 1024**3


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate pinned Korean reference-free Fish Speech WAVs."
    )
    parser.add_argument(
        "--checkpoint-path",
        type=Path,
        default=DEFAULT_CHECKPOINT,
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=ROOT / "outputs" / "native",
    )
    parser.add_argument("--seeds", type=int, nargs="+", default=DEFAULT_SEEDS)
    parser.add_argument("--max-new-tokens", type=int, default=256)
    return parser.parse_args()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def relative_to_root(path: Path) -> str:
    return str(path.resolve().relative_to(ROOT)).replace("\\", "/")


def ensure_output_is_local(output_dir: Path) -> Path:
    resolved = output_dir.resolve()
    if resolved != ROOT and ROOT not in resolved.parents:
        raise ValueError(f"output directory must stay under {ROOT}")
    return resolved


def file_sha256(path: Path) -> str:
    digest = sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_shared_runtime(checkpoint_path: Path) -> dict[str, object]:
    source_head = subprocess.run(
        ["git", "-C", str(SOURCE), "rev-parse", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    source_dirty = bool(
        subprocess.run(
            ["git", "-C", str(SOURCE), "status", "--porcelain"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
    )
    metadata_dir = checkpoint_path / ".cache" / "huggingface" / "download"
    metadata_paths = sorted(metadata_dir.glob("*.metadata"))
    model_metadata_revisions = [
        path.read_text(encoding="utf-8").splitlines()[0].strip()
        for path in metadata_paths
    ]
    validate_runtime_provenance(
        source_head=source_head,
        source_dirty=source_dirty,
        model_metadata_revisions=model_metadata_revisions,
        expected_source_revision=SOURCE_REVISION,
        expected_model_revision=MODEL_REVISION,
        expected_model_file_count=MODEL_FILE_COUNT,
    )
    return {
        "sourceHead": source_head,
        "sourceDirty": source_dirty,
        "modelMetadataFileCount": len(metadata_paths),
        "modelMetadataRevision": MODEL_REVISION,
    }


def preflight_cuda() -> dict[str, object]:
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA GPU is required for this comparison run")
    if not torch.cuda.is_bf16_supported():
        raise RuntimeError("Fish Speech bfloat16 inference requires BF16 GPU support")
    properties = torch.cuda.get_device_properties(0)
    free_memory, total_memory = torch.cuda.mem_get_info(0)
    if properties.total_memory < MIN_TOTAL_VRAM_BYTES:
        raise RuntimeError(
            "Fish Speech requires at least 24 GB total VRAM; "
            f"found {properties.total_memory} bytes"
        )
    if free_memory < MIN_FREE_VRAM_BYTES:
        raise RuntimeError(
            "Fish Speech comparison requires at least 20 GiB free VRAM; "
            f"found {free_memory} bytes"
        )
    return {
        "python": platform.python_version(),
        "platform": platform.platform(),
        "torch": torch.__version__,
        "cudaRuntime": torch.version.cuda,
        "cudnn": torch.backends.cudnn.version(),
        "gpu": properties.name,
        "gpuTotalMemoryBytes": int(total_memory),
        "gpuFreeMemoryBytesAtPreflight": int(free_memory),
        "bf16Supported": True,
    }


def set_reproducible_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed % 2**32)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.benchmark = False
    torch.backends.cudnn.deterministic = True
    torch.use_deterministic_algorithms(True, warn_only=True)


def main() -> None:
    args = parse_args()
    args.checkpoint_path = args.checkpoint_path.resolve()
    args.output_dir = ensure_output_is_local(args.output_dir)
    if args.checkpoint_path != DEFAULT_CHECKPOINT.resolve():
        raise ValueError(
            "checkpoint path must use the pinned shared fish/models/s2-pro snapshot"
        )
    seeds = validate_generation_request(
        args.seeds,
        max_new_tokens=args.max_new_tokens,
    )
    runtime_provenance = verify_shared_runtime(args.checkpoint_path)

    # Import pinned Fish code only after source/model provenance passes.
    sys.path.insert(0, str(SOURCE))
    from fish_speech.models.text2semantic.inference import (  # noqa: PLC0415
        decode_to_audio,
        generate_long,
        init_model,
        load_codec_model,
    )

    args.output_dir.mkdir(parents=True, exist_ok=True)
    metadata_path = args.output_dir / "generation-metadata.json"
    if metadata_path.exists():
        run_records: list[dict[str, object]] = json.loads(
            metadata_path.read_text(encoding="utf-8")
        )
    else:
        run_records = []
    run_records = merge_generation_records(run_records, [])
    merge_generation_records(run_records, ({"seed": seed} for seed in seeds))

    runtime = {**preflight_cuda(), **runtime_provenance}
    torch.set_float32_matmul_precision("high")
    device = "cuda"
    precision = torch.bfloat16

    started_at_utc = utc_now()
    started_at = time.time()
    model, decode_one_token = init_model(
        args.checkpoint_path,
        device,
        precision,
        compile=False,
    )
    with torch.device(device):
        model.setup_caches(
            max_batch_size=1,
            max_seq_len=model.config.max_seq_len,
            dtype=next(model.parameters()).dtype,
        )

    codec = load_codec_model(
        args.checkpoint_path / "codec.pth",
        device,
        precision,
    )
    for seed in seeds:
        output_path = args.output_dir / f"fish_ko_reference_free_seed_{seed}.wav"
        if output_path.exists():
            raise RuntimeError(f"Refusing to overwrite untracked native WAV: {output_path}")

        set_reproducible_seed(seed)
        sample_started_at = time.time()
        code_chunks: list[torch.Tensor] = []
        merged_codes = None
        audio = None
        audio_array = None
        try:
            for response in generate_long(
                model=model,
                device=device,
                decode_one_token=decode_one_token,
                text=TEXT,
                num_samples=1,
                max_new_tokens=args.max_new_tokens,
                top_p=0.9,
                top_k=30,
                temperature=1.0,
                compile=False,
                iterative_prompt=True,
                chunk_length=300,
                prompt_text=None,
                prompt_tokens=None,
            ):
                if response.action == "sample":
                    if response.codes is None:
                        raise RuntimeError(f"Seed {seed} returned an empty code sample")
                    code_chunks.append(response.codes)

            if not code_chunks:
                raise RuntimeError(f"Seed {seed} returned no generated code chunks")

            merged_codes = torch.cat(code_chunks, dim=1)
            audio = decode_to_audio(merged_codes.to(device), codec)
            audio_array = audio.cpu().float().numpy()
            sf.write(output_path, audio_array, codec.sample_rate, subtype="PCM_24")

            record = {
                "id": f"fish-ko-reference-free-seed-{seed}",
                "seed": seed,
                "text": TEXT,
                "referenceAudio": None,
                "nativePath": relative_to_root(output_path),
                "nativeSha256": file_sha256(output_path),
                "nativeSampleRateHz": int(codec.sample_rate),
                "nativeFrames": int(np.asarray(audio_array).shape[-1]),
                "generationSeconds": round(time.time() - sample_started_at, 3),
                "generatedAtUtc": utc_now(),
                "maxNewTokens": args.max_new_tokens,
                "temperature": 1.0,
                "topP": 0.9,
                "topK": 30,
            }
            run_records = merge_generation_records(run_records, [record])
            metadata_path.write_text(
                json.dumps(run_records, ensure_ascii=False, indent=2, allow_nan=False)
                + "\n",
                encoding="utf-8",
            )
        finally:
            code_chunks.clear()
            del merged_codes, audio, audio_array
            torch.cuda.empty_cache()

    summary = {
        "generatedAtUtc": utc_now(),
        "startedAtUtc": started_at_utc,
        "source": {
            "url": "https://github.com/fishaudio/fish-speech.git",
            "revision": SOURCE_REVISION,
        },
        "model": {
            "id": MODEL_ID,
            "revision": MODEL_REVISION,
        },
        "modelPath": str(args.checkpoint_path.relative_to(COMPARISON_ROOT)).replace(
            "\\", "/"
        ),
        "text": TEXT,
        "seeds": [int(record["seed"]) for record in run_records],
        "generationConfig": {
            "precision": "bfloat16",
            "compile": False,
            "maxNewTokens": args.max_new_tokens,
            "temperature": 1.0,
            "topP": 0.9,
            "topK": 30,
            "referenceAudio": None,
            "iterativePrompt": True,
            "chunkLength": 300,
        },
        "runtime": runtime,
        "totalSeconds": round(time.time() - started_at, 3),
        "samples": run_records,
    }
    (args.output_dir / "generation-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
