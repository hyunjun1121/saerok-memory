from __future__ import annotations

import re
from collections.abc import Iterable, Mapping, Sequence
from typing import Any


def validate_generation_request(
    seeds: Sequence[int],
    *,
    max_new_tokens: int,
) -> tuple[int, ...]:
    if not seeds:
        raise ValueError("At least one seed is required")
    normalized = tuple(int(seed) for seed in seeds)
    if len(normalized) != len(set(normalized)):
        raise ValueError("Seeds contain a duplicate value")
    if max_new_tokens <= 0:
        raise ValueError("max_new_tokens must be positive")
    return normalized


def merge_generation_records(
    existing: Iterable[Mapping[str, Any]],
    new: Iterable[Mapping[str, Any]],
) -> list[dict[str, Any]]:
    merged: dict[int, dict[str, Any]] = {}
    for source, collision_message in (
        (existing, "Existing generation metadata contains a duplicate seed"),
        (new, "Seed already exists in generation metadata"),
    ):
        for raw_record in source:
            record = dict(raw_record)
            seed = int(record["seed"])
            if seed in merged:
                raise ValueError(f"{collision_message}: {seed}")
            merged[seed] = record
    return [merged[seed] for seed in sorted(merged)]


def validate_generation_provenance(
    records: Sequence[Mapping[str, Any]],
    summary: Mapping[str, Any],
    *,
    native_paths: Mapping[int, str],
    expected_seeds: Sequence[int],
    expected_text: str,
    expected_max_new_tokens: int,
    expected_source_revision: str,
    expected_model_id: str,
    expected_model_revision: str,
) -> None:
    expected = tuple(int(seed) for seed in expected_seeds)
    native_seed_set = set(int(seed) for seed in native_paths)
    if native_seed_set != set(expected) or len(native_paths) != len(expected):
        raise ValueError(
            f"Native seed set mismatch: expected {list(expected)}, "
            f"found {sorted(native_seed_set)}"
        )

    normalized_records = merge_generation_records(records, [])
    record_seeds = tuple(int(record["seed"]) for record in normalized_records)
    if record_seeds != tuple(sorted(expected)):
        raise ValueError(
            f"Generation metadata seed set mismatch: expected {sorted(expected)}, "
            f"found {list(record_seeds)}"
        )
    for record in normalized_records:
        seed = int(record["seed"])
        if record.get("text") != expected_text:
            raise ValueError(f"Seed {seed} prompt text does not match")
        if record.get("maxNewTokens") != expected_max_new_tokens:
            raise ValueError(f"Seed {seed} maxNewTokens does not match")
        if record.get("nativePath") != native_paths[seed]:
            raise ValueError(f"Seed {seed} nativePath does not match the native WAV")

    if summary.get("text") != expected_text:
        raise ValueError("Generation summary prompt text does not match")
    if summary.get("source", {}).get("revision") != expected_source_revision:
        raise ValueError("Generation summary source revision does not match")
    model = summary.get("model", {})
    if (
        model.get("id") != expected_model_id
        or model.get("revision") != expected_model_revision
    ):
        raise ValueError("Generation summary model provenance does not match")
    if summary.get("generationConfig", {}).get("maxNewTokens") != (
        expected_max_new_tokens
    ):
        raise ValueError("Generation summary maxNewTokens does not match")
    if summary.get("seeds") != list(sorted(expected)):
        raise ValueError("Generation summary seeds do not match")
    if summary.get("samples") != normalized_records:
        raise ValueError("Generation summary samples do not match metadata")


def parse_ebur128_summary(output: str) -> dict[str, float]:
    number = r"[-+]?(?:inf|(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+))"
    integrated = re.findall(rf"I:\s*({number}) LUFS", output, flags=re.IGNORECASE)
    peaks = re.findall(rf"Peak:\s*({number}) dBFS", output, flags=re.IGNORECASE)
    if not integrated or not peaks:
        raise ValueError("Could not parse ebur128 loudness summary")
    return {
        "integratedLufs": float(integrated[-1]),
        "truePeakDbtp": float(peaks[-1]),
    }
