"""Bounded multipart parsing and browser-origin checks for STT uploads."""
from __future__ import annotations

from collections.abc import AsyncIterator

from fastapi import Request
from starlette.datastructures import UploadFile
from starlette.formparsers import MultiPartException, MultiPartParser

from .config import Settings
from .errors import STTServiceError


MULTIPART_OVERHEAD_BYTES = 1 << 20


class RequestBodyTooLarge(MultiPartException):
    """Stops Starlette's multipart parser once the envelope limit is crossed."""


def verify_browser_origin(request: Request, settings: Settings) -> None:
    """Reject browser cross-origin POSTs before parsing private audio."""
    origin = request.headers.get("origin", "").strip()
    if (
        origin
        and "*" not in settings.cors_origins
        and origin not in settings.cors_origins
    ):
        raise STTServiceError(
            status_code=403, code="origin_not_allowed", retryable=False
        )


async def read_multipart_audio(request: Request, settings: Settings) -> bytes:
    """Parse one multipart ``file`` under envelope and file-size limits."""
    content_type = request.headers.get("content-type", "")
    if not content_type.lower().startswith("multipart/form-data"):
        raise STTServiceError(
            status_code=415,
            code="unsupported_media_type",
            retryable=False,
        )

    envelope_limit = settings.max_upload_bytes + MULTIPART_OVERHEAD_BYTES
    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            declared_size = int(content_length)
        except ValueError as exc:
            raise STTServiceError(
                status_code=400,
                code="invalid_content_length",
                retryable=False,
            ) from exc
        if declared_size < 0:
            raise STTServiceError(
                status_code=400,
                code="invalid_content_length",
                retryable=False,
            )
        if declared_size > envelope_limit:
            raise STTServiceError(
                status_code=413, code="audio_too_large", retryable=False
            )

    async def bounded_stream() -> AsyncIterator[bytes]:
        received = 0
        async for chunk in request.stream():
            received += len(chunk)
            if received > envelope_limit:
                raise RequestBodyTooLarge("request body exceeded limit")
            yield chunk

    parser = MultiPartParser(
        request.headers,
        bounded_stream(),
        max_files=1,
        max_fields=0,
        max_part_size=64 * 1024,
    )
    try:
        form = await parser.parse()
    except RequestBodyTooLarge as exc:
        raise STTServiceError(
            status_code=413, code="audio_too_large", retryable=False
        ) from exc
    except (MultiPartException, KeyError) as exc:
        raise STTServiceError(
            status_code=400, code="invalid_multipart", retryable=False
        ) from exc

    try:
        file = form.get("file")
        if not isinstance(file, UploadFile):
            raise STTServiceError(
                status_code=422, code="file_required", retryable=False
            )
        if file.size is not None and file.size > settings.max_upload_bytes:
            raise STTServiceError(
                status_code=413, code="audio_too_large", retryable=False
            )

        buf = bytearray()
        while True:
            chunk = await file.read(1 << 20)
            if not chunk:
                break
            buf += chunk
            if len(buf) > settings.max_upload_bytes:
                raise STTServiceError(
                    status_code=413,
                    code="audio_too_large",
                    retryable=False,
                )
        raw = bytes(buf)
    finally:
        await form.close()

    if not raw:
        raise STTServiceError(
            status_code=400, code="empty_audio", retryable=False
        )
    return raw
