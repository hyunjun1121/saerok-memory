import numpy as np
from sqlalchemy import select
from app.core.database import SessionLocal
from app.core.models import Episode, Projection
from app.core.config import settings

def refresh_projection(user_id: str | None = None) -> dict:
    with SessionLocal() as db:
        stmt = select(Episode).order_by(Episode.occurred_at, Episode.id)
        if user_id:
            stmt = stmt.where(Episode.user_id == user_id)
        episodes = list(db.scalars(stmt))
        if not episodes:
            return {"count": 0, "method": "none"}

        X = np.asarray([e.embedding for e in episodes], dtype=float)
        n = len(episodes)
        method = "pca"
        if n >= 4:
            try:
                import umap
                reducer = umap.UMAP(
                    n_components=3,
                    n_neighbors=min(5, n - 1),
                    min_dist=0.15,
                    metric="cosine",
                    random_state=42,
                )
                coords = reducer.fit_transform(X)
                method = "umap"
            except Exception:
                coords = None
        else:
            coords = None

        if coords is None:
            from sklearn.decomposition import PCA
            comps = min(3, X.shape[1], n)
            coords = PCA(n_components=comps, random_state=42).fit_transform(X)
            if comps < 3:
                coords = np.pad(coords, ((0,0),(0,3-comps)))

        for ep, xyz in zip(episodes, coords):
            row = db.get(Projection, ep.id)
            values = dict(
                x=float(xyz[0]), y=float(xyz[1]), z=float(xyz[2]),
                method=method, model_version=f"{settings.embedding_backend}:{settings.embedding_model}"
            )
            if row:
                for k, v in values.items():
                    setattr(row, k, v)
            else:
                db.add(Projection(episode_id=ep.id, **values))
        db.commit()
        return {"count": n, "method": method}
