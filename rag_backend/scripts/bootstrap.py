from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import init_db
from app.services.ingestion import ingest_seed_if_empty
from app.services.embedding import get_embedding_service

if __name__ == "__main__":
    init_db()
    embedder = get_embedding_service()
    embedder.load()
    if not embedder.ready:
        raise SystemExit(embedder.health().error or "embedding model unavailable")
    result = ingest_seed_if_empty(embedder)
    print(result)
