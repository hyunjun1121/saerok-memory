from __future__ import annotations

from contextlib import asynccontextmanager
from dataclasses import asdict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import settings
from app.core.database import init_db
from app.services.embedding import get_embedding_service
from app.services.graph_store import neo4j_health


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    get_embedding_service().load()
    yield


app = FastAPI(
    title="Haru Personal Memory RAG",
    version="2.0.0",
    description="Local evidence retrieval over Haru longitudinal usage records.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Idempotency-Key",
        "X-Haru-Content-Hash",
        "X-Haru-Local-Token",
    ],
)
app.include_router(router)


@app.get("/")
def root():
    return {
        "service": "haru-memory-rag",
        "version": "2.0.0",
        "health": "/health",
        "api_docs": "/docs",
    }


@app.get("/health")
def health():
    embedding = get_embedding_service().health()
    neo4j_ready, neo4j_error = neo4j_health()
    return {
        "status": "ok" if embedding.ready else "degraded",
        "service": "haru-memory-rag",
        "ready": embedding.ready,
        "embedding": asdict(embedding),
        "neo4j_enabled": settings.neo4j_enabled,
        "neo4j_ready": neo4j_ready,
        "neo4j_error": neo4j_error,
    }
