from app.services.ingestion import ingest_file
from app.services.projection import refresh_projection
from app.services.query import timeline, galaxy
from app.services.question_generator import generate
from app.services.qa import answer

SEED = "data/haru_7day_admin_usage_records.json"
USER = "USR-000001"

def test_ingestion_and_timeline():
    result = ingest_file(SEED)
    assert result["episodes"] >= 8
    rows = timeline(USER)
    assert any("유성시장" in r["transcript"] for r in rows)
    assert any(any(e["value"] == "김치전" for e in r["entities"]) for r in rows)

def test_projection_and_galaxy():
    refresh_projection(USER)
    data = galaxy(USER)
    assert len(data["nodes"]) >= 8
    assert all("fx" in n for n in data["nodes"])

def test_question_generation():
    questions = generate(USER, "2026-07-27", 4)
    assert questions
    assert all(q["source_date"] == "2026-07-26" for q in questions)
    assert all(len(q["choices"]) == 4 for q in questions)

def test_grounded_qa():
    result = answer(USER, "가족과 김치전을 먹은 기록", 5)
    assert result["evidence"]
    assert any("김치전" in e["quote"] for e in result["evidence"])
