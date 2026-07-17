from __future__ import annotations

from collections import Counter, defaultdict

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.config import settings
from app.core.models import Entity, EventEntity
from app.services.query import semantic_search


def answer(
    user_id: str,
    question: str,
    top_k: int = 8,
    start_date: str | None = None,
    end_date: str | None = None,
    include_sensitive: bool = False,
) -> dict:
    hits = semantic_search(
        user_id,
        question,
        top_k,
        start_date,
        end_date,
        include_sensitive,
    )
    evidence: list[dict] = []
    entity_counter: Counter[tuple[str, str]] = Counter()
    threshold = max(-1.0, min(1.0, settings.qa_min_similarity))
    accepted_hits = [hit for hit in hits if hit[0] >= threshold]

    with SessionLocal() as db:
        episode_ids = [episode.id for _, episode in accepted_hits]
        grouped_entities: dict[str, list[tuple]] = defaultdict(list)
        if episode_ids:
            for relation, entity in db.execute(
                select(EventEntity, Entity)
                .join(Entity, Entity.id == EventEntity.entity_id)
                .where(EventEntity.episode_id.in_(episode_ids))
            ).all():
                grouped_entities[relation.episode_id].append((relation, entity))
        for score, episode in accepted_hits:
            entities = []
            for relation, entity in grouped_entities.get(episode.id, []):
                entities.append(
                    {
                        "type": entity.entity_type,
                        "value": entity.value,
                        "relation": relation.relation,
                    }
                )
                entity_counter[(entity.entity_type, entity.value)] += 1
            evidence.append(
                {
                    "episode_id": episode.id,
                    "response_type": episode.response_type,
                    "date": episode.occurred_at,
                    "score": round(float(score), 4),
                    "quote": episode.evidence_text,
                    "transcript": episode.transcript,
                    "entities": entities,
                    "confidence": episode.confidence,
                    "sensitive": episode.sensitive,
                }
            )

    usable = evidence
    if not usable:
        return {
            "answer": "검색된 개인 기록만으로는 답할 수 없습니다.",
            "uncertainty": "관련 근거가 없습니다.",
            "minimum_similarity": threshold,
            "evidence": [],
        }

    dates = sorted(
        {
            str(item["date"]).strip()
            for item in usable
            if item.get("date") is not None and str(item["date"]).strip()
        }
    )
    facts = [f"{kind}: {value}" for (kind, value), _ in entity_counter.most_common(10)]
    answer_text = f"기록된 응답에서 관련성이 높은 {len(usable)}개 근거를 찾았습니다. "
    if dates:
        answer_text += f"기간은 {dates[0]}부터 {dates[-1]}까지입니다. "
    if facts:
        answer_text += "주요 구조화 항목은 " + ", ".join(facts) + "입니다. "
    answer_text += "아래 원문 근거를 상담인이 확인해야 합니다."
    return {
        "answer": answer_text,
        "time_range": {"start": dates[0], "end": dates[-1]} if dates else None,
        "uncertainty": "자동 요약은 임상 해석이 아니며, 낮은 신뢰도 기록은 원문 확인이 필요합니다.",
        "minimum_similarity": threshold,
        "evidence": usable,
    }
