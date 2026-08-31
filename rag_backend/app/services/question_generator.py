from datetime import date, timedelta
import random
from sqlalchemy import select
from app.core.database import SessionLocal
from app.core.models import Episode, Entity, EventEntity, User
from app.core.config import settings
from app.core.market import (
    DEFAULT_LOCALE,
    DEFAULT_MARKET,
    assert_matching_context,
    is_auto_question_text_safe,
    validate_market_locale,
)

TEMPLATES_BY_MARKET = {
    "kr": {
        "WITH_PERSON": "전날 함께했다고 말씀한 사람은 누구였나요?",
        "OCCURRED_AT": "전날 말씀하신 활동이 있었던 곳은 어디인가요?",
        "INVOLVED_ACTIVITY": "전날 하셨다고 말씀한 활동은 무엇인가요?",
        "INVOLVED_FOOD": "전날 함께 드셨다고 말씀한 음식은 무엇인가요?",
        "PURCHASED": "전날 구매했다고 말씀한 것은 무엇인가요?",
        "CONSUMED": "전날 마셨거나 드셨다고 말씀한 것은 무엇인가요?",
    },
    "jp": {
        "WITH_PERSON": "昨日、一緒に過ごした方はどなたでしたか？",
        "OCCURRED_AT": "昨日、どこで過ごしましたか？",
        "INVOLVED_ACTIVITY": "昨日、何をして過ごしましたか？",
        "INVOLVED_FOOD": "昨日、一緒に食べたものは何でしたか？",
        "PURCHASED": "昨日、買ったものは何でしたか？",
        "CONSUMED": "昨日、飲んだり食べたりしたものは何でしたか？",
    },
}

# Backward-compatible import for local scripts that used the Korean table.
TEMPLATES = TEMPLATES_BY_MARKET["kr"]

FILLERS_BY_MARKET = {
    "kr": {
        "WITH_PERSON": ["복지관 직원", "동네 지인", "혼자"],
        "OCCURRED_AT": ["복지관", "시장", "도서관"],
        "INVOLVED_FOOD": ["된장찌개", "잔치국수", "김치전"],
        "PURCHASED": ["감자", "양파", "두부"],
        "CONSUMED": ["보리차", "우유", "두유"],
        "INVOLVED_ACTIVITY": ["산책", "독서", "전화 통화"],
        "DEFAULT": ["기억나지 않음", "다른 항목", "해당 없음"],
    },
    "jp": {
        "WITH_PERSON": ["地域の職員", "近所の知り合い", "一人"],
        "OCCURRED_AT": ["地域の交流センター", "近所のスーパー", "図書館"],
        "INVOLVED_FOOD": ["うどん", "お好み焼き", "あんパン"],
        "PURCHASED": ["かぼちゃ", "長ねぎ", "豆腐"],
        "CONSUMED": ["麦茶", "牛乳", "緑茶"],
        "INVOLVED_ACTIVITY": ["散歩", "読書", "輪投げ"],
        "DEFAULT": ["思い出せない", "別のもの", "該当なし"],
    },
}


def _distractors(
    db,
    user_id: str,
    entity_type: str,
    answer: str,
    limit: int = 3,
    *,
    market: str = DEFAULT_MARKET,
    relation: str | None = None,
):
    values = db.scalars(
        select(Entity.value)
        .where(
            Entity.user_id == user_id,
            Entity.entity_type == entity_type,
            Entity.value != answer,
            Entity.sensitive.is_(False),
        )
        .distinct()
    ).all()
    safe = [
        value
        for value in values
        if value != answer and is_auto_question_text_safe(str(value), market)
    ]
    relation_by_legacy_type = {
        "인물": "WITH_PERSON",
        "장소": "OCCURRED_AT",
        "음식": "INVOLVED_FOOD",
        "구매물품": "PURCHASED",
        "음료": "CONSUMED",
        "활동": "INVOLVED_ACTIVITY",
        "人物": "WITH_PERSON",
        "場所": "OCCURRED_AT",
        "食べ物": "INVOLVED_FOOD",
        "購入品": "PURCHASED",
        "飲み物": "CONSUMED",
        "活動": "INVOLVED_ACTIVITY",
    }
    filler_key = relation or relation_by_legacy_type.get(entity_type, "DEFAULT")
    fillers = FILLERS_BY_MARKET[market].get(
        filler_key,
        FILLERS_BY_MARKET[market]["DEFAULT"],
    )
    pool = list(dict.fromkeys(safe + fillers))
    return pool[:limit]


def generate(
    user_id: str,
    target_date: str,
    count: int = 4,
    market: str = DEFAULT_MARKET,
    locale: str = DEFAULT_LOCALE,
):
    context = validate_market_locale(market, locale)
    target = date.fromisoformat(target_date)
    source_date = (target - timedelta(days=1)).isoformat()
    generated = []

    with SessionLocal() as db:
        user = db.get(User, user_id)
        if user is None:
            return []
        assert_matching_context(user.profile, context.market, context.locale)
        if user.consent.get("personalized_question_use") is not True:
            return []
        episodes = db.scalars(
            select(Episode)
            .where(Episode.user_id == user_id, Episode.occurred_at == source_date)
            .order_by(Episode.id)
        ).all()

        for ep in episodes:
            # Qwen3-ASR does not expose a calibrated confidence value. Missing
            # confidence must remain null, but it must not make every real
            # Qwen response unusable. Explicit, allow-listed annotations may
            # still ground a draft question; callers see requires_review=true.
            if (
                ep.confidence is not None
                and ep.confidence < settings.min_question_confidence
            ):
                continue
            if ep.sensitive and not settings.allow_sensitive_question_generation:
                continue

            rows = db.execute(
                select(EventEntity, Entity)
                .join(Entity, Entity.id == EventEntity.entity_id)
                .where(EventEntity.episode_id == ep.id)
            ).all()

            for rel, ent in rows:
                templates = TEMPLATES_BY_MARKET[context.market]
                if (
                    rel.relation not in templates
                    or ent.sensitive
                    or not is_auto_question_text_safe(ent.value, context.market)
                ):
                    continue
                distractors = _distractors(
                    db,
                    user_id,
                    ent.entity_type,
                    ent.value,
                    market=context.market,
                    relation=rel.relation,
                )
                choices = [ent.value] + distractors
                choices = list(dict.fromkeys(choices))[:4]
                while len(choices) < 4:
                    other = "その他" if context.market == "jp" else "기타"
                    choices.append(f"{other} {len(choices)+1}")
                random.Random(f"{ep.id}:{ent.id}").shuffle(choices)
                generated.append({
                    "question_id": f"AUTO-{user_id}-{target_date}-{len(generated)+1:02d}",
                    "target_date": target_date,
                    "source_episode_id": ep.id,
                    "source_date": source_date,
                    "market": context.market,
                    "locale": context.locale,
                    "prompt": templates[rel.relation],
                    "entity_type": ent.entity_type,
                    "relation": rel.relation,
                    "choices": [
                        {"button": b, "label": label}
                        for b, label in zip(["A", "B", "C", "D"], choices)
                    ],
                    "correct_answer": {
                        "label": ent.value,
                        "button": ["A", "B", "C", "D"][choices.index(ent.value)]
                    },
                    "confidence": ep.confidence,
                    "safety": {
                        "sensitive": ep.sensitive or ent.sensitive,
                        "requires_review": ep.confidence is None,
                        "review_reason": (
                            "confidence_unavailable" if ep.confidence is None else None
                        ),
                    }
                })
                if len(generated) >= count:
                    return generated
    return generated
