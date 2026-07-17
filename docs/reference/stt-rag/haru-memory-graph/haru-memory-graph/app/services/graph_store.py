try:
    from neo4j import GraphDatabase
except ImportError:
    GraphDatabase = None
from app.core.config import settings

class Neo4jStore:
    def __init__(self):
        self.driver = None
        if settings.neo4j_enabled and GraphDatabase is not None:
            try:
                self.driver = GraphDatabase.driver(
                    settings.neo4j_uri,
                    auth=(settings.neo4j_user, settings.neo4j_password)
                )
                self.driver.verify_connectivity()
            except Exception:
                self.driver = None

    @property
    def available(self) -> bool:
        return self.driver is not None

    def ensure_constraints(self):
        if not self.driver:
            return
        statements = [
            "CREATE CONSTRAINT user_id IF NOT EXISTS FOR (n:User) REQUIRE n.id IS UNIQUE",
            "CREATE CONSTRAINT episode_id IF NOT EXISTS FOR (n:Episode) REQUIRE n.id IS UNIQUE",
            "CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (n:Entity) REQUIRE n.id IS UNIQUE",
        ]
        with self.driver.session() as session:
            for q in statements:
                session.run(q)

    def upsert_user(self, user: dict):
        if not self.driver:
            return
        with self.driver.session() as s:
            s.run(
                "MERGE (u:User {id:$id}) SET u.display_name=$name, u.profile=$profile",
                id=user["id"], name=user["display_name"], profile=str(user["profile"])
            )

    def upsert_episode(self, ep: dict, entities: list[dict]):
        if not self.driver:
            return
        with self.driver.session() as s:
            s.run(
                """
                MATCH (u:User {id:$user_id})
                MERGE (e:Episode {id:$id})
                SET e.occurred_at=$occurred_at, e.transcript=$transcript,
                    e.confidence=$confidence, e.sensitive=$sensitive
                MERGE (u)-[:HAS_EPISODE]->(e)
                """,
                **ep
            )
            for ent in entities:
                s.run(
                    """
                    MATCH (e:Episode {id:$episode_id})
                    MERGE (n:Entity {id:$entity_id})
                    SET n.user_id=$user_id, n.entity_type=$entity_type,
                        n.value=$value, n.canonical_value=$canonical_value,
                        n.sensitive=$sensitive
                    MERGE (e)-[r:MENTIONS {relation:$relation}]->(n)
                    SET r.confidence=$confidence
                    """,
                    episode_id=ep["id"], user_id=ep["user_id"], **ent
                )

    def close(self):
        if self.driver:
            self.driver.close()
