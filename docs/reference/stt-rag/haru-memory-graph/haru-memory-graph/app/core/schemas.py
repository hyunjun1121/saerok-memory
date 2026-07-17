from pydantic import BaseModel, Field
from typing import Any

class QARequest(BaseModel):
    question: str
    start_date: str | None = None
    end_date: str | None = None
    top_k: int = Field(default=8, ge=1, le=30)

class QuestionGenerateRequest(BaseModel):
    target_date: str
    count: int = Field(default=4, ge=1, le=10)

class IngestResponse(BaseModel):
    users: int
    episodes: int
    entities: int
    questions: int
    neo4j_synced: bool
    details: dict[str, Any] = {}
