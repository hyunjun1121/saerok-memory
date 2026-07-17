"""Bounded async admission for the single resident Qwen inference worker."""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncIterator


class AdmissionQueueFull(RuntimeError):
    """Raised before inference when active + pending capacity is exhausted."""

    def __init__(self, *, retry_after_seconds: int = 1) -> None:
        super().__init__("inference queue is full")
        self.retry_after_seconds = max(1, int(retry_after_seconds))


class InferenceAdmission:
    """Allow bounded FIFO waiting without creating an unbounded executor queue.

    Counter mutations contain no await points, so they are atomic on the app's
    asyncio event loop. A task cancelled while waiting is removed immediately
    and never reaches the inference executor.
    """

    def __init__(
        self,
        *,
        max_active: int = 1,
        max_pending: int = 2,
        retry_after_seconds: int = 1,
    ) -> None:
        if max_active < 1:
            raise ValueError("max_active must be at least one")
        if max_pending < 0:
            raise ValueError("max_pending must not be negative")
        self._max_active = int(max_active)
        self._max_pending = int(max_pending)
        self._retry_after_seconds = max(1, int(retry_after_seconds))
        self._semaphore = asyncio.Semaphore(self._max_active)
        self._admitted = 0
        self._active = 0

    @property
    def active(self) -> int:
        return self._active

    @property
    def pending(self) -> int:
        return max(0, self._admitted - self._active)

    @asynccontextmanager
    async def slot(self) -> AsyncIterator[None]:
        if self._admitted >= self._max_active + self._max_pending:
            raise AdmissionQueueFull(
                retry_after_seconds=self._retry_after_seconds
            )

        self._admitted += 1
        acquired = False
        try:
            await self._semaphore.acquire()
            acquired = True
            self._active += 1
            yield
        finally:
            if acquired:
                self._active -= 1
                self._semaphore.release()
            self._admitted -= 1
