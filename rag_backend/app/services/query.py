from __future__ import annotations

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.models import (
    CanonicalSnapshot,
    Entity,
    Episode,
    EventEntity,
    Projection,
    ReviewItem,
)
from app.services.embedding import cosine, get_embedding_service


def _entity_rows(db, episode_id: str):
    return db.execute(
        select(EventEntity, Entity)
        .join(Entity, Entity.id == EventEntity.entity_id)
        .where(EventEntity.episode_id == episode_id)
    ).all()


def timeline(user_id: str) -> list[dict]:
    with SessionLocal() as db:
        episodes = list(
            db.scalars(
                select(Episode)
                .where(Episode.user_id == user_id)
                .order_by(Episode.occurred_at, Episode.id)
            )
        )
        return [
            {
                "episode_id": episode.id,
                "dataset_id": episode.dataset_id,
                "session_id": episode.session_id,
                "question_id": episode.question_id,
                "response_id": episode.response_id,
                "response_type": episode.response_type,
                "date": episode.occurred_at,
                "evidence_text": episode.evidence_text,
                "transcript": episode.transcript,
                "confidence": episode.confidence,
                "sensitive": episode.sensitive,
                "entities": [
                    {
                        "type": entity.entity_type,
                        "value": entity.value,
                        "relation": link.relation,
                    }
                    for link, entity in _entity_rows(db, episode.id)
                ],
            }
            for episode in episodes
        ]


def graph(user_id: str) -> dict[str, list[dict]]:
    with SessionLocal() as db:
        episodes = list(db.scalars(select(Episode).where(Episode.user_id == user_id)))
        entities = list(db.scalars(select(Entity).where(Entity.user_id == user_id)))
        episode_ids = [episode.id for episode in episodes]
        links = (
            list(db.scalars(select(EventEntity).where(EventEntity.episode_id.in_(episode_ids))))
            if episode_ids
            else []
        )
        return {
            "nodes": [
                {
                    "id": episode.id,
                    "label": episode.occurred_at,
                    "type": "Episode",
                    "response_type": episode.response_type,
                    "date": episode.occurred_at,
                    "text": episode.evidence_text,
                    "transcript": episode.transcript,
                    "sensitive": episode.sensitive,
                }
                for episode in episodes
            ]
            + [
                {
                    "id": entity.id,
                    "label": entity.value,
                    "type": entity.entity_type,
                    "date": entity.last_seen_at,
                    "sensitive": entity.sensitive,
                }
                for entity in entities
            ],
            "links": [
                {
                    "source": link.episode_id,
                    "target": link.entity_id,
                    "relation": link.relation,
                    "kind": "factual",
                    "confidence": link.confidence,
                }
                for link in links
            ],
        }


def galaxy(
    user_id: str,
    similarity_threshold: float = 0.15,
    top_k: int = 3,
) -> dict[str, list[dict]]:
    with SessionLocal() as db:
        episodes = list(
            db.scalars(
                select(Episode)
                .where(Episode.user_id == user_id)
                .order_by(Episode.occurred_at, Episode.id)
            )
        )
        projections = {
            projection.episode_id: projection
            for projection in db.scalars(
                select(Projection).where(
                    Projection.episode_id.in_([episode.id for episode in episodes])
                )
            )
        }
        nodes = []
        for episode in episodes:
            projection = projections.get(episode.id)
            nodes.append(
                {
                    "id": episode.id,
                    "label": episode.occurred_at if episode.response_type != "profile" else "초기 프로필",
                    "type": "Episode",
                    "response_type": episode.response_type,
                    "date": episode.occurred_at,
                    "text": episode.evidence_text,
                    "transcript": episode.transcript,
                    "confidence": episode.confidence,
                    "sensitive": episode.sensitive,
                    "fx": projection.x if projection else None,
                    "fy": projection.y if projection else None,
                    "fz": projection.z if projection else None,
                }
            )
        links: list[dict] = []
        for index, episode in enumerate(episodes):
            scored: list[tuple[float, str]] = []
            for other_index, other in enumerate(episodes):
                if index == other_index:
                    continue
                score = cosine(episode.embedding, other.embedding)
                if score >= similarity_threshold:
                    scored.append((score, other.id))
            for score, target in sorted(scored, reverse=True)[:top_k]:
                if episode.id < target:
                    links.append(
                        {
                            "source": episode.id,
                            "target": target,
                            "relation": "SEMANTIC_SIMILARITY",
                            "kind": "semantic",
                            "score": round(score, 4),
                        }
                    )
        return {"nodes": nodes, "links": links}


