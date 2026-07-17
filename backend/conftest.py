"""Pytest config: skip @pytest.mark.gpu tests unless STT_RUN_GPU=1.

The non-GPU suite (audio decode + FastAPI routes with a monkeypatched engine)
runs anywhere with the service deps installed. The real Qwen inference test is
marked `gpu` and only runs when both local Qwen checkpoints + CUDA are available.
"""
from __future__ import annotations

import os

import pytest


def pytest_collection_modifyitems(config, items):
    run_gpu = os.getenv("STT_RUN_GPU", "0") == "1"
    skip_gpu = pytest.mark.skip(
        reason="GPU/model test; set STT_RUN_GPU=1 to enable (needs local Qwen checkpoints + CUDA)"
    )
    for item in items:
        if "gpu" in item.keywords and not run_gpu:
            item.add_marker(skip_gpu)
