"""Stable, versioned HTTP errors exposed by the local STT API."""
from __future__ import annotations


ERROR_SCHEMA_VERSION = "1.0.0"


class STTServiceError(RuntimeError):
    """Known HTTP failure safe to expose to local clients."""

    def __init__(
        self,
        *,
        status_code: int,
        code: str,
        retryable: bool,
        retry_after_seconds: int | None = None,
    ) -> None:
        super().__init__(code)
        self.status_code = status_code
        self.code = code
        self.retryable = retryable
        self.retry_after_seconds = retry_after_seconds
