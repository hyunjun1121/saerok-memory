from collections import Counter
from app.services.query import semantic_search
from app.core.database import SessionLocal
from app.core.models import EventEntity, Entity
from sqlalchemy import select

def answer(user_id: str, question: str, top_k: int = 8, start_date=None, end_date=None):
    hits = semantic_search(user_id, question, top_k, start_date, end_date)
    evidence = []
    entity_counter = Counter()

    with SessionLocal() as db:
        for score, ep in hits:
            rows = db.execute(
                select(EventEntity, Entity)
                .join(Entity, Entity.id == EventEntity.entity_id)
                .where(EventEntity.episode_id == ep.id)
            ).all()
            entities = []
            for rel, ent in rows:
                entities.append({
                    "type": ent.entity_type,
                    "value": ent.value,
                    "relation": rel.relation
                })
                entity_counter[(ent.entity_type, ent.value)] += 1
            evidence.append({
                "episode_id": ep.id,
                "date": ep.occurred_at,
                "score": round(float(score), 4),
                "quote": ep.transcript,
                "entities": entities,
                "confidence": ep.confidence,
                "sensitive": ep.sensitive,
            })

    usable = [e for e in evidence if e["score"] > 0]
    if not usable:
        return {
            "answer": "검색된 개인 기록만으로는 답할 수 없습니다.",
            "uncertainty": "관련 근거가 없습니다.",
            "evidence": []
        }

    dates = sorted({e["date"] for e in usable})
    facts = [f"{t}: {v}" for (t, v), _ in entity_counter.most_common(10)]
    answer_text = (
        f"기록된 개인 발화에서 관련성이 높은 {len(usable)}개 근거를 찾았습니다. "
        f"기간은 {dates[0]}부터 {dates[-1]}까지입니다. "
    )
    if facts:
        answer_text += "주요 구조화 항목은 " + ", ".join(facts) + "입니다. "
    answer_text += "아래 원문 근거를 상담인이 확인해야 합니다."

    return {
        "answer": answer_text,
        "time_range": {"start": dates[0], "end": dates[-1]},
        "uncertainty": "자동 요약은 진단이나 임상 해석이 아니며, 낮은 신뢰도·민감 기록은 원문 확인이 필요합니다.",
        "evidence": usable
    }
