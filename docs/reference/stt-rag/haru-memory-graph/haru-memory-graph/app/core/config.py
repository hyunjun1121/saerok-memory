from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str = "sqlite:///./data/haru.db"
    seed_json_path: str = "./data/haru_7day_admin_usage_records.json"

    neo4j_enabled: bool = True
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "haru-demo-password"

    embedding_backend: str = "hash"
    embedding_model: str = "intfloat/multilingual-e5-small"
    embedding_dim: int = 384
    model_cache_dir: str = "./models"

    min_question_confidence: float = 0.80
    allow_sensitive_question_generation: bool = False

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
Path("data").mkdir(exist_ok=True)
