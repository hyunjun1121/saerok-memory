from __future__ import annotations

import secrets

from fastapi import Header, HTTPException, status

from app.core.config import settings


def _provided_token(
    authorization: str | None,
    local_token: str | None,
) -> str | None:
    if authorization:
        scheme, _, value = authorization.partition(" ")
        if scheme.lower() == "bearer" and value.strip():
            return value.strip()
    return local_token.strip() if local_token and local_token.strip() else None


def _validate_configured_token(provided: str | None) -> None:
    expected = settings.rag_api_token
    if expected is None or not expected.strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="rag_api_token_not_configured",
        )
    if provided is None or not secrets.compare_digest(provided, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_local_token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_private_token(
    authorization: str | None = Header(default=None),
    x_haru_local_token: str | None = Header(default=None),
) -> None:
    _validate_configured_token(_provided_token(authorization, x_haru_local_token))


def require_ingest_token(
    authorization: str | None = Header(default=None),
    x_haru_local_token: str | None = Header(default=None),
) -> None:
    _validate_configured_token(_provided_token(authorization, x_haru_local_token))
