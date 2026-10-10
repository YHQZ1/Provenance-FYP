import logging
import threading

from fastapi import FastAPI

from src.routers import health, classify, seed
from src.config import settings
from src.observability import instrument
from src.services.rag_pipeline import get_pipeline

logger = logging.getLogger(__name__)

app = FastAPI(
    title="EPR RAG Service",
    description="Retrieval-Augmented Generation for plastic material classification",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

instrument(app, "rag-classify")

app.include_router(health.router)
app.include_router(classify.router)
app.include_router(seed.router)


@app.on_event("startup")
async def startup_event():
    logger.info("Starting RAG Service...")
    logger.info(f"Embedding model: {settings.embedding_model}")
    logger.info(f"LLM model: {settings.ollama_model}")
    logger.info(f"Qdrant: {settings.qdrant_host}:{settings.qdrant_port}")

    def warm_up():
        try:
            get_pipeline().seed_if_empty()
        except Exception as error:
            logger.error(f"Startup warm-up failed: {error}")

    threading.Thread(target=warm_up, daemon=True).start()


@app.get("/")
async def root():
    return {"service": "EPR RAG Service", "version": "0.1.0", "docs": "/docs", "health": "/health"}
