from datetime import datetime
from sqlalchemy import String, Text, Float, Boolean, DateTime, ForeignKey, Integer, JSON, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    display_name: Mapped[str] = mapped_column(String)
    profile: Mapped[dict] = mapped_column(JSON)
    consent: Mapped[dict] = mapped_column(JSON)

class Episode(Base):
    __tablename__ = "episodes"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    session_id: Mapped[str] = mapped_column(String, index=True)
    question_id: Mapped[str] = mapped_column(String)
    occurred_at: Mapped[str] = mapped_column(String, index=True)
    transcript: Mapped[str] = mapped_column(Text)
    raw_payload: Mapped[dict] = mapped_column(JSON)
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    sensitive: Mapped[bool] = mapped_column(Boolean, default=False)
    embedding: Mapped[list] = mapped_column(JSON, default=list)

class Entity(Base):
    __tablename__ = "entities"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    entity_type: Mapped[str] = mapped_column(String, index=True)
    value: Mapped[str] = mapped_column(String, index=True)
    canonical_value: Mapped[str] = mapped_column(String, index=True)
    first_seen_at: Mapped[str] = mapped_column(String)
    last_seen_at: Mapped[str] = mapped_column(String)
    sensitive: Mapped[bool] = mapped_column(Boolean, default=False)

    __table_args__ = (UniqueConstraint("user_id", "entity_type", "canonical_value"),)

class EventEntity(Base):
    __tablename__ = "event_entities"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    episode_id: Mapped[str] = mapped_column(ForeignKey("episodes.id"), index=True)
    entity_id: Mapped[str] = mapped_column(ForeignKey("entities.id"), index=True)
    relation: Mapped[str] = mapped_column(String)
    confidence: Mapped[float] = mapped_column(Float, default=1.0)

    __table_args__ = (UniqueConstraint("episode_id", "entity_id", "relation"),)

class QuestionRecord(Base):
    __tablename__ = "questions"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    session_id: Mapped[str] = mapped_column(String, index=True)
    session_date: Mapped[str] = mapped_column(String, index=True)
    domain: Mapped[str] = mapped_column(String)
    prompt: Mapped[str] = mapped_column(Text)
    response_type: Mapped[str] = mapped_column(String)
    scored: Mapped[bool] = mapped_column(Boolean)
    source_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload: Mapped[dict] = mapped_column(JSON)

class Projection(Base):
    __tablename__ = "projections"
    episode_id: Mapped[str] = mapped_column(ForeignKey("episodes.id"), primary_key=True)
    x: Mapped[float] = mapped_column(Float)
    y: Mapped[float] = mapped_column(Float)
    z: Mapped[float] = mapped_column(Float)
    method: Mapped[str] = mapped_column(String)
    model_version: Mapped[str] = mapped_column(String)

class ReviewItem(Base):
    __tablename__ = "review_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    episode_id: Mapped[str] = mapped_column(ForeignKey("episodes.id"), index=True)
    reason: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="open")
    details: Mapped[dict] = mapped_column(JSON, default=dict)
