from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


SERVICE_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MODEL_REVISION = "614241f622f53c4eeff9890bdc4f31cfecc418b3"


class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str = f"sqlite:///{(SERVICE_ROOT / 'data' / 'haru.db').as_posix()}"
    seed_json_path: str = str(SERVICE_ROOT / "data" / "haru_7day_admin_usage_records.json")

    neo4j_enabled: bool = False
    neo4j_uri: str = "bolt://127.0.0.1:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "haru-demo-password"

    embedding_backend: str = "sentence_transformers"
    embedding_model_id: str = "intfloat/multilingual-e5-small"
    embedding_model_path: str = str(SERVICE_ROOT / "models" / "multilingual-e5-small")
    embedding_model_revision: str = DEFAULT_MODEL_REVISION
    embedding_dim: int = 384

    min_question_confidence: float = 0.80
    allow_sensitive_question_generation: bool = False
    qa_min_similarity: float = 0.78
    max_json_bytes: int = 5 * 1024 * 1024

    # Empty means local ingest may run without a token. Evidence-bearing routes
    # remain closed until an explicit local token is configured.
    rag_api_token: str | None = None
    cors_origins: str = (
        "http://127.0.0.1:5173,http://localhost:5173,"
        "http://127.0.0.1:4173,http://localhost:4173"
    )

    model_config = SettingsConfigDict(
        env_file=str(SERVICE_ROOT / ".env"),
        env_prefix="",
        extra="ignore",
    )

    @property
    def allowed_cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def model_key(self) -> str:
        return f"{self.embedding_model_id}@{self.embedding_model_revision}"


settings = Settings()
if settings.database_url.startswith("sqlite:///"):
    Path(settings.database_url.removeprefix("sqlite:///")).parent.mkdir(
        parents=True,
        exist_ok=True,
    )
