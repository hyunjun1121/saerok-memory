"""Pydantic response contracts for the Haru Qwen3-ASR API."""
from __future__ import annotations

from pydantic import BaseModel, Field


class Segment(BaseModel):
    id: int
    start: float
    end: float
    text: str


class TranscribeResponse(BaseModel):
    text: str
    noSpeech: bool
    language: str
    durationSec: float
    confidence: None = None
    segments: list[Segment] = Field(default_factory=list)
    engine: str
    model: str
    modelRevision: str
    alignerModel: str | None = None
    alignerRevision: str | None = None
    preprocessingVersion: str


class HealthResponse(BaseModel):
    status: str
    service: str
    engine: str
    backend: str
    model: str
    modelRevision: str
    alignerModel: str | None
    alignerRevision: str | None
    device: str
    dtype: str
    cuda_devices: int
    ready: bool
