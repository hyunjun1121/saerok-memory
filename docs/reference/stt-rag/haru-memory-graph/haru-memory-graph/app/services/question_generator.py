from datetime import date, timedelta
import random
from sqlalchemy import select
from app.core.database import SessionLocal
from app.core.models import Episode, Entity, EventEntity
from app.core.config import settings

TEMPLATES = {
    "WITH_PERSON": "전날 {context}와 관련해 함께한 사람은 누구였나요?",
    "OCCURRED_AT": "전날 말씀하신 활동이 있었던 곳은 어디인가요?",
    "INVOLVED_ACTIVITY": "전날 하셨다고 말씀한 활동은 무엇인가요?",
    "INVOLVED_FOOD": "전날 함께 드셨다고 말씀한 음식은 무엇인가요?",
    "PURCHASED": "전날 구매했다고 말씀한 것은 무엇인가요?",
    "CONSUMED": "전날 마셨거나 드셨다고 말씀한 것은 무엇인가요?",
}

def _distractors(db, user_id: str, entity_type: str, answer: str, limit: int = 3):
    values = db.scalars(
        select(Entity.value)
        .where(Entity.user_id == user_id, Entity.entity_type == entity_type, Entity.value != answer)
        .distinct()
    ).all()
    safe = [v for v in values if v != answer]
    fillers = {
        "인물": ["복지관 직원", "동네 지인", "혼자"],
        "장소": ["복지관", "시장", "도서관"],
        "음식": ["된장찌개", "잔치국수", "김치전"],
        "구매물품": ["감자", "양파", "두부"],
        "활동": ["산책", "독서", "전화 통화"],
    }.get(entity_type, ["기억나지 않음", "다른 항목", "해당 없음"])
    pool = list(dict.fromkeys(safe + fillers))
    return pool[:limit]

def generate(user_id: str, target_date: str, count: int = 4):
    target = date.fromisoformat(target_date)
    source_date = (target - timedelta(days=1)).isoformat()
    generated = []

    with SessionLocal() as db:
        episodes = db.scalars(
            select(Episode)
            .where(Episode.user_id == user_id, Episode.occurred_at == source_date)
            .order_by(Episode.id)
        ).all()

        for ep in episodes:
            if ep.confidence < settings.min_question_confidence:
                continue
            if ep.sensitive and not settings.allow_sensitive_question_generation:
                continue

            rows = db.execute(
                select(EventEntity, Entity)
                .join(Entity, Entity.id == EventEntity.entity_id)
                .where(EventEntity.episode_id == ep.id)
            ).all()

            for rel, ent in rows:
                if rel.relation not in TEMPLATES or ent.sensitive:
                    continue
                distractors = _distractors(db, user_id, ent.entity_type, ent.value)
                choices = [ent.value] + distractors
                choices = list(dict.fromkeys(choices))[:4]
                while len(choices) < 4:
                    choices.append(f"기타 {len(choices)+1}")
                random.Random(f"{ep.id}:{ent.id}").shuffle(choices)
                generated.append({
                    "question_id": f"AUTO-{target_date}-{len(generated)+1:02d}",
                    "target_date": target_date,
                    "source_episode_id": ep.id,
                    "source_date": source_date,
                    "prompt": TEMPLATES[rel.relation].format(context="그 일"),
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
                        "requires_review": False,
                    }
                })
                if len(generated) >= count:
                    return generated
    return generated
