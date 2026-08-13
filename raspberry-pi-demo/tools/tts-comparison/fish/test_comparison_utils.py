from __future__ import annotations

import math
import unittest

from comparison_utils import (
    merge_generation_records,
    parse_ebur128_summary,
    validate_generation_provenance,
    validate_generation_request,
)


class GenerationRequestTests(unittest.TestCase):
    def test_rejects_duplicate_seeds_in_one_invocation(self) -> None:
        with self.assertRaisesRegex(ValueError, "duplicate"):
            validate_generation_request([4201, 4201], max_new_tokens=256)

    def test_rejects_non_positive_token_bound(self) -> None:
        with self.assertRaisesRegex(ValueError, "positive"):
            validate_generation_request([4201], max_new_tokens=0)

    def test_merges_complete_seed_provenance_without_overwrite(self) -> None:
        merged = merge_generation_records(
            [{"seed": 4201, "path": "first.wav"}],
            [{"seed": 4202, "path": "second.wav"}],
        )
        self.assertEqual([record["seed"] for record in merged], [4201, 4202])

    def test_rejects_cross_invocation_seed_collision(self) -> None:
        with self.assertRaisesRegex(ValueError, "already exists"):
            merge_generation_records(
                [{"seed": 4201}],
                [{"seed": 4201}],
            )


class Ebur128ParserTests(unittest.TestCase):
    def test_uses_final_integrated_loudness_and_true_peak_summary(self) -> None:
        output = """
        [Parsed_ebur128_0] I: -70.0 LUFS
        [Parsed_ebur128_0] Peak: -12.0 dBFS
        [Parsed_ebur128_0] I: -15.8 LUFS
        [Parsed_ebur128_0] Peak: -0.9 dBFS
        """
        self.assertEqual(
            parse_ebur128_summary(output),
            {"integratedLufs": -15.8, "truePeakDbtp": -0.9},
        )

    def test_rejects_unparseable_measurement(self) -> None:
        with self.assertRaisesRegex(ValueError, "parse"):
            parse_ebur128_summary("no summary here")

    def test_parses_silent_peak_as_non_finite_for_candidate_rejection(self) -> None:
        result = parse_ebur128_summary("I: -70.0 LUFS\nPeak: -inf dBFS")

        self.assertEqual(result["integratedLufs"], -70.0)
        self.assertTrue(math.isinf(result["truePeakDbtp"]))


class GenerationProvenanceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.expected_seeds = (4201, 4202)
        self.records = [
            {
                "seed": seed,
                "text": "same prompt",
                "maxNewTokens": 256,
                "nativePath": f"outputs/native/seed-{seed}.wav",
            }
            for seed in self.expected_seeds
        ]
        self.summary = {
            "source": {"revision": "source-revision"},
            "model": {"id": "model-id", "revision": "model-revision"},
            "text": "same prompt",
            "seeds": list(self.expected_seeds),
            "generationConfig": {"maxNewTokens": 256},
            "samples": self.records,
        }

    def validate(self, *, native_seeds: tuple[int, ...] | None = None) -> None:
        available_seeds = native_seeds or self.expected_seeds
        validate_generation_provenance(
            self.records,
            self.summary,
            native_paths={
                seed: f"outputs/native/seed-{seed}.wav" for seed in available_seeds
            },
            expected_seeds=self.expected_seeds,
            expected_text="same prompt",
            expected_max_new_tokens=256,
            expected_source_revision="source-revision",
            expected_model_id="model-id",
            expected_model_revision="model-revision",
        )

    def test_accepts_exact_native_metadata_and_summary_alignment(self) -> None:
        self.validate()

    def test_rejects_wrong_native_seed_despite_matching_file_count(self) -> None:
        with self.assertRaisesRegex(ValueError, "Native seed set"):
            self.validate(native_seeds=(4201, 9999))

    def test_rejects_generation_config_drift(self) -> None:
        self.records[1]["maxNewTokens"] = 128

        with self.assertRaisesRegex(ValueError, "maxNewTokens"):
            self.validate()

    def test_rejects_summary_that_does_not_match_authoritative_records(self) -> None:
        self.summary["samples"] = list(reversed(self.records))

        with self.assertRaisesRegex(ValueError, "samples"):
            self.validate()


if __name__ == "__main__":
    unittest.main()
