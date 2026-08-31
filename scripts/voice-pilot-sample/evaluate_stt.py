#!/usr/bin/env python3
"""Local-only paired STT evaluation harness.

Reads explicitly consented clips, decodes each once in memory, and sends the
same decoded samples through decode/resample-only baseline and Haru v2 assist.
It never copies or serializes audio. Output is a restricted transcript review
file that still requires human usable/semantic-slot labels before scoring.
"""

from __future__ import annotations

import argparse
from collections.abc import Callable
from datetime import UTC, datetime
import hashlib
import json
from pathlib import Path
import sys
from time import perf_counter
from typing import Any, Protocol


SCHEMA_VERSION = "haru-local-stt-restricted-review-v1"
MAPPING_SCHEMA_VERSION = "haru-local-stt-condition-map-v1"
MANIFEST_SCHEMA_VERSION = "haru-local-stt-evaluation-manifest-v1"
BASELINE_VERSION = "decode-resample-only-v1"
ASSIST_VERSION = "haru-dc-hp80-rms-v2"
SUPPORTED_LOCALES = {"ko-KR", "ja-JP", "en-US"}


class ArrayEngine(Protocol):
    engine: str
    model: str
    model_revision: str

    def transcribe_array(self, audio: Any, locale: str) -> dict[str, Any]: ...


def _required_string(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} must be a non-empty string")
    return value.strip()


def validate_manifest(manifest: Any) -> dict[str, Any]:
    if not isinstance(manifest, dict):
        raise ValueError("manifest must be an object")
    if manifest.get("schemaVersion") != MANIFEST_SCHEMA_VERSION:
        raise ValueError(f"schemaVersion must be {MANIFEST_SCHEMA_VERSION}")
    if manifest.get("consentConfirmed") is not True:
        raise ValueError("consentConfirmed=true is required for every evaluation batch")
    if manifest.get("purpose") != "local_product_usability_evaluation":
        raise ValueError("purpose must be local_product_usability_evaluation")
    clips = manifest.get("clips")
    if not isinstance(clips, list) or not clips:
        raise ValueError("clips must be a non-empty array")

    seen: set[str] = set()
    for index, clip in enumerate(clips):
        if not isinstance(clip, dict):
            raise ValueError(f"clips[{index}] must be an object")
        clip_id = _required_string(clip.get("clipId"), f"clips[{index}].clipId")
        if clip_id in seen:
            raise ValueError(f"duplicate clipId: {clip_id}")
        seen.add(clip_id)
        _required_string(clip.get("audioPath"), f"clips[{index}].audioPath")
        _required_string(
            clip.get("referenceTranscript"),
            f"clips[{index}].referenceTranscript",
        )
        locale = _required_string(clip.get("locale"), f"clips[{index}].locale")
        if locale not in SUPPORTED_LOCALES:
            raise ValueError(f"clips[{index}].locale is unsupported: {locale}")
        slots = clip.get("semanticSlots")
        if not isinstance(slots, list) or not slots:
            raise ValueError(f"clips[{index}].semanticSlots must be non-empty")
        slot_ids: set[str] = set()
        for slot_index, slot in enumerate(slots):
            if not isinstance(slot, dict):
                raise ValueError(
                    f"clips[{index}].semanticSlots[{slot_index}] must be an object"
                )
            slot_id = _required_string(
                slot.get("slotId"),
                f"clips[{index}].semanticSlots[{slot_index}].slotId",
            )
            if slot_id in slot_ids:
                raise ValueError(f"duplicate semantic slot: {clip_id}/{slot_id}")
            slot_ids.add(slot_id)
            expected = slot.get("expectedValues")
            if not isinstance(expected, list) or not expected:
                raise ValueError(
                    f"clips[{index}].semanticSlots[{slot_index}].expectedValues must be non-empty"
                )
            for value_index, value in enumerate(expected):
                _required_string(
                    value,
                    f"clips[{index}].semanticSlots[{slot_index}].expectedValues[{value_index}]",
                )
    return manifest


