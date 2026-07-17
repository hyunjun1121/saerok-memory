from __future__ import annotations

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings


connect_args = (
    {"check_same_thread": False}
    if settings.database_url.startswith("sqlite")
    else {}
)
engine = create_engine(settings.database_url, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)


if settings.database_url.startswith("sqlite"):
    @event.listens_for(Engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    from app.core import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    if settings.database_url.startswith("sqlite"):
        _migrate_sqlite_columns()


def _migrate_sqlite_columns() -> None:
    """Small additive migration bridge for pre-hardening local databases.

    SQLite deployments are local-only. Additive columns keep existing row IDs
    and data intact while new databases continue to come from SQLAlchemy
    metadata. Destructive or semantic migrations remain explicit work.
    """

    inspector = inspect(engine)
    migrations = {
        "episodes": {
            "source_hash": "ALTER TABLE episodes ADD COLUMN source_hash VARCHAR(64)",
        },
        "canonical_snapshots": {
            "raw_payload_gzip": "ALTER TABLE canonical_snapshots ADD COLUMN raw_payload_gzip BLOB",
            "raw_size_bytes": "ALTER TABLE canonical_snapshots ADD COLUMN raw_size_bytes INTEGER",
            "raw_sha256": "ALTER TABLE canonical_snapshots ADD COLUMN raw_sha256 VARCHAR(64)",
            "storage_format": (
                "ALTER TABLE canonical_snapshots ADD COLUMN storage_format "
                "VARCHAR(32) NOT NULL DEFAULT 'legacy_structural'"
            ),
        },
        "deletion_tombstones": {
            "active": (
                "ALTER TABLE deletion_tombstones ADD COLUMN active "
                "BOOLEAN NOT NULL DEFAULT 1"
            ),
        },
    }
    with engine.begin() as connection:
        for table_name, additions in migrations.items():
            if not inspector.has_table(table_name):
                continue
            existing = {column["name"] for column in inspector.get_columns(table_name)}
            for column_name, statement in additions.items():
                if column_name not in existing:
                    connection.execute(text(statement))
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_episode_user_date "
                "ON episodes (user_id, occurred_at)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_episode_search_scope "
                "ON episodes (user_id, embedding_model, embedding_revision, sensitive)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_snapshot_user_created "
                "ON canonical_snapshots (user_id, created_at)"
            )
        )
