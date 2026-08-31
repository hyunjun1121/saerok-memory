from __future__ import annotations

from datetime import date
from typing import Any, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.market import MARKET_LOCALES


MarketCode = Literal["kr", "jp"]
LocaleCode = Literal["ko-KR", "ja-JP"]


class MarketLocalePayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    market: MarketCode = "kr"
    locale: LocaleCode = Field(
        default="ko-KR",
        validation_alias=AliasChoices("locale", "ui_locale"),
    )

    @model_validator(mode="after")
    def valid_market_locale_pair(self) -> "MarketLocalePayload":
        if MARKET_LOCALES[self.market] != self.locale:
            raise ValueError("locale must match market")
        return self


class SchemaDescriptor(BaseModel):
    model_config = ConfigDict(extra="allow")

    name: Literal["haru_kiosk_usage_record"]
    version: Literal["1.0.0", "2.0.0"]


class PeriodPayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    start: date = Field(validation_alias=AliasChoices("start", "start_date"))
    end: date = Field(validation_alias=AliasChoices("end", "end_date"))

    @model_validator(mode="after")
    def ordered(self) -> "PeriodPayload":
        if self.end < self.start:
            raise ValueError("dataset period end must be on or after start")
        return self


class DatasetPayload(MarketLocalePayload):

    dataset_id: str = Field(min_length=1, max_length=160)
    period: PeriodPayload


class ConsentsPayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    longitudinal_usage_storage: bool


class UserPayload(MarketLocalePayload):

    user_id: str = Field(min_length=1, max_length=160)
    display_name: str = Field(default="", max_length=300)
    consents: ConsentsPayload


class QuestionPayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    question_id: str = Field(min_length=1, max_length=200)
    response_type: str = Field(min_length=1, max_length=80)
    prompt_text: str = Field(default="", max_length=20_000)


class QuestionRecordPayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    question: QuestionPayload
    response: dict[str, Any] | None = None


class SessionPayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    session_id: str = Field(min_length=1, max_length=200)
    user_id: str = Field(min_length=1, max_length=160)
    session_date: date
    question_records: list[QuestionRecordPayload]


class UsageRecordPayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    schema_: SchemaDescriptor = Field(alias="schema")
    dataset: DatasetPayload
    user: UserPayload
    sessions: list[SessionPayload]

    @model_validator(mode="after")
    def sessions_belong_to_user(self) -> "UsageRecordPayload":
        if self.schema_.version == "2.0.0":
            for section_name, section in (
                ("dataset", self.dataset),
                ("user", self.user),
            ):
                if not {"market", "locale"}.issubset(section.model_fields_set):
                    raise ValueError(
                        f"schema 2.0.0 requires {section_name}.market and locale"
                    )
        if (
            self.dataset.market != self.user.market
            or self.dataset.locale != self.user.locale
        ):
            raise ValueError("dataset and user market/locale must match")
        mismatched = [session.session_id for session in self.sessions if session.user_id != self.user.user_id]
        if mismatched:
            raise ValueError("every session.user_id must match user.user_id")
        out_of_period = [
            session.session_id
            for session in self.sessions
            if not self.dataset.period.start
            <= session.session_date
            <= self.dataset.period.end
        ]
        if out_of_period:
            raise ValueError("every session_date must be inside dataset period")
        return self

    @field_validator("sessions")
    @classmethod
    def no_duplicate_sessions(cls, sessions: list[SessionPayload]) -> list[SessionPayload]:
        ids = [session.session_id for session in sessions]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate session_id")
        return sessions


class QARequest(MarketLocalePayload):
    question: str = Field(min_length=1, max_length=4_000)
    start_date: date | None = None
    end_date: date | None = None
    top_k: int = Field(default=8, ge=1, le=30)
    include_sensitive: bool = False


class QuestionGenerateRequest(MarketLocalePayload):
    target_date: date
    count: int = Field(default=4, ge=1, le=10)


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    service: Literal["haru-memory-rag"]
    ready: bool
    embedding: dict[str, Any]
    neo4j_enabled: bool
    neo4j_ready: bool


class IngestResponse(BaseModel):
    user_id: str
    dataset_id: str
    market: MarketCode
    locale: LocaleCode
    questions_created: int
    questions_updated: int
    evidence_created: int
    evidence_updated: int
    evidence_deleted: int
    entities_created: int
    links_created: int
    reviews_created: int
    idempotent_replay: bool
    projection: dict[str, Any]
    neo4j_synced: bool
    neo4j_purged: bool = False
    sync_generation: int = 0