def _safe_audio_path(manifest_path: Path, relative_path: str) -> Path:
    if Path(relative_path).is_absolute():
        raise ValueError("audioPath must stay inside manifest directory")
    root = manifest_path.resolve().parent
    resolved = (root / relative_path).resolve()
    try:
        resolved.relative_to(root)
    except ValueError as error:
        raise ValueError("audioPath must stay inside manifest directory") from error
    return resolved


def _review_slots(slots: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "slotId": str(slot["slotId"]),
            "expectedValues": [str(value) for value in slot["expectedValues"]],
            "preserved": None,
        }
        for slot in slots
    ]


def _plan_digest(clip_id: str) -> bytes:
    return hashlib.sha256(f"haru-stt-eval-v1|{clip_id}".encode()).digest()


def balanced_variant_orders(
    clip_ids: list[str],
) -> dict[str, tuple[str, str]]:
    """Assign deterministic, batch-balanced inference order by opaque clip hash."""
    ordered_ids = sorted(clip_ids, key=lambda clip_id: (_plan_digest(clip_id), clip_id))
    return {
        clip_id: (
            ("baseline_v1", "assist_v2")
            if index % 2 == 0
            else ("assist_v2", "baseline_v1")
        )
        for index, clip_id in enumerate(ordered_ids)
    }


def _condition_codes(clip_id: str) -> dict[str, str]:
    if _plan_digest(clip_id)[1] % 2:
        return {"baseline_v1": "condition_b", "assist_v2": "condition_a"}
    return {"baseline_v1": "condition_a", "assist_v2": "condition_b"}


def _result_row(
    *,
    clip: dict[str, Any],
    condition_code: str,
    result: dict[str, Any],
    latency_ms: int,
    duration_seconds: float,
    engine: ArrayEngine,
) -> dict[str, Any]:
    no_speech = bool(result.get("noSpeech"))
    status = "no_speech" if no_speech else "completed"
    return {
        "reviewRowId": f"{clip['clipId']}|{condition_code}",
        "pairId": str(clip["clipId"]),
        "clipId": str(clip["clipId"]),
        "conditionCode": condition_code,
        "locale": str(clip["locale"]),
        "status": status,
        "noSpeech": no_speech,
        "retryCount": 0,
        "latencyMs": latency_ms,
        "audioDurationMs": round(duration_seconds * 1000),
        "referenceTranscript": str(clip["referenceTranscript"]),
        "hypothesisTranscript": str(result.get("text") or "").strip(),
        "usableTranscript": None,
        "engine": str(result.get("engine") or engine.engine),
        "model": str(result.get("model") or engine.model),
        "modelRevision": str(result.get("modelRevision") or engine.model_revision),
        "semanticSlots": _review_slots(clip["semanticSlots"]),
        "droppedAtVoiceStep": False,
    }


