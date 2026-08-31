from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest


MODULE_PATH = Path(__file__).with_name("evaluate_stt.py")
SPEC = importlib.util.spec_from_file_location("haru_evaluate_stt", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def manifest() -> dict:
    return {
        "schemaVersion": "haru-local-stt-evaluation-manifest-v1",
        "consentConfirmed": True,
        "purpose": "local_product_usability_evaluation",
        "clips": [
            {
                "clipId": "clip-001",
                "audioPath": "audio/clip-001.wav",
                "locale": "ko-KR",
                "referenceTranscript": "오늘 공원을 산책했어요",
                "semanticSlots": [
                    {"slotId": "activity", "expectedValues": ["산책"]},
                    {"slotId": "place", "expectedValues": ["공원"]},
                ],
            }
        ],
    }


def test_manifest_requires_explicit_consent_and_unique_clip_ids() -> None:
    missing = manifest()
    missing["consentConfirmed"] = False
    with pytest.raises(ValueError, match="consentConfirmed"):
        MODULE.validate_manifest(missing)

    duplicated = manifest()
    duplicated["clips"].append(dict(duplicated["clips"][0]))
    with pytest.raises(ValueError, match="duplicate clipId"):
        MODULE.validate_manifest(duplicated)


def test_evaluates_same_decoded_clip_in_baseline_and_assist_without_audio_output(
    tmp_path: Path,
) -> None:
    calls: list[tuple[tuple[float, ...], str]] = []

    class FakeEngine:
        engine = "qwen3-asr"
        model = "Qwen/Qwen3-ASR-1.7B"
        model_revision = "test-revision"

        def transcribe_array(self, audio: list[float], locale: str) -> dict:
            calls.append((tuple(audio), locale))
            return {
                "text": "오늘 공원 산책",
                "noSpeech": False,
                "language": locale,
                "durationSec": 1.25,
                "engine": self.engine,
                "model": self.model,
                "modelRevision": self.model_revision,
            }

    def decode_clip(_path: Path) -> tuple[list[float], float]:
        return [0.1, 0.2], 1.25

    def assist_preprocess(audio: list[float]) -> list[float]:
        return [value * 2 for value in audio]

    output = MODULE.evaluate_manifest(
        manifest(),
        manifest_path=tmp_path / "manifest.json",
        engine=FakeEngine(),
        decode_clip=decode_clip,
        assist_preprocess=assist_preprocess,
        clock_ms=iter([0, 120, 200, 350]).__next__,
    )

    review = output["blindedReview"]
    mapping = output["conditionMapping"]
    assert review["containsRealAudio"] is False
    assert review["containsRestrictedTranscript"] is True
    assert review["humanReviewComplete"] is False
    assert review["blinded"] is True
    assert len(review["sttReviewRows"]) == 2
    assert "voiceExperienceVariant" not in str(review)
    assert "preprocessingVersion" not in str(review)
    assert {row["conditionCode"] for row in review["sttReviewRows"]} == {
        "condition_a",
        "condition_b",
    }
    assert {row["voiceExperienceVariant"] for row in mapping["rows"]} == {
        "baseline_v1",
        "assist_v2",
    }
    assert all(row["usableTranscript"] is None for row in review["sttReviewRows"])
    assert all(
        slot["preserved"] is None
        for row in review["sttReviewRows"]
        for slot in row["semanticSlots"]
    )
    assert "audioPath" not in str(output)
    expected_audio = {
        "baseline_v1": ((0.1, 0.2), "ko-KR"),
        "assist_v2": ((0.2, 0.4), "ko-KR"),
    }
    ordered_variants = [
        row["voiceExperienceVariant"]
        for row in sorted(mapping["rows"], key=lambda row: row["inferenceOrder"])
    ]
    assert calls == [expected_audio[variant] for variant in ordered_variants]


def test_inference_order_is_deterministic_and_counterbalanced() -> None:
    for count in [1, 2, 3, 20, 21]:
        clip_ids = [f"clip-{index:03d}" for index in range(count)]
        first = MODULE.balanced_variant_orders(clip_ids)
        second = MODULE.balanced_variant_orders(list(reversed(clip_ids)))
        assert first == second
        first_variants = [order[0] for order in first.values()]
        assert abs(
            first_variants.count("baseline_v1")
            - first_variants.count("assist_v2")
        ) <= 1


def test_rejects_clip_path_outside_manifest_directory(tmp_path: Path) -> None:
    unsafe = manifest()
    unsafe["clips"][0]["audioPath"] = "../outside.wav"
    with pytest.raises(ValueError, match="inside manifest directory"):
        MODULE.evaluate_manifest(
            unsafe,
            manifest_path=tmp_path / "manifest.json",
            engine=object(),
            decode_clip=lambda _path: ([], 0.0),
            assist_preprocess=lambda value: value,
        )


def test_backend_readiness_uses_real_stt_engine_property() -> None:
    source = MODULE_PATH.read_text(encoding="utf-8")
    assert "if not stt_engine.is_ready:" in source
    assert "if not stt_engine.ready:" not in source


def test_restricted_outputs_must_stay_outside_repo(tmp_path: Path) -> None:
    repo_root = tmp_path / "repo"
    repo_root.mkdir()
    with pytest.raises(ValueError, match="outside repository"):
        MODULE.validate_output_paths(
            repo_root,
            repo_root / "restricted_review.json",
            tmp_path / "condition_mapping.json",
        )
    with pytest.raises(ValueError, match="outside repository"):
        MODULE.validate_output_paths(
            repo_root,
            tmp_path / "restricted_review.json",
            repo_root / "condition_mapping.json",
        )
    MODULE.validate_output_paths(
        repo_root,
        tmp_path / "restricted_review.json",
        tmp_path / "condition_mapping.json",
    )
