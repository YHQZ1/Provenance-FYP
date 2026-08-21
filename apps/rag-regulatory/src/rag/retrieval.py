from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams

from src.config import QDRANT_COLLECTION, QDRANT_HOST, QDRANT_PORT, MIN_SCORE, TOP_K
from src.rag.embeddings import embed


client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT, check_compatibility=False)


def ensure_collection():
    if not client.collection_exists(QDRANT_COLLECTION):
        client.create_collection(
            collection_name=QDRANT_COLLECTION,
            vectors_config=VectorParams(size=384, distance=Distance.COSINE),
        )


def retrieve(query, top_k=TOP_K):
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
            results.append({
                "text": text,
                "source": payload.get("source", "Unknown source"),
                "category": payload.get("category"),
                "source_url": payload.get("source_url"),
                "score": point.score,
            })
    return results
