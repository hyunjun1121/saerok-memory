"""Download the two pinned Qwen checkpoints into backend/models explicitly."""

from __future__ import annotations

from pathlib import Path

from huggingface_hub import snapshot_download


ROOT = Path(__file__).resolve().parents[1]
MODELS = (
    (
        "Qwen/Qwen3-ASR-1.7B",
        "7278e1e70fe206f11671096ffdd38061171dd6e5",
        ROOT / "models" / "Qwen3-ASR-1.7B",
    ),
    (
        "Qwen/Qwen3-ForcedAligner-0.6B",
        "c7cbfc2048c462b0d63a45797104fc9db3ad62b7",
        ROOT / "models" / "Qwen3-ForcedAligner-0.6B",
    ),
)


if __name__ == "__main__":
    for model_id, revision, target in MODELS:
        target.mkdir(parents=True, exist_ok=True)
        snapshot_download(
            repo_id=model_id,
            revision=revision,
            local_dir=target,
        )
        print(f"Downloaded {model_id}@{revision} to {target}")
