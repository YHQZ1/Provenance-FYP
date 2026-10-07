from datetime import datetime, timezone
from pathlib import Path

import requests
import yaml
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from src.config import (
    CORS_ORIGINS,
    OLLAMA_HOST,
    OLLAMA_MODEL,
    QDRANT_COLLECTION,
    QDRANT_HOST,
    QDRANT_PORT,
)
from src.rag.chatbot import chat
from src.rag.retrieval import client, ensure_collection, retrieve
from src.rag.text import cite, group_sources
from qdrant_client.http.models import FieldCondition, Filter, MatchValue

SOURCES_FILE = Path(__file__).parent / "config" / "sources.yaml"


app = FastAPI(
    title="Provenance Regulatory RAG",
    version="0.1.0",
    description="Source-grounded regulatory research for Indian ESG and EPR workflows.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    query: str = Field(min_length=3, max_length=2000)


class SearchRequest(BaseModel):
    query: str = Field(min_length=3, max_length=2000)
    top_k: int = Field(default=4, ge=1, le=10)


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
    try:
        return chat(request.query)
    except requests.Timeout as error:
        raise HTTPException(
            status_code=504, detail="The language model took too long to answer."
        ) from error
    except requests.RequestException as error:
        raise HTTPException(
            status_code=503, detail=f"The language model is unavailable: {error}"
        ) from error


@app.post("/search")
def search(request: SearchRequest):
    contexts = retrieve(request.query, top_k=request.top_k)
    return {
        "passages": [
            {
                "text": item["text"],
                "source": item["source"],
                "page": item.get("page"),
                "url": item.get("source_url"),
                "score": round(item["score"], 4),
                "citation": cite(item),
            }
            for item in contexts
        ],
        "sources": group_sources(contexts),
    }


@app.get("/sources")
def sources():
    with open(SOURCES_FILE, "r", encoding="utf-8") as handle:
        configured = yaml.safe_load(handle).get("sources", [])

    library = []
    for source in configured:
        try:
            passages = client.count(
                collection_name=QDRANT_COLLECTION,
                count_filter=Filter(
                    must=[FieldCondition(key="source_url", match=MatchValue(value=source["url"]))]
                ),
                exact=True,
            ).count
        except Exception:
            passages = None
        library.append(
            {
                "title": source["title"],
                "category": source.get("category"),
                "url": source["url"],
                "passages": passages,
                "ingested": bool(passages),
            }
        )
    return {"sources": library}
