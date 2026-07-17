from __future__ import annotations

from sqlalchemy import delete, func, select

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.models import (
    CanonicalSnapshot,
    Entity,
    Episode,
    EventEntity,
    IngestionReceipt,
    Projection,
    QuestionRecord,
    ReviewItem,
    User,
)
from app.services.graph_store import delete_user_from_neo4j


def delete_user_data(user_id: str) -> dict[str, object]:
    with SessionLocal() as db:
        user = db.get(User, user_id)
        user_existed = user is not None
        episode_ids = (
            list(db.scalars(select(Episode.id).where(Episode.user_id == user_id)))
            if user_existed
            else []
        )
        counts: dict[str, int] = {
            "episodes": len(episode_ids),
            "questions": db.scalar(
                select(func.count()).select_from(QuestionRecord).where(
                    QuestionRecord.user_id == user_id
                )
            )
            or 0,
            "entities": db.scalar(
                select(func.count()).select_from(Entity).where(Entity.user_id == user_id)
            )
            or 0,
            "reviews": db.scalar(
                select(func.count()).select_from(ReviewItem).where(
                    ReviewItem.user_id == user_id
                )
            )
            or 0,
            "receipts": db.scalar(
                select(func.count()).select_from(IngestionReceipt).where(
                    IngestionReceipt.user_id == user_id
                )
            )
            or 0,
            "snapshots": db.scalar(
                select(func.count()).select_from(CanonicalSnapshot).where(
                    CanonicalSnapshot.user_id == user_id
                )
            )
            or 0,
        }
        if user_existed:
            if episode_ids:
                db.execute(delete(EventEntity).where(EventEntity.episode_id.in_(episode_ids)))
                db.execute(delete(Projection).where(Projection.episode_id.in_(episode_ids)))
                db.execute(delete(ReviewItem).where(ReviewItem.episode_id.in_(episode_ids)))
                db.execute(delete(Episode).where(Episode.id.in_(episode_ids)))
            db.execute(delete(QuestionRecord).where(QuestionRecord.user_id == user_id))
            db.execute(delete(Entity).where(Entity.user_id == user_id))
            db.execute(delete(IngestionReceipt).where(IngestionReceipt.user_id == user_id))
            db.execute(delete(CanonicalSnapshot).where(CanonicalSnapshot.user_id == user_id))
            db.delete(user)
            db.commit()

    neo4j_required = settings.neo4j_enabled
    neo4j_deleted = delete_user_from_neo4j(user_id) if neo4j_required else False

    return {
        "user_id": user_id,
        "sqlite_user_existed": user_existed,
        "sqlite_deleted": True,
        "neo4j_required": neo4j_required,
        "neo4j_deleted": neo4j_deleted,
        "complete": not neo4j_required or neo4j_deleted,
        "deleted": counts,
    }
