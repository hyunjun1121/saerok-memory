from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

"""Optional model downloader. Model weights are intentionally not bundled."""
import os
from pathlib import Path

model_name = os.getenv("EMBEDDING_MODEL", "intfloat/multilingual-e5-small")
cache_dir = Path(os.getenv("MODEL_CACHE_DIR", "./models"))
cache_dir.mkdir(parents=True, exist_ok=True)

try:
    from sentence_transformers import SentenceTransformer
except ImportError as exc:
    raise SystemExit(
        "Install optional dependencies first: pip install -r requirements-models.txt"
    ) from exc

print(f"Downloading {model_name} into {cache_dir.resolve()}")
SentenceTransformer(model_name, cache_folder=str(cache_dir))
print("Done.")
