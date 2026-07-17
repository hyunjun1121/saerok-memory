from __future__ import annotations

import re
from typing import Any


RELATION_BY_TYPE = {
    "인물": "WITH_PERSON",
    "오늘 인물": "WITH_PERSON",
    "장소": "OCCURRED_AT",
    "활동": "INVOLVED_ACTIVITY",
    "오늘 활동": "INVOLVED_ACTIVITY",
    "음식": "INVOLVED_FOOD",
    "주간 핵심 음식": "INVOLVED_FOOD",
    "구매물품": "PURCHASED",
    "음료": "CONSUMED",
    "감정": "EXPRESSED_EMOTION",
    "신체상태": "HAS_BODY_STATE",
    "계획": "HAS_PLAN",
    "수량": "HAS_QUANTITY",
    "대화주제": "DISCUSSED_TOPIC",
    "주간 핵심 기억": "SALIENT_MEMORY",
}
SENSITIVE_TYPES = {"신체상태", "질병", "약", "복약", "건강"}
SENSITIVE_TRANSCRIPT_PATTERNS = (
    re.compile(
        r"혈압|당뇨|질환|치료|진료|병원|복약|복용|약을|약이|약은|통증|아프|수술|"
        r"주민등록|계좌번호|비밀번호|전화번호|휴대전화|집\s*주소",
        re.IGNORECASE,
    ),
    re.compile(r"\b(?:01[016789])[- ]?\d{3,4}[- ]?\d{4}\b"),
    re.compile(r"\b\d{6}[- ]?[1-4]\d{6}\b"),
    re.compile(r"病院|薬|血圧|糖尿|治療|手術"),
    re.compile(r"hospital|medication|blood pressure|account number|password", re.IGNORECASE),
)


def canonicalize(value: str) -> str:
    normalized = re.sub(r"\s+", " ", value.strip())
    return (
        normalized.replace("친구 ", "")
        .replace("이웃 ", "")
        .replace("딸 ", "")
        .replace("손자 ", "")
    )


def _is_sensitive(entity_type: str) -> bool:
    return any(key in entity_type for key in SENSITIVE_TYPES)


def transcript_requires_sensitive_handling(transcript: str | None) -> bool:
    if not transcript:
        return False
    return any(pattern.search(transcript) is not None for pattern in SENSITIVE_TRANSCRIPT_PATTERNS)


def extract_explicit_voice_annotations(
    question_record: dict[str, Any],
    confidence: float | None,
) -> list[dict[str, Any]]:
    """Use only explicit, allow-listed annotations from a voice response.

    This deliberately performs no transcript NER and is never called for choice
    or sequence responses, preventing wrong answers from becoming personal facts.
    """

    response = question_record.get("response") or {}
    annotations = response.get("derived_annotations") or {}
    if annotations.get("status") not in {None, "completed"}:
        return []

    result: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for raw in annotations.get("items") or []:
        if not isinstance(raw, dict):
            continue
        entity_type = str(raw.get("entity_type", "")).strip()[:40]
        value = str(raw.get("value", "")).strip()[:120]
        if entity_type not in RELATION_BY_TYPE or not value:
            continue
        canonical_value = canonicalize(value)
        key = (entity_type, canonical_value)
        if not canonical_value or key in seen:
            continue
        seen.add(key)
        result.append(
            {
                "entity_type": entity_type,
                "value": value,
                "canonical_value": canonical_value,
                "relation": RELATION_BY_TYPE[entity_type],
                "sensitive": _is_sensitive(entity_type),
                "confidence": confidence,
            }
        )
    return result
