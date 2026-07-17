from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import init_db
from app.services.ingestion import ingest_seed_if_empty
from app.services.projection import refresh_projection

if __name__ == "__main__":
    init_db()
    result = ingest_seed_if_empty()
    refresh_projection()
    print(result)
