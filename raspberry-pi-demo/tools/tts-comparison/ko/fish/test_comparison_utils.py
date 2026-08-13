from __future__ import annotations

import unittest

from comparison_utils import (
    merge_generation_records,
    parse_ebur128_summary,
    validate_generation_provenance,
    validate_generation_request,
    validate_runtime_provenance,
)


EXPECTED_TEXT = "영자 어르신, 오늘 기분은 어떠세요?"
EXPECTED_SEEDS = tuple(range(5201, 5221))
EXPECTED_SOURCE_REVISION = "e5e292632cb11e7a27b2b7487f58f612bc101e13"
EXPECTED_MODEL_REVISION = "1de9996b6be38b745688de084d87a5633f714e4e"


def make_records() -> list[dict[str, object]]:
    return [
        {
            "id": f"fish-ko-reference-free-seed-{seed}",
            "seed": seed,
            "text": EXPECTED_TEXT,
            "referenceAudio": None,
            "nativePath": f"outputs/native/fish_ko_reference_free_seed_{seed}.wav",
            "nativeSha256": f"{seed:064x}",
            "nativeSampleRateHz": 44100,
            "nativeFrames": 100000,
            "generationSeconds": 1.0,
            "generatedAtUtc": "2026-08-11T00:00:00Z",
            "maxNewTokens": 256,
            "temperature": 1.0,
            "topP": 0.9,
            "topK": 30,
        }
        for seed in EXPECTED_SEEDS
    ]


def make_summary(records: list[dict[str, object]]) -> dict[str, object]:
    return {
        "text": EXPECTED_TEXT,
        "source": {
            "url": "https://github.com/fishaudio/fish-speech.git",
            "revision": EXPECTED_SOURCE_REVISION,
        },
        "model": {
            "id": "fishaudio/s2-pro",
            "revision": EXPECTED_MODEL_REVISION,
        },
        "seeds": list(EXPECTED_SEEDS),
        "generationConfig": {
            "maxNewTokens": 256,
            "temperature": 1.0,
            "topP": 0.9,
            "topK": 30,
            "referenceAudio": None,
        },
        "samples": records,
    }


class GenerationRequestTests(unittest.TestCase):
    def test_accepts_exact_korean_seed_pool(self) -> None:
        self.assertEqual(
            validate_generation_request(EXPECTED_SEEDS, max_new_tokens=256),
            EXPECTED_SEEDS,
        )

    def test_rejects_duplicate_seed(self) -> None:
        with self.assertRaisesRegex(ValueError, "duplicate"):
            validate_generation_request((5201, 5201), max_new_tokens=256)

    def test_rejects_non_positive_token_bound(self) -> None:
        with self.assertRaisesRegex(ValueError, "positive"):
            validate_generation_request((5201,), max_new_tokens=0)

    def test_merge_rejects_cross_invocation_collision(self) -> None:
        with self.assertRaisesRegex(ValueError, "already exists"):
            merge_generation_records([{"seed": 5201}], [{"seed": 5201}])


