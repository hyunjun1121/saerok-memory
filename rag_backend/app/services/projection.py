from __future__ import annotations

import numpy as np
from sqlalchemy import delete, select

from app.core.database import SessionLocal
from app.core.models import Episode, Projection
from app.services.embedding import get_embedding_service


def refresh_projection(user_id: str | None = None) -> dict[str, object]:
    embedder = get_embedding_service()
    with SessionLocal() as db:
        statement = select(Episode).order_by(Episode.occurred_at, Episode.id)
        if user_id:
            statement = statement.where(Episode.user_id == user_id)
        episodes = list(db.scalars(statement))
        if not episodes:
            return {"count": 0, "method": "none"}

        matrix = np.asarray([episode.embedding for episode in episodes], dtype=float)
        count = len(episodes)
        coordinates = None
        method = "pca"
        if count >= 4:
            try:
                import umap

                reducer = umap.UMAP(
                    n_components=3,
                    n_neighbors=min(5, count - 1),
                    min_dist=0.15,
                    metric="cosine",
                    random_state=42,
                )
                coordinates = reducer.fit_transform(matrix)
                method = "umap"
            except Exception:
                coordinates = None
        if coordinates is None:
            from sklearn.decomposition import PCA

            components = min(3, matrix.shape[1], count)
            coordinates = PCA(n_components=components, random_state=42).fit_transform(matrix)
            if components < 3:
                coordinates = np.pad(coordinates, ((0, 0), (0, 3 - components)))

        seen: set[str] = set()
        for episode, xyz in zip(episodes, coordinates):
            seen.add(episode.id)
            row = db.get(Projection, episode.id)
            values = {
                "x": float(xyz[0]),
                "y": float(xyz[1]),
                "z": float(xyz[2]),
                "method": method,
                "model_version": embedder.model_key,
            }
            if row is None:
                db.add(Projection(episode_id=episode.id, **values))
            else:
                for key, value in values.items():
                    setattr(row, key, value)
        if user_id:
            user_episode_ids = select(Episode.id).where(Episode.user_id == user_id)
            db.execute(
                delete(Projection).where(
                    Projection.episode_id.in_(user_episode_ids),
                    Projection.episode_id.not_in(seen),
                )
            )
        db.commit()
        return {"count": count, "method": method}
