"""Bounded inference admission tests (no model/GPU required)."""
from __future__ import annotations

import asyncio
import contextlib

import pytest

from app.admission import AdmissionQueueFull, InferenceAdmission


async def _wait_for_pending(admission: InferenceAdmission, expected: int) -> None:
    for _ in range(100):
        if admission.pending == expected:
            return
        await asyncio.sleep(0)
    raise AssertionError(
        f"pending count never reached {expected}: {admission.pending}"
    )


def test_admission_allows_one_active_and_two_pending_then_rejects() -> None:
    async def scenario() -> None:
        admission = InferenceAdmission(max_active=1, max_pending=2)
        release = asyncio.Event()
        entered: list[int] = []

        async def occupy(identifier: int) -> None:
            async with admission.slot():
                entered.append(identifier)
                await release.wait()

        first = asyncio.create_task(occupy(1))
        for _ in range(100):
            if admission.active == 1:
                break
            await asyncio.sleep(0)
        second = asyncio.create_task(occupy(2))
        third = asyncio.create_task(occupy(3))
        await _wait_for_pending(admission, 2)

        with pytest.raises(AdmissionQueueFull) as caught:
            async with admission.slot():
                raise AssertionError("full queue admitted a fourth request")
        assert caught.value.retry_after_seconds == 1
        assert admission.active == 1
        assert admission.pending == 2

        release.set()
        await asyncio.gather(first, second, third)
        assert sorted(entered) == [1, 2, 3]
        assert admission.active == 0
        assert admission.pending == 0

    asyncio.run(scenario())


def test_cancelled_waiter_is_removed_before_inference_admission() -> None:
    async def scenario() -> None:
        admission = InferenceAdmission(max_active=1, max_pending=2)
        first_slot = admission.slot()
        await first_slot.__aenter__()
        reached_inference = False

        async def wait_for_inference() -> None:
            nonlocal reached_inference
            async with admission.slot():
                reached_inference = True

        waiter = asyncio.create_task(wait_for_inference())
        await _wait_for_pending(admission, 1)
        waiter.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await waiter

        assert reached_inference is False
        assert admission.active == 1
        assert admission.pending == 0
        await first_slot.__aexit__(None, None, None)

        async with admission.slot():
            assert admission.active == 1
        assert admission.active == 0
        assert admission.pending == 0

    asyncio.run(scenario())