def evidence(user_id: str, episode_id: str) -> dict | None:
    with SessionLocal() as db:
        episode = db.get(Episode, episode_id)
        if episode is None or episode.user_id != user_id:
            return None
        return {
            "episode_id": episode.id,
            "dataset_id": episode.dataset_id,
            "session_id": episode.session_id,
            "question_id": episode.question_id,
            "response_id": episode.response_id,
            "response_type": episode.response_type,
            "date": episode.occurred_at,
            "evidence_text": episode.evidence_text,
            "transcript": episode.transcript,
            "confidence": episode.confidence,
            "sensitive": episode.sensitive,
            "embedding_model": episode.embedding_model,
            "embedding_revision": episode.embedding_revision,
            "entities": [
                {
                    "type": entity.entity_type,
                    "value": entity.value,
                    "relation": link.relation,
                }
                for link, entity in _entity_rows(db, episode.id)
            ],
            "raw_payload": episode.raw_payload,
        }


def review_queue(user_id: str) -> list[dict]:
    with SessionLocal() as db:
        rows = list(
            db.scalars(
                select(ReviewItem)
                .where(ReviewItem.user_id == user_id)
                .order_by(ReviewItem.id.desc())
            )
        )
        return [
            {
                "id": row.id,
                "episode_id": row.episode_id,
                "reason": row.reason,
                "status": row.status,
                "details": row.details,
            }
            for row in rows
        ]


def canonical_snapshots(user_id: str) -> list[dict]:
    with SessionLocal() as db:
        rows = list(
            db.scalars(
                select(CanonicalSnapshot)
                .where(CanonicalSnapshot.user_id == user_id)
                .order_by(CanonicalSnapshot.created_at, CanonicalSnapshot.id)
            )
        )
        return [
            {
                "snapshot_id": row.id,
                "dataset_id": row.dataset_id,
                "body_sha256": row.body_sha256,
                "content_hash": row.content_hash_header,
                "created_at": row.created_at.isoformat(),
            }
            for row in rows
        ]


def canonical_snapshot(user_id: str, snapshot_id: str) -> dict | None:
    with SessionLocal() as db:
        row = db.get(CanonicalSnapshot, snapshot_id)
        if row is None or row.user_id != user_id:
            return None
        return {
            "snapshot_id": row.id,
            "dataset_id": row.dataset_id,
            "body_sha256": row.body_sha256,
            "content_hash": row.content_hash_header,
            "created_at": row.created_at.isoformat(),
            "payload": row.payload,
        }


def semantic_search(
    user_id: str,
    text: str,
    top_k: int = 8,
    start_date: str | None = None,
    end_date: str | None = None,
    include_sensitive: bool = False,
) -> list[tuple[float, Episode]]:
    embedder = get_embedding_service()
    query_vector = embedder.embed_query(text)
    with SessionLocal() as db:
        statement = select(Episode).where(
            Episode.user_id == user_id,
            Episode.embedding_model == embedder.model_id,
            Episode.embedding_revision == embedder.revision,
        )
        if not include_sensitive:
            statement = statement.where(Episode.sensitive.is_(False))
        if start_date:
            statement = statement.where(Episode.occurred_at >= start_date)
        if end_date:
            statement = statement.where(Episode.occurred_at <= end_date)
        episodes = list(db.scalars(statement))
        scored = [(cosine(query_vector, episode.embedding), episode) for episode in episodes]
        return sorted(scored, key=lambda value: value[0], reverse=True)[:top_k]