def evaluate_manifest(
    manifest: Any,
    *,
    manifest_path: Path,
    engine: ArrayEngine,
    decode_clip: Callable[[Path], tuple[Any, float]],
    assist_preprocess: Callable[[Any], Any],
    clock_ms: Callable[[], float] | None = None,
) -> dict[str, Any]:
    validated = validate_manifest(manifest)
    now_ms = clock_ms or (lambda: perf_counter() * 1000)
    rows: list[dict[str, Any]] = []
    mapping_rows: list[dict[str, Any]] = []
    orders_by_clip = balanced_variant_orders(
        [str(clip["clipId"]) for clip in validated["clips"]]
    )

    for clip in validated["clips"]:
        clip_path = _safe_audio_path(manifest_path, str(clip["audioPath"]))
        baseline_audio, duration_seconds = decode_clip(clip_path)
        assisted_audio = assist_preprocess(baseline_audio)
        audio_by_variant = {
            "baseline_v1": (BASELINE_VERSION, baseline_audio),
            "assist_v2": (ASSIST_VERSION, assisted_audio),
        }
        condition_codes = _condition_codes(str(clip["clipId"]))
        for inference_order, variant in enumerate(
            orders_by_clip[str(clip["clipId"])], start=1
        ):
            preprocessing_version, audio = audio_by_variant[variant]
            condition_code = condition_codes[variant]
            mapping_rows.append(
                {
                    "reviewRowId": f"{clip['clipId']}|{condition_code}",
                    "pairId": str(clip["clipId"]),
                    "conditionCode": condition_code,
                    "voiceExperienceVariant": variant,
                    "preprocessingVersion": preprocessing_version,
                    "inferenceOrder": inference_order,
                }
            )
            started = now_ms()
            try:
                result = engine.transcribe_array(audio, str(clip["locale"]))
                latency_ms = max(0, round(now_ms() - started))
                rows.append(
                    _result_row(
                        clip=clip,
                        condition_code=condition_code,
                        result=result,
                        latency_ms=latency_ms,
                        duration_seconds=duration_seconds,
                        engine=engine,
                    )
                )
            except Exception as error:  # one failed variant must not discard its pair
                latency_ms = max(0, round(now_ms() - started))
                rows.append(
                    {
                        "reviewRowId": f"{clip['clipId']}|{condition_code}",
                        "pairId": str(clip["clipId"]),
                        "clipId": str(clip["clipId"]),
                        "conditionCode": condition_code,
                        "locale": str(clip["locale"]),
                        "status": "failed",
                        "noSpeech": False,
                        "retryCount": 0,
                        "latencyMs": latency_ms,
                        "audioDurationMs": round(duration_seconds * 1000),
                        "referenceTranscript": str(clip["referenceTranscript"]),
                        "hypothesisTranscript": "",
                        "usableTranscript": None,
                        "engine": engine.engine,
                        "model": engine.model,
                        "modelRevision": engine.model_revision,
                        "semanticSlots": _review_slots(clip["semanticSlots"]),
                        "droppedAtVoiceStep": False,
                        "failureCode": type(error).__name__,
                    }
                )

    generated_at = datetime.now(UTC).isoformat()
    rows.sort(key=lambda row: (str(row["pairId"]), str(row["conditionCode"])))
    mapping_rows.sort(
        key=lambda row: (str(row["pairId"]), str(row["conditionCode"]))
    )
    return {
        "blindedReview": {
            "schemaVersion": SCHEMA_VERSION,
            "generatedAt": generated_at,
            "isSynthetic": False,
            "consentConfirmed": True,
            "purpose": "local_product_usability_evaluation",
            "restricted": True,
            "doNotCommit": True,
            "containsRealAudio": False,
            "containsRestrictedTranscript": True,
            "humanReviewComplete": False,
            "blinded": True,
            "reviewInstructions": (
                "Review condition codes without opening the separate condition map. Set "
                "usableTranscript to true/false and every semanticSlots[].preserved to "
                "true/false, then set humanReviewComplete=true."
            ),
            "sttReviewRows": rows,
        },
        "conditionMapping": {
            "schemaVersion": MAPPING_SCHEMA_VERSION,
            "generatedAt": generated_at,
            "consentConfirmed": True,
            "purpose": "local_product_usability_evaluation",
            "restricted": True,
            "doNotCommit": True,
            "doNotShareWithReviewer": True,
            "containsRealAudio": False,
            "containsRestrictedTranscript": False,
            "counterbalanceMethod": "sha256-fixed-seed-balanced-alternation-v2",
            "rows": mapping_rows,
        },
    }


def _is_within(candidate: Path, root: Path) -> bool:
    try:
        candidate.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False


def validate_output_paths(repo_root: Path, output: Path, mapping_output: Path) -> None:
    if _is_within(output, repo_root) or _is_within(mapping_output, repo_root):
        raise ValueError(
            "Restricted review and condition mapping outputs must stay outside repository"
        )
    if output.resolve() == mapping_output.resolve():
        raise ValueError("review output and mapping output must be different files")


class BackendEngineAdapter:
    def __init__(self, engine: Any, settings: Any) -> None:
        self._engine = engine
        self.engine = "qwen3-asr"
        self.model = str(settings.model_id)
        self.model_revision = str(settings.model_revision)

    def transcribe_array(self, audio: Any, locale: str) -> dict[str, Any]:
        # Harness-only access keeps production API unchanged while ensuring both
        # variants use the same loaded model and no audio is serialized.
        return self._engine._transcribe(audio, language_locale=locale)  # noqa: SLF001


