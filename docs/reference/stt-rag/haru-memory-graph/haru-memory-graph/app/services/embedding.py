import hashlib
import numpy as np
from app.core.config import settings

_model = None

def _hash_embedding(text: str, dim: int) -> list[float]:
    vec = np.zeros(dim, dtype=np.float32)
    tokens = [t for t in text.lower().replace(".", " ").replace(",", " ").split() if t]
    if not tokens:
        return vec.tolist()
    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        idx = int.from_bytes(digest[:4], "little") % dim
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        vec[idx] += sign
    norm = float(np.linalg.norm(vec))
    if norm:
        vec /= norm
    return vec.tolist()

def embed_text(text: str) -> list[float]:
    global _model
    if settings.embedding_backend == "sentence_transformers":
        try:
            from sentence_transformers import SentenceTransformer
            if _model is None:
                _model = SentenceTransformer(
                    settings.embedding_model,
                    cache_folder=settings.model_cache_dir
                )
            arr = _model.encode([f"passage: {text}"], normalize_embeddings=True)[0]
            return arr.astype(float).tolist()
        except Exception:
            pass
    return _hash_embedding(text, settings.embedding_dim)

def cosine(a: list[float], b: list[float]) -> float:
    av, bv = np.asarray(a, dtype=float), np.asarray(b, dtype=float)
    denom = np.linalg.norm(av) * np.linalg.norm(bv)
    return float(np.dot(av, bv) / denom) if denom else 0.0
