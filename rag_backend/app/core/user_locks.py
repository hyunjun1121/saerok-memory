from __future__ import annotations

from contextlib import contextmanager
from threading import Lock, RLock
from typing import Iterator


_registry_lock = Lock()
_user_locks: dict[str, RLock] = {}


@contextmanager
def user_operation_lock(user_id: str) -> Iterator[None]:
    """Serialize ingest/delete/re-enrollment for one user in this local worker."""

    with _registry_lock:
        operation_lock = _user_locks.setdefault(user_id, RLock())
    with operation_lock:
        yield
