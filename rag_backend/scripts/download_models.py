"""Explicit model fetch utility. Runtime itself is strictly offline."""

from __future__ import annotations

import os
from pathlib import Path

from huggingface_hub import snapshot_download


ROOT = Path(__file__).resolve().parents[1]
MODEL_ID = os.getenv("EMBEDDING_MODEL_ID", "intfloat/multilingual-e5-small")
REVISION = os.getenv(
    "EMBEDDING_MODEL_REVISION",
    "614241f622f53c4eeff9890bdc4f31cfecc418b3",
)
TARGET = Path(
    os.getenv("EMBEDDING_MODEL_PATH", str(ROOT / "models" / "multilingual-e5-small"))
).resolve()


if __name__ == "__main__":
    TARGET.mkdir(parents=True, exist_ok=True)
    snapshot_download(
        repo_id=MODEL_ID,
        revision=REVISION,
        local_dir=TARGET,
    )
    print(f"Downloaded {MODEL_ID}@{REVISION} to {TARGET}")