class GenerationProvenanceTests(unittest.TestCase):
    def test_accepts_exact_twenty_sample_provenance(self) -> None:
        records = make_records()
        validate_generation_provenance(
            records,
            make_summary(records),
            native_paths={
                seed: f"outputs/native/fish_ko_reference_free_seed_{seed}.wav"
                for seed in EXPECTED_SEEDS
            },
            native_sha256={seed: f"{seed:064x}" for seed in EXPECTED_SEEDS},
            expected_seeds=EXPECTED_SEEDS,
            expected_text=EXPECTED_TEXT,
            expected_max_new_tokens=256,
            expected_source_revision=EXPECTED_SOURCE_REVISION,
            expected_model_id="fishaudio/s2-pro",
            expected_model_revision=EXPECTED_MODEL_REVISION,
        )

    def test_rejects_native_hash_drift(self) -> None:
        records = make_records()
        hashes = {seed: f"{seed:064x}" for seed in EXPECTED_SEEDS}
        hashes[5201] = "f" * 64
        with self.assertRaisesRegex(ValueError, "nativeSha256"):
            validate_generation_provenance(
                records,
                make_summary(records),
                native_paths={
                    seed: f"outputs/native/fish_ko_reference_free_seed_{seed}.wav"
                    for seed in EXPECTED_SEEDS
                },
                native_sha256=hashes,
                expected_seeds=EXPECTED_SEEDS,
                expected_text=EXPECTED_TEXT,
                expected_max_new_tokens=256,
                expected_source_revision=EXPECTED_SOURCE_REVISION,
                expected_model_id="fishaudio/s2-pro",
                expected_model_revision=EXPECTED_MODEL_REVISION,
            )

    def test_rejects_wrong_korean_prompt(self) -> None:
        records = make_records()
        records[0]["text"] = "다른 문장"
        with self.assertRaisesRegex(ValueError, "prompt"):
            validate_generation_provenance(
                records,
                make_summary(records),
                native_paths={
                    seed: f"outputs/native/fish_ko_reference_free_seed_{seed}.wav"
                    for seed in EXPECTED_SEEDS
                },
                native_sha256={seed: f"{seed:064x}" for seed in EXPECTED_SEEDS},
                expected_seeds=EXPECTED_SEEDS,
                expected_text=EXPECTED_TEXT,
                expected_max_new_tokens=256,
                expected_source_revision=EXPECTED_SOURCE_REVISION,
                expected_model_id="fishaudio/s2-pro",
                expected_model_revision=EXPECTED_MODEL_REVISION,
            )


class RuntimeProvenanceTests(unittest.TestCase):
    def test_accepts_clean_pinned_source_and_model_snapshot(self) -> None:
        validate_runtime_provenance(
            source_head=EXPECTED_SOURCE_REVISION,
            source_dirty=False,
            model_metadata_revisions=[EXPECTED_MODEL_REVISION] * 13,
            expected_source_revision=EXPECTED_SOURCE_REVISION,
            expected_model_revision=EXPECTED_MODEL_REVISION,
            expected_model_file_count=13,
        )

    def test_rejects_dirty_source_checkout(self) -> None:
        with self.assertRaisesRegex(ValueError, "dirty"):
            validate_runtime_provenance(
                source_head=EXPECTED_SOURCE_REVISION,
                source_dirty=True,
                model_metadata_revisions=[EXPECTED_MODEL_REVISION] * 13,
                expected_source_revision=EXPECTED_SOURCE_REVISION,
                expected_model_revision=EXPECTED_MODEL_REVISION,
                expected_model_file_count=13,
            )

    def test_rejects_mixed_model_snapshot_revisions(self) -> None:
        revisions = [EXPECTED_MODEL_REVISION] * 12 + ["wrong"]
        with self.assertRaisesRegex(ValueError, "model snapshot"):
            validate_runtime_provenance(
                source_head=EXPECTED_SOURCE_REVISION,
                source_dirty=False,
                model_metadata_revisions=revisions,
                expected_source_revision=EXPECTED_SOURCE_REVISION,
                expected_model_revision=EXPECTED_MODEL_REVISION,
                expected_model_file_count=13,
            )


class Ebur128ParserTests(unittest.TestCase):
    def test_uses_final_summary(self) -> None:
        parsed = parse_ebur128_summary(
            "I: -70.0 LUFS\nPeak: -10.0 dBFS\n"
            "Summary:\nI: -15.8 LUFS\nPeak: -0.9 dBFS\n"
        )
        self.assertEqual(parsed, {"integratedLufs": -15.8, "truePeakDbtp": -0.9})

    def test_parses_silence_as_non_finite(self) -> None:
        parsed = parse_ebur128_summary("I: -inf LUFS\nPeak: -inf dBFS\n")
        self.assertFalse(parsed["integratedLufs"] > float("-inf"))


if __name__ == "__main__":
    unittest.main()
