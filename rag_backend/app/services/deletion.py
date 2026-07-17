from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import delete, func, select

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.models import (
    CanonicalSnapshot,
    DeletionTombstone,
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
from app.core.user_locks import user_operation_lock


def delete_user_data(user_id: str) -> dict[str, object]:
    with user_operation_lock(user_id):
        return _delete_user_data_locked(user_id)


def _delete_user_data_locked(user_id: str) -> dict[str, object]:
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
        tombstone = db.get(DeletionTombstone, user_id)
        if tombstone is None:
            tombstone = DeletionTombstone(
                user_id=user_id,
                generation=1,
                active=True,
                deleted_at=datetime.now(timezone.utc),
            )
            db.add(tombstone)
        elif user_existed:
            tombstone.generation += 1
            tombstone.active = True
            tombstone.deleted_at = datetime.now(timezone.utc)
        else:
            tombstone.active = True
        db.commit()
        generation = tombstone.generation

    neo4j_required = settings.neo4j_enabled
    neo4j_deleted = delete_user_from_neo4j(user_id) if neo4j_required else False

    return {
        "user_id": user_id,
        "sqlite_user_existed": user_existed,
        "sqlite_deleted": True,
        "neo4j_required": neo4j_required,
        "neo4j_deleted": neo4j_deleted,
        "complete": not neo4j_required or neo4j_deleted,
        "generation": generation,
        "deleted": counts,
    }
