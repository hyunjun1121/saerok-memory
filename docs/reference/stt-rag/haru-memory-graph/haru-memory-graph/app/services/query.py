from collections import defaultdict
from sqlalchemy import select
from app.core.database import SessionLocal
from app.core.models import Episode, Entity, EventEntity, Projection, QuestionRecord, ReviewItem
from app.services.embedding import cosine, embed_text

def timeline(user_id: str):
    with SessionLocal() as db:
        episodes = db.scalars(
            select(Episode).where(Episode.user_id == user_id).order_by(Episode.occurred_at)
        ).all()
        result = []
        for ep in episodes:
            links = db.execute(
                select(EventEntity, Entity)
                .join(Entity, Entity.id == EventEntity.entity_id)
                .where(EventEntity.episode_id == ep.id)
            ).all()
            result.append({
                "episode_id": ep.id,
                "date": ep.occurred_at,
                "transcript": ep.transcript,
                "confidence": ep.confidence,
                "sensitive": ep.sensitive,
                "entities": [
                    {"type": ent.entity_type, "value": ent.value, "relation": ee.relation}
                    for ee, ent in links
                ]
            })
        return result

def graph(user_id: str):
    with SessionLocal() as db:
        episodes = db.scalars(select(Episode).where(Episode.user_id == user_id)).all()
        nodes, links = [], []
        for ep in episodes:
            nodes.append({
                "id": ep.id, "label": ep.occurred_at, "type": "Episode",
                "date": ep.occurred_at, "text": ep.transcript,
                "sensitive": ep.sensitive
            })
        ents = db.scalars(select(Entity).where(Entity.user_id == user_id)).all()
        for ent in ents:
            nodes.append({
                "id": ent.id, "label": ent.value, "type": ent.entity_type,
                "date": ent.last_seen_at, "sensitive": ent.sensitive
            })
        episode_ids = [e.id for e in episodes]
        if episode_ids:
            rows = db.scalars(select(EventEntity).where(EventEntity.episode_id.in_(episode_ids))).all()
            for r in rows:
                links.append({
                    "source": r.episode_id, "target": r.entity_id,
                    "relation": r.relation, "kind": "factual",
                    "confidence": r.confidence
                })
        return {"nodes": nodes, "links": links}

def galaxy(user_id: str, similarity_threshold: float = 0.15, top_k: int = 3):
    with SessionLocal() as db:
        episodes = db.scalars(
            select(Episode).where(Episode.user_id == user_id).order_by(Episode.occurred_at)
        ).all()
        projections = {
            p.episode_id: p for p in db.scalars(select(Projection)).all()
        }
        nodes = []
        for ep in episodes:
            p = projections.get(ep.id)
            nodes.append({
                "id": ep.id,
                "label": ep.occurred_at if ep.session_id != "PROFILE" else "초기 프로필",
                "type": "Episode",
                "date": ep.occurred_at,
                "text": ep.transcript,
                "confidence": ep.confidence,
                "sensitive": ep.sensitive,
                "fx": p.x if p else None,
                "fy": p.y if p else None,
                "fz": p.z if p else None,
            })
        links = []
        for i, ep in enumerate(episodes):
            scored = []
            for j, other in enumerate(episodes):
                if i == j:
                    continue
                score = cosine(ep.embedding, other.embedding)
                if score >= similarity_threshold:
                    scored.append((score, other.id))
            for score, target in sorted(scored, reverse=True)[:top_k]:
                if ep.id < target:
                    links.append({
                        "source": ep.id, "target": target,
                        "relation": "SEMANTIC_SIMILARITY",
                        "kind": "semantic", "score": round(score, 4)
                    })
        return {"nodes": nodes, "links": links}

def evidence(user_id: str, episode_id: str):
    with SessionLocal() as db:
        ep = db.get(Episode, episode_id)
        if not ep or ep.user_id != user_id:
            return None
        rows = db.execute(
            select(EventEntity, Entity)
            .join(Entity, Entity.id == EventEntity.entity_id)
            .where(EventEntity.episode_id == episode_id)
        ).all()
        return {
            "episode_id": ep.id, "date": ep.occurred_at,
            "transcript": ep.transcript, "confidence": ep.confidence,
            "sensitive": ep.sensitive,
            "entities": [
                {"type": e.entity_type, "value": e.value, "relation": rel.relation}
                for rel, e in rows
            ],
            "raw_payload": ep.raw_payload
        }

def review_queue(user_id: str):
    with SessionLocal() as db:
        rows = db.scalars(
            select(ReviewItem).where(ReviewItem.user_id == user_id).order_by(ReviewItem.id.desc())
        ).all()
        return [
            {
                "id": r.id, "episode_id": r.episode_id, "reason": r.reason,
                "status": r.status, "details": r.details
            } for r in rows
        ]

def semantic_search(user_id: str, text: str, top_k: int = 8, start_date=None, end_date=None):
    q = embed_text(text)
    with SessionLocal() as db:
        stmt = select(Episode).where(Episode.user_id == user_id)
        if start_date:
            stmt = stmt.where(Episode.occurred_at >= start_date)
        if end_date:
            stmt = stmt.where(Episode.occurred_at <= end_date)
        episodes = db.scalars(stmt).all()
        scored = [(cosine(q, ep.embedding), ep) for ep in episodes]
        return sorted(scored, key=lambda x: x[0], reverse=True)[:top_k]
