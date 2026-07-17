from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Any, Protocol

import numpy as np

from app.core.config import settings


class EmbeddingUnavailable(RuntimeError):
    pass


class SentenceEncoder(Protocol):
    def encode(self, sentences: list[str], *, normalize_embeddings: bool) -> Any: ...


@dataclass(frozen=True)
class EmbeddingHealth:
    ready: bool
    backend: str
    model: str
    revision: str
    checkpoint_revision: str | None
    dimension: int
    model_path: str
    error: str | None


class EmbeddingService:
    """Offline E5 adapter. Production never falls back to hash embeddings."""

    def __init__(
        self,
        *,
        model_path: str | Path = settings.embedding_model_path,
        model_id: str = settings.embedding_model_id,
        revision: str = settings.embedding_model_revision,
        dimension: int = settings.embedding_dim,
        encoder: SentenceEncoder | None = None,
    ) -> None:
        self.model_path = Path(model_path).resolve()
        self.model_id = model_id
        self.revision = revision
        self.dimension = dimension
        self._encoder = encoder
        self._ready = encoder is not None
        self._checkpoint_revision: str | None = revision if encoder is not None else None
        self._error: str | None = None
        self._lock = Lock()

    @property
    def ready(self) -> bool:
        return self._ready

    @property
    def model_key(self) -> str:
        return f"{self.model_id}@{self.revision}"

    def load(self) -> None:
        if self._ready:
            return
        with self._lock:
            if self._ready:
                return
            try:
                self._checkpoint_revision = None
                if not (self.model_path / "config.json").is_file():
                    raise FileNotFoundError(f"local embedding model missing: {self.model_path}")
                metadata_path = (
                    self.model_path
                    / ".cache"
                    / "huggingface"
                    / "download"
                    / "config.json.metadata"
                )
                if not metadata_path.is_file():
                    raise FileNotFoundError(
                        "embedding checkpoint revision metadata missing: "
                        f"{metadata_path}"
                    )
                metadata_lines = metadata_path.read_text(encoding="utf-8").splitlines()
                if not metadata_lines or not metadata_lines[0].strip():
                    raise RuntimeError(
                        "embedding checkpoint revision metadata is empty: "
                        f"{metadata_path}"
                    )
                self._checkpoint_revision = metadata_lines[0].strip()
                if self._checkpoint_revision != self.revision:
                    raise RuntimeError(
                        "embedding checkpoint revision mismatch: "
                        f"expected={self.revision} actual={self._checkpoint_revision}"
                    )
                from sentence_transformers import SentenceTransformer

                self._encoder = SentenceTransformer(
                    str(self.model_path),
                    local_files_only=True,
                )
                probe = self._encode_prefixed("query", "준비 상태 확인")
                if len(probe) != self.dimension:
                    raise ValueError(
                        f"embedding dimension mismatch: expected {self.dimension}, got {len(probe)}"
                    )
                self._ready = True
                self._error = None
            except Exception as exc:
                self._encoder = None
                self._ready = False
                self._error = f"{type(exc).__name__}: {exc}"

    def health(self) -> EmbeddingHealth:
        return EmbeddingHealth(
            ready=self.ready,
            backend="sentence_transformers",
            model=self.model_id,
            revision=self.revision,
            checkpoint_revision=self._checkpoint_revision,
            dimension=self.dimension,
            model_path=str(self.model_path),
            error=self._error,
        )

    def _encode_prefixed(self, prefix: str, text: str) -> list[float]:
        if self._encoder is None:
            raise EmbeddingUnavailable(self._error or "embedding model is not loaded")
        value = str(text).strip()
        vectors = self._encoder.encode(
            [f"{prefix}: {value}"],
            normalize_embeddings=True,
        )
        vector = np.asarray(vectors[0], dtype=np.float32)
        if vector.ndim != 1 or not np.all(np.isfinite(vector)):
            raise EmbeddingUnavailable("embedding model returned an invalid vector")
        return vector.astype(float).tolist()

    def embed_passage(self, text: str) -> list[float]:
        if not self.ready:
            raise EmbeddingUnavailable(self._error or "embedding model is not ready")
        return self._encode_prefixed("passage", text)

    def embed_query(self, text: str) -> list[float]:
        if not self.ready:
            raise EmbeddingUnavailable(self._error or "embedding model is not ready")
        return self._encode_prefixed("query", text)


_service: EmbeddingService = EmbeddingService()


def get_embedding_service() -> EmbeddingService:
    return _service


def set_embedding_service_for_tests(service: EmbeddingService) -> None:
    global _service
    _service = service


def cosine(a: list[float], b: list[float]) -> float:
    av, bv = np.asarray(a, dtype=float), np.asarray(b, dtype=float)
    if av.shape != bv.shape:
        return 0.0
    denom = np.linalg.norm(av) * np.linalg.norm(bv)
    return float(np.dot(av, bv) / denom) if denom else 0.0
