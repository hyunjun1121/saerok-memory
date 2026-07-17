from __future__ import annotations

import json
import re
from typing import Any

from fastapi import APIRouter, Body, Depends, Header, HTTPException, status
from pydantic import ValidationError

from app.core.config import settings
from app.core.schemas import (
    IngestResponse,
    QARequest,
    QuestionGenerateRequest,
    UsageRecordPayload,
)
from app.core.security import require_ingest_token, require_private_token
from app.services.deletion import delete_user_data
from app.services.embedding import EmbeddingUnavailable, get_embedding_service
from app.services.ingestion import (
    ConsentRequired,
    IdempotencyConflict,
    ingest_payload,
    ingest_seed_if_empty,
)
from app.services.qa import answer
from app.services.query import (
    canonical_snapshot,
    canonical_snapshots,
    evidence,
    galaxy,
    graph,
    review_queue,
    timeline,
)
from app.services.question_generator import generate


router = APIRouter(prefix="/api")
_OPAQUE_TOKEN = re.compile(r"^[A-Za-z0-9._:-]+$")


def _validated_opaque_header(value: str | None, *, name: str, maximum: int) -> str | None:
    if value is None:
        return None
    token = value.strip()
    if not token or len(token) > maximum or _OPAQUE_TOKEN.fullmatch(token) is None:
        raise HTTPException(status_code=400, detail=f"invalid_{name}")
    return token


@router.post(
    "/ingest/json",
    response_model=IngestResponse,
    dependencies=[Depends(require_ingest_token)],
)
def ingest_json(
    payload: dict[str, Any] = Body(...),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    content_hash: str | None = Header(default=None, alias="X-Haru-Content-Hash"),
):
    encoded_size = len(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    )
    if encoded_size > settings.max_json_bytes:
        raise HTTPException(status_code=413, detail="json_too_large")
    try:
        UsageRecordPayload.model_validate(payload)
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail=exc.errors(include_context=False),
        ) from exc

    key = _validated_opaque_header(
        idempotency_key,
        name="idempotency_key",
        maximum=240,
    )
    supplied_hash = _validated_opaque_header(
        content_hash,
        name="content_hash",
        maximum=160,
    )
    try:
        return ingest_payload(
            payload,
            idempotency_key=key,
            content_hash_header=supplied_hash,
        )
    except IdempotencyConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ConsentRequired as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except EmbeddingUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/ingest/seed", dependencies=[Depends(require_private_token)])
def ingest_seed():
    try:
        return ingest_seed_if_empty()
    except EmbeddingUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/users/{user_id}/timeline", dependencies=[Depends(require_private_token)])
def get_timeline(user_id: str):
    return timeline(user_id)


@router.get("/users/{user_id}/graph", dependencies=[Depends(require_private_token)])
def get_graph(user_id: str):
    return graph(user_id)


@router.get("/users/{user_id}/galaxy", dependencies=[Depends(require_private_token)])
def get_galaxy(user_id: str):
    return galaxy(user_id)


@router.get(
    "/users/{user_id}/evidence/{episode_id}",
    dependencies=[Depends(require_private_token)],
)
def get_evidence(user_id: str, episode_id: str):
    result = evidence(user_id, episode_id)
    if result is None:
        raise HTTPException(status_code=404, detail="episode_not_found")
    return result


@router.get(
    "/users/{user_id}/review-queue",
    dependencies=[Depends(require_private_token)],
)
def get_review_queue(user_id: str):
    return review_queue(user_id)


@router.get(
    "/users/{user_id}/snapshots",
    dependencies=[Depends(require_private_token)],
)
def get_snapshots(user_id: str):
    return canonical_snapshots(user_id)


@router.get(
    "/users/{user_id}/snapshots/{snapshot_id}",
    dependencies=[Depends(require_private_token)],
)
def get_snapshot(user_id: str, snapshot_id: str):
    result = canonical_snapshot(user_id, snapshot_id)
    if result is None:
        raise HTTPException(status_code=404, detail="snapshot_not_found")
    return result


@router.post("/users/{user_id}/qa", dependencies=[Depends(require_private_token)])
def qa(user_id: str, request: QARequest):
    try:
        return answer(
            user_id,
            request.question,
            request.top_k,
            request.start_date.isoformat() if request.start_date else None,
            request.end_date.isoformat() if request.end_date else None,
            request.include_sensitive,
        )
    except EmbeddingUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post(
    "/users/{user_id}/questions/generate",
    dependencies=[Depends(require_private_token)],
)
def generate_questions(user_id: str, request: QuestionGenerateRequest):
    target_date = request.target_date.isoformat()
    return {
        "user_id": user_id,
        "target_date": target_date,
        "questions": generate(user_id, target_date, request.count),
    }


@router.delete(
    "/users/{user_id}",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_private_token)],
)
def delete_user(user_id: str):
    return delete_user_data(user_id)
