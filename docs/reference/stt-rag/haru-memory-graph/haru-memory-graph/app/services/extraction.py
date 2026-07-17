import re

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

def canonicalize(value: str) -> str:
    value = re.sub(r"\s+", " ", value.strip())
    value = value.replace("친구 ", "").replace("이웃 ", "")
    value = value.replace("딸 ", "").replace("손자 ", "")
    return value

def extract_items(question_record: dict) -> list[dict]:
    response = question_record.get("response", {})
    annotations = response.get("derived_annotations", {})
    result = []
    for item in annotations.get("items", []) or []:
        et = str(item.get("entity_type", "기타"))
        value = str(item.get("value", "")).strip()
        if not value:
            continue
        result.append({
            "entity_type": et,
            "value": value,
            "canonical_value": canonicalize(value),
            "relation": RELATION_BY_TYPE.get(et, "HAS_ATTRIBUTE"),
            "sensitive": any(key in et for key in SENSITIVE_TYPES),
            "confidence": float(response.get("stt", {}).get("confidence") or 1.0),
        })
    return result
