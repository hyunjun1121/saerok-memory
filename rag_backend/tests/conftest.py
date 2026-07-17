from __future__ import annotations

import atexit
import hashlib
import os
import shutil
import sys
import tempfile
from pathlib import Path

import numpy as np
import pytest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
TEST_DATABASE_DIR = Path(tempfile.mkdtemp(prefix="haru-rag-tests-"))
atexit.register(shutil.rmtree, TEST_DATABASE_DIR, True)
os.environ["DATABASE_URL"] = f"sqlite:///{(TEST_DATABASE_DIR / 'test_haru.db').as_posix()}"
os.environ["NEO4J_ENABLED"] = "false"
os.environ["RAG_API_TOKEN"] = "test-local-token"

from app.core.database import Base, engine, init_db  # noqa: E402
from app.services.embedding import EmbeddingService, set_embedding_service_for_tests  # noqa: E402


class FakeEncoder:
    def __init__(self) -> None:
        self.calls: list[str] = []
        self.batches: list[list[str]] = []

    def encode(self, sentences: list[str], *, normalize_embeddings: bool):
        self.batches.append(list(sentences))
        self.calls.extend(sentences)
        vectors = []
        for sentence in sentences:
            digest = hashlib.sha256(sentence.encode("utf-8")).digest()
            vector = np.asarray([float(value + 1) for value in digest[:8]], dtype=np.float32)
            if normalize_embeddings:
                vector /= np.linalg.norm(vector)
            vectors.append(vector)
        return np.asarray(vectors)


@pytest.fixture(autouse=True)
def isolated_database():
    Base.metadata.drop_all(bind=engine)
    init_db()
    fake_encoder = FakeEncoder()
    service = EmbeddingService(
        model_path=ROOT / "tests" / "fake-model",
        model_id="fake/e5",
        revision="test-revision",
        dimension=8,
        encoder=fake_encoder,
    )
    set_embedding_service_for_tests(service)
    yield service, fake_encoder
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(isolated_database):
    from fastapi.testclient import TestClient
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def seed_payload() -> dict:
    import json

    return json.loads(
        (ROOT / "data" / "haru_7day_admin_usage_records.json").read_text(encoding="utf-8")
    )


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {"Authorization": "Bearer test-local-token"}
