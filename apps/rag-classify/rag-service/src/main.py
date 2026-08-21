# src/main.py
"""
FastAPI application entry point.
RAG Service for EPR plastic material classification.
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.routers import health, classify, seed
from src.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="EPR RAG Service",
    description="Retrieval-Augmented Generation for plastic material classification",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS - allow other backend to call us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your backend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router)
app.include_router(classify.router)
app.include_router(seed.router)


@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""
    logger.info("Starting RAG Service...")
    logger.info(f"Embedding model: {settings.embedding_model}")
    logger.info(f"LLM model: {settings.ollama_model}")
    logger.info(f"Qdrant: {settings.qdrant_host}:{settings.qdrant_port}")


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "EPR RAG Service",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health"
    }