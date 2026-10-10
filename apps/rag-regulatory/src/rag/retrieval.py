from prometheus_client import Histogram
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams

from src.config import QDRANT_COLLECTION, QDRANT_HOST, QDRANT_PORT, MIN_SCORE, TOP_K
from src.rag.embeddings import embed

client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT, check_compatibility=False)

RETRIEVAL = Histogram(
    "retrieval_duration_seconds",
    "Embedding and vector search time for one query",
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
)


def ensure_collection():
    if not client.collection_exists(QDRANT_COLLECTION):
        client.create_collection(
            collection_name=QDRANT_COLLECTION,
            vectors_config=VectorParams(size=384, distance=Distance.COSINE),
        )


def retrieve(query, top_k=TOP_K):
    with RETRIEVAL.time():
        return _retrieve(query, top_k)


def _retrieve(query, top_k):
    ensure_collection()
    response = client.search(
        collection_name=QDRANT_COLLECTION,
        query_vector=embed([query])[0].tolist(),
        limit=top_k,
        with_payload=True,
    )

    results = []
    for point in response:
        if point.score < MIN_SCORE:
            continue
        payload = point.payload or {}
        text = payload.get("text")
        if text:
            results.append(
                {
                    "text": text,
                    "source": payload.get("source", "Unknown source"),
                    "category": payload.get("category"),
                    "source_url": payload.get("source_url"),
                    "page": payload.get("page"),
                    "score": point.score,
                }
            )
    return results