def load_local_backend(repo_root: Path) -> tuple[ArrayEngine, Callable, Callable]:
    backend_root = repo_root / "backend"
    sys.path.insert(0, str(backend_root))
    try:
        import av  # type: ignore
        import numpy as np  # type: ignore

        from app.audio import (  # type: ignore
            TARGET_SAMPLE_RATE,
            preprocess_audio,
        )
        from app.config import get_settings  # type: ignore
        from app.stt import STTEngine  # type: ignore
    except ImportError as error:
        raise RuntimeError(
            "Local STT dependencies missing. Run npm run stt:install and npm run stt:download."
        ) from error

    settings = get_settings()
    stt_engine = STTEngine(settings)
    stt_engine.load()
    if not stt_engine.is_ready:
        raise RuntimeError("Qwen STT model failed to load; local GPU/model is required")
    adapter = BackendEngineAdapter(stt_engine, settings)

    def decode_resample_only(filename: Path) -> tuple[Any, float]:
        if not filename.is_file():
            raise FileNotFoundError(f"audio clip not found: {filename.name}")
        resampler = av.AudioResampler(
            format="fltp",
            layout="mono",
            rate=TARGET_SAMPLE_RATE,
        )
        chunks: list[Any] = []
        container = av.open(str(filename))
        try:
            for frame in container.decode(audio=0):
                for resampled in resampler.resample(frame):
                    chunks.append(resampled.to_ndarray())
            for resampled in resampler.resample(None):
                chunks.append(resampled.to_ndarray())
        finally:
            container.close()
        if not chunks:
            raise ValueError("no audio frames decoded")
        audio = np.concatenate(chunks, axis=-1).reshape(-1).astype(np.float32)
        max_samples = round(settings.max_audio_duration_seconds * TARGET_SAMPLE_RATE)
        if audio.size > max_samples:
            raise ValueError("audio duration exceeds configured limit")
        peak = float(np.max(np.abs(audio))) if audio.size else 0.0
        if peak > 1.0:
            audio = audio / peak
        return audio, float(audio.size) / float(TARGET_SAMPLE_RATE)

    return adapter, decode_resample_only, preprocess_audio


def _read_json(filename: Path) -> Any:
    try:
        return json.loads(filename.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise ValueError(f"invalid JSON manifest: {error}") from error


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--mapping-output", type=Path)
    parser.add_argument("--validate-only", action="store_true")
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    manifest_path = args.manifest.resolve()
    manifest = validate_manifest(_read_json(manifest_path))
    if args.validate_only:
        print(f"Valid local STT evaluation manifest: {len(manifest['clips'])} clips")
        return 0
    if args.output is None:
        raise ValueError("--output is required unless --validate-only is used")
    if args.mapping_output is None:
        raise ValueError("--mapping-output is required unless --validate-only is used")
    output_path = args.output.resolve()
    mapping_output_path = args.mapping_output.resolve()
    repo_root = Path(__file__).resolve().parents[2]
    validate_output_paths(repo_root, output_path, mapping_output_path)
    if (output_path.exists() or mapping_output_path.exists()) and not args.force:
        raise FileExistsError(
            "output exists; pass --force to replace restricted review or condition mapping"
        )
    engine, decode_clip, assist_preprocess = load_local_backend(repo_root)
    output = evaluate_manifest(
        manifest,
        manifest_path=manifest_path,
        engine=engine,
        decode_clip=decode_clip,
        assist_preprocess=assist_preprocess,
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    mapping_output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(output["blindedReview"], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    mapping_output_path.write_text(
        json.dumps(output["conditionMapping"], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Blinded restricted STT review written: {output_path}\n"
        f"Separate condition mapping written: {mapping_output_path}\n"
        "No audio was copied. Keep mapping away from reviewer; do not commit either file."
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1) from error
