from datetime import datetime, timezone

import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from src.config import OLLAMA_HOST, OLLAMA_MODEL, QDRANT_COLLECTION, QDRANT_HOST, QDRANT_PORT
from src.rag.chatbot import chat
from src.rag.retrieval import client, ensure_collection


app = FastAPI(
    title="Provenance Regulatory RAG",
    version="0.1.0",
    description="Source-grounded regulatory research for Indian ESG and EPR workflows.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    query: str = Field(min_length=3, max_length=2000)


@app.get("/")
def root():
    return {"service": "regulatory-rag", "version": "0.1.0", "docs": "/docs"}


@app.get("/health")
def health():
    services = []
    try:
        client.get_collections()
        ensure_collection()
        services.append({"service": "qdrant", "status": "healthy", "collection": QDRANT_COLLECTION})
    except Exception as error:
        services.append({"service": "qdrant", "status": "unhealthy", "error": str(error)})

    try:
        response = requests.get(f"{OLLAMA_HOST}/api/tags", timeout=5)
        response.raise_for_status()
        models = [item.get("name") for item in response.json().get("models", [])]
        status = "healthy" if OLLAMA_MODEL in models else "degraded"
        services.append({"service": "ollama", "status": status, "model": OLLAMA_MODEL})
    except Exception as error:
        services.append({"service": "ollama", "status": "unhealthy", "error": str(error)})

    overall = "healthy" if all(item["status"] == "healthy" for item in services) else "degraded"
    return {
        "status": overall,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "collection": QDRANT_COLLECTION,
        "qdrant": f"{QDRANT_HOST}:{QDRANT_PORT}",
        "services": services,
    }


@app.post("/query")
def query(request: QueryRequest):
    return chat(request.query)
