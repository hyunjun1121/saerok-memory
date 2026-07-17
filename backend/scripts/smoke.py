"""CLI smoke test: transcribe files with local Qwen3-ASR checkpoints.

Run from the repo root after installing backend/requirements.txt:

    python backend/scripts/smoke.py path/to/story.webm

Prints the JSON the HTTP service would return. Useful to confirm the model +
CUDA work before wiring the frontend.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Make `app.*` importable when launched as `python backend/scripts/smoke.py`.
_BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND))

from app.config import get_settings  # noqa: E402
from app.stt import STTEngine  # noqa: E402


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("usage: python backend/scripts/smoke.py <audio_file> [audio_file ...]")
        return 2

    engine = STTEngine(get_settings())
    engine.load()
    if not engine.is_ready:
        print("ERROR: model failed to load", file=sys.stderr)
        return 1

    exit_code = 0
    for path in argv[1:]:
        data = Path(path).read_bytes()
        try:
            result = engine.transcribe_bytes(data)
        except Exception as exc:  # noqa: BLE001
            print(f"{path}: FAILED {exc}", file=sys.stderr)
            exit_code = 1
            continue
        print(f"=== {path} ===")
        print(json.dumps(result, ensure_ascii=False, indent=2))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
