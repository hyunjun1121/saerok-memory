from __future__ import annotations

from typing import Any

from sqlalchemy import select

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.models import Entity, Episode, EventEntity, User

try:
    from neo4j import GraphDatabase
except ImportError:  # Optional dependency at runtime.
    GraphDatabase = None


class Neo4jStore:
    def __init__(self) -> None:
        self.driver = None
        self.error: str | None = None
        if not settings.neo4j_enabled:
            self.error = "disabled"
            return
        if GraphDatabase is None:
            self.error = "neo4j driver is not installed"
            return
        try:
            self.driver = GraphDatabase.driver(
                settings.neo4j_uri,
                auth=(settings.neo4j_user, settings.neo4j_password),
            )
            self.driver.verify_connectivity()
        except Exception as exc:
            self.driver = None
            self.error = f"{type(exc).__name__}: {exc}"

    @property
    def available(self) -> bool:
        return self.driver is not None

    def close(self) -> None:
        if self.driver is not None:
            self.driver.close()

    def ensure_constraints(self) -> None:
        if self.driver is None:
            return
        statements = (
            "CREATE CONSTRAINT user_id IF NOT EXISTS FOR (n:User) REQUIRE n.id IS UNIQUE",
            "CREATE CONSTRAINT episode_id IF NOT EXISTS FOR (n:Episode) REQUIRE n.id IS UNIQUE",
            "CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (n:Entity) REQUIRE n.id IS UNIQUE",
        )
        with self.driver.session() as session:
            for statement in statements:
                session.run(statement).consume()

    def replace_user_graph(
        self,
        user: dict[str, Any],
        episodes: list[dict[str, Any]],
    ) -> None:
        if self.driver is None:
            raise RuntimeError(self.error or "neo4j unavailable")
        self.ensure_constraints()
        with self.driver.session() as session:
            session.run(
                "MATCH (u:User {id:$user_id})-[:HAS_EPISODE]->(e) DETACH DELETE e",
                user_id=user["id"],
            ).consume()
            session.run(
                "MATCH (n:Entity {user_id:$user_id}) DETACH DELETE n",
                user_id=user["id"],
            ).consume()
            session.run(
                """
                MERGE (u:User {id:$id})
                SET u.display_name=$display_name, u.updated_at=$updated_at
                """,
                **user,
            ).consume()
            for episode in episodes:
                entities = episode.pop("entities")
                session.run(
                    """
                    MATCH (u:User {id:$user_id})
                    MERGE (e:Episode {id:$id})
                    SET e.dataset_id=$dataset_id, e.session_id=$session_id,
                        e.question_id=$question_id, e.response_id=$response_id,
                        e.occurred_at=$occurred_at, e.response_type=$response_type,
                        e.evidence_text=$evidence_text, e.transcript=$transcript,
                        e.confidence=$confidence, e.sensitive=$sensitive,
                        e.embedding_model=$embedding_model,
                        e.embedding_revision=$embedding_revision
                    MERGE (u)-[:HAS_EPISODE]->(e)
                    """,
                    **episode,
                ).consume()
                for entity in entities:
                    session.run(
                        """
                        MATCH (e:Episode {id:$episode_id})
                        MERGE (n:Entity {id:$entity_id})
                        SET n.user_id=$user_id, n.entity_type=$entity_type,
                            n.value=$value, n.canonical_value=$canonical_value,
                            n.sensitive=$sensitive
                        MERGE (e)-[r:MENTIONS {relation:$relation}]->(n)
                        SET r.confidence=$confidence
                        """,
                        episode_id=episode["id"],
                        user_id=episode["user_id"],
                        **entity,
                    ).consume()

    def delete_user(self, user_id: str) -> None:
        if self.driver is None:
            raise RuntimeError(self.error or "neo4j unavailable")
        with self.driver.session() as session:
            session.run(
                "MATCH (u:User {id:$user_id})-[:HAS_EPISODE]->(e) DETACH DELETE e",
                user_id=user_id,
            ).consume()
            session.run(
                "MATCH (n:Entity {user_id:$user_id}) DETACH DELETE n",
                user_id=user_id,
            ).consume()
            session.run(
                "MATCH (u:User {id:$user_id}) DETACH DELETE u",
                user_id=user_id,
            ).consume()


def neo4j_health() -> tuple[bool, str | None]:
    store = Neo4jStore()
    ready, error = store.available, store.error
    store.close()
    return ready, error


def sync_user_to_neo4j(user_id: str) -> bool:
    if not settings.neo4j_enabled:
        return False
    store = Neo4jStore()
    if not store.available:
        store.close()
        return False
    try:
        with SessionLocal() as db:
            user = db.get(User, user_id)
            if user is None:
                return False
            episode_rows = list(
                db.scalars(
                    select(Episode)
                    .where(Episode.user_id == user_id)
                    .order_by(Episode.occurred_at, Episode.id)
                )
            )
            episodes: list[dict[str, Any]] = []
            for episode in episode_rows:
                links = db.execute(
                    select(EventEntity, Entity)
                    .join(Entity, Entity.id == EventEntity.entity_id)
                    .where(EventEntity.episode_id == episode.id)
                ).all()
                episodes.append(
                    {
                        "id": episode.id,
                        "user_id": episode.user_id,
                        "dataset_id": episode.dataset_id,
                        "session_id": episode.session_id,
                        "question_id": episode.question_id,
                        "response_id": episode.response_id,
                        "occurred_at": episode.occurred_at,
                        "response_type": episode.response_type,
                        "evidence_text": episode.evidence_text,
                        "transcript": episode.transcript,
                        "confidence": episode.confidence,
                        "sensitive": episode.sensitive,
                        "embedding_model": episode.embedding_model,
                        "embedding_revision": episode.embedding_revision,
                        "entities": [
                            {
                                "entity_id": entity.id,
                                "entity_type": entity.entity_type,
                                "value": entity.value,
                                "canonical_value": entity.canonical_value,
                                "sensitive": entity.sensitive,
                                "relation": link.relation,
                                "confidence": link.confidence,
                            }
                            for link, entity in links
                        ],
                    }
                )
            store.replace_user_graph(
                {
                    "id": user.id,
                    "display_name": user.display_name,
                    "updated_at": user.updated_at.isoformat(),
                },
                episodes,
            )
        return True
    except Exception:
        return False
    finally:
        store.close()


def delete_user_from_neo4j(user_id: str) -> bool:
    if not settings.neo4j_enabled:
        return False
    store = Neo4jStore()
    if not store.available:
        store.close()
        return False
    try:
        store.delete_user(user_id)
        return True
    except Exception:
        return False
    finally:
        store.close()
