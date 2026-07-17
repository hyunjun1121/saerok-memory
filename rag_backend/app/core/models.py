from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    display_name: Mapped[str] = mapped_column(String)
    profile: Mapped[dict] = mapped_column(JSON)
    consent: Mapped[dict] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class QuestionRecord(Base):
    __tablename__ = "questions"

    # Deterministic hash of user + dataset + session + external question ID.
    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    dataset_id: Mapped[str] = mapped_column(String, index=True)
    external_question_id: Mapped[str] = mapped_column(String, index=True)
    session_id: Mapped[str] = mapped_column(String, index=True)
    session_date: Mapped[str] = mapped_column(String, index=True)
    domain: Mapped[str] = mapped_column(String)
    prompt: Mapped[str] = mapped_column(Text)
    response_type: Mapped[str] = mapped_column(String, index=True)
    scored: Mapped[bool] = mapped_column(Boolean)
    source_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload: Mapped[dict] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "dataset_id",
            "session_id",
            "external_question_id",
            name="uq_question_scope",
        ),
    )


class Episode(Base):
    """Searchable evidence document. One row per persisted response."""

    __tablename__ = "episodes"

    # Deterministic hash of user + dataset + session + question + response.
    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    dataset_id: Mapped[str] = mapped_column(String, index=True)
    session_id: Mapped[str] = mapped_column(String, index=True)
    question_record_id: Mapped[str | None] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), index=True, nullable=True
    )
    question_id: Mapped[str] = mapped_column(String, index=True)
    response_id: Mapped[str] = mapped_column(String, index=True)
    occurred_at: Mapped[str] = mapped_column(String, index=True)
    response_type: Mapped[str] = mapped_column(String, index=True)
    evidence_text: Mapped[str] = mapped_column(Text)
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_payload: Mapped[dict] = mapped_column(JSON)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    sensitive: Mapped[bool] = mapped_column(Boolean, default=False)
    embedding: Mapped[list] = mapped_column(JSON, default=list)
    embedding_model: Mapped[str] = mapped_column(String)
    embedding_revision: Mapped[str] = mapped_column(String)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "dataset_id",
            "session_id",
            "question_id",
            "response_id",
            name="uq_episode_scope",
        ),
    )


class Entity(Base):
    __tablename__ = "entities"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    entity_type: Mapped[str] = mapped_column(String, index=True)
    value: Mapped[str] = mapped_column(String, index=True)
    canonical_value: Mapped[str] = mapped_column(String, index=True)
    first_seen_at: Mapped[str] = mapped_column(String)
    last_seen_at: Mapped[str] = mapped_column(String)
    sensitive: Mapped[bool] = mapped_column(Boolean, default=False)

    __table_args__ = (
        UniqueConstraint(
            "user_id", "entity_type", "canonical_value", name="uq_entity_scope"
        ),
    )


class EventEntity(Base):
    __tablename__ = "event_entities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    episode_id: Mapped[str] = mapped_column(
        ForeignKey("episodes.id", ondelete="CASCADE"), index=True
    )
    entity_id: Mapped[str] = mapped_column(
        ForeignKey("entities.id", ondelete="CASCADE"), index=True
    )
    relation: Mapped[str] = mapped_column(String)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "episode_id", "entity_id", "relation", name="uq_event_entity"
        ),
    )


class Projection(Base):
    __tablename__ = "projections"

    episode_id: Mapped[str] = mapped_column(
        ForeignKey("episodes.id", ondelete="CASCADE"), primary_key=True
    )
    x: Mapped[float] = mapped_column(Float)
    y: Mapped[float] = mapped_column(Float)
    z: Mapped[float] = mapped_column(Float)
    method: Mapped[str] = mapped_column(String)
    model_version: Mapped[str] = mapped_column(String)


class ReviewItem(Base):
    __tablename__ = "review_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    episode_id: Mapped[str] = mapped_column(
        ForeignKey("episodes.id", ondelete="CASCADE"), index=True
    )
    reason: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="open")
    details: Mapped[dict] = mapped_column(JSON, default=dict)

    __table_args__ = (
        UniqueConstraint("episode_id", "reason", name="uq_review_reason"),
    )


class IngestionReceipt(Base):
    __tablename__ = "ingestion_receipts"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    dataset_id: Mapped[str] = mapped_column(String, index=True)
    idempotency_key: Mapped[str] = mapped_column(String)
    content_hash_header: Mapped[str | None] = mapped_column(String, nullable=True)
    body_sha256: Mapped[str] = mapped_column(String)
    result: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        UniqueConstraint(
            "user_id", "dataset_id", "idempotency_key", name="uq_ingestion_scope"
        ),
    )


class CanonicalSnapshot(Base):
    """Immutable structural copy of one canonical JSON snapshot."""

    __tablename__ = "canonical_snapshots"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    dataset_id: Mapped[str] = mapped_column(String, index=True)
    body_sha256: Mapped[str] = mapped_column(String(64), index=True)
    content_hash_header: Mapped[str | None] = mapped_column(String, nullable=True)
    payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        UniqueConstraint(
            "user_id", "dataset_id", "body_sha256", name="uq_canonical_snapshot"
        ),
    )
