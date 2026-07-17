from __future__ import annotations

import numpy as np

from app.services.embedding import EmbeddingService, EmbeddingUnavailable


class RecordingEncoder:
    def __init__(self):
        self.inputs: list[str] = []

    def encode(self, sentences: list[str], *, normalize_embeddings: bool):
        self.inputs.extend(sentences)
        return np.asarray([[1.0, 0.0, 0.0, 0.0] for _ in sentences])


def test_e5_uses_distinct_query_and_passage_prefixes(tmp_path):
    encoder = RecordingEncoder()
    service = EmbeddingService(
        model_path=tmp_path,
        model_id="fake/e5",
        revision="revision",
        dimension=4,
        encoder=encoder,
    )
    service.embed_passage("어제 시장에 갔어요")
    service.embed_query("시장 방문")
    assert encoder.inputs == [
        "passage: 어제 시장에 갔어요",
        "query: 시장 방문",
    ]


def test_missing_local_model_is_not_replaced_by_hash(tmp_path):
    service = EmbeddingService(
        model_path=tmp_path / "missing",
        model_id="fake/e5",
        revision="revision",
        dimension=4,
    )
    service.load()
    assert service.ready is False
    assert "local embedding model missing" in (service.health().error or "")
    try:
        service.embed_query("질문")
    except EmbeddingUnavailable:
        pass
    else:
        raise AssertionError("unavailable model must not silently hash")


def test_missing_checkpoint_revision_metadata_fails_before_model_load(tmp_path):
    model_path = tmp_path / "e5"
    model_path.mkdir()
    (model_path / "config.json").write_text("{}", encoding="utf-8")
    service = EmbeddingService(
        model_path=model_path,
        model_id="fake/e5",
        revision="expected-revision",
        dimension=4,
    )

    service.load()

    health = service.health()
    assert health.ready is False
    assert health.checkpoint_revision is None
    assert "checkpoint revision metadata missing" in (health.error or "")


def test_checkpoint_revision_mismatch_fails_before_model_load(tmp_path):
    model_path = tmp_path / "e5"
    metadata_dir = model_path / ".cache" / "huggingface" / "download"
    metadata_dir.mkdir(parents=True)
    (model_path / "config.json").write_text("{}", encoding="utf-8")
    (metadata_dir / "config.json.metadata").write_text(
        "wrong-revision\nblob-id\ntimestamp\n",
        encoding="utf-8",
    )
    service = EmbeddingService(
        model_path=model_path,
        model_id="fake/e5",
        revision="expected-revision",
        dimension=4,
    )

    service.load()

    health = service.health()
    assert health.ready is False
    assert health.checkpoint_revision == "wrong-revision"
    assert "checkpoint revision mismatch" in (health.error or "")
