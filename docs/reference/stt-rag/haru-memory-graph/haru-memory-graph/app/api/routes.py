from fastapi import APIRouter, UploadFile, File, HTTPException
import json
from app.core.config import settings
from app.core.schemas import QARequest, QuestionGenerateRequest
from app.services.ingestion import ingest_file, ingest_payload
from app.services.projection import refresh_projection
from app.services.query import timeline, graph, galaxy, evidence, review_queue
from app.services.qa import answer
from app.services.question_generator import generate

router = APIRouter(prefix="/api")

@router.post("/ingest/seed")
def ingest_seed():
    result = ingest_file(settings.seed_json_path)
    result["projection"] = refresh_projection()
    return result

@router.post("/ingest/json")
async def ingest_json(file: UploadFile = File(...)):
    try:
        payload = json.loads((await file.read()).decode("utf-8"))
    except Exception as exc:
        raise HTTPException(400, f"Invalid JSON: {exc}")
    result = ingest_payload(payload)
    result["projection"] = refresh_projection()
    return result

@router.get("/users/{user_id}/timeline")
def get_timeline(user_id: str):
    return timeline(user_id)

@router.get("/users/{user_id}/graph")
def get_graph(user_id: str):
    return graph(user_id)

@router.get("/users/{user_id}/galaxy")
def get_galaxy(user_id: str):
    return galaxy(user_id)

@router.get("/users/{user_id}/evidence/{episode_id}")
def get_evidence(user_id: str, episode_id: str):
    result = evidence(user_id, episode_id)
    if not result:
        raise HTTPException(404, "Episode not found")
    return result

@router.get("/users/{user_id}/review-queue")
def get_review_queue(user_id: str):
    return review_queue(user_id)

@router.post("/users/{user_id}/qa")
def qa(user_id: str, request: QARequest):
    return answer(
        user_id, request.question, request.top_k,
        request.start_date, request.end_date
    )

@router.post("/users/{user_id}/questions/generate")
def generate_questions(user_id: str, request: QuestionGenerateRequest):
    return {
        "user_id": user_id,
        "target_date": request.target_date,
        "questions": generate(user_id, request.target_date, request.count)
    }
