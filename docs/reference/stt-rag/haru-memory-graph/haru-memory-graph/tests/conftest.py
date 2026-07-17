from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import os
os.environ["DATABASE_URL"] = "sqlite:///./data/test_haru.db"

import pytest
from pathlib import Path
from app.core.database import init_db, Base, engine

@pytest.fixture(scope="session", autouse=True)
def setup_db():
    p = Path("data/test_haru.db")
    if p.exists():
        p.unlink()
    Base.metadata.drop_all(bind=engine)
    init_db()
    yield
    Base.metadata.drop_all(bind=engine)
    if p.exists():
        p.unlink()
