import hashlib
import logging
from typing import Dict, List, Optional, Any

from qdrant_client import QdrantClient
from qdrant_client.http import models
from qdrant_client.http.exceptions import UnexpectedResponse

from src.config import settings

logger = logging.getLogger(__name__)


class VectorStore:

    def __init__(self):
        self.client = QdrantClient(
            host=settings.qdrant_host, port=settings.qdrant_port, prefer_grpc=False
        )
        self.collection_name = settings.qdrant_collection_name
        self.vector_size = settings.vector_dimension

        logger.info(f"VectorStore initialized: {settings.qdrant_host}:{settings.qdrant_port}")

    def ensure_collection(self) -> bool:
        try:
            collections = self.client.get_collections().collections
            exists = any(c.name == self.collection_name for c in collections)

            if exists:
                logger.info(f"Collection '{self.collection_name}' already exists")
                return True

            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=models.VectorParams(
                    size=self.vector_size,
                    distance=models.Distance.COSINE,
                    hnsw_config=models.HnswConfigDiff(
                        m=16,
                        ef_construct=100,
                    ),
                ),
                optimizers_config=models.OptimizersConfigDiff(
                    indexing_threshold=1000,
                ),
                on_disk_payload=False,
            )

            logger.info(
                f"Created collection '{self.collection_name}' ({self.vector_size}d, cosine)"
            )
            return True

        except Exception as e:
            logger.error(f"Failed to ensure collection: {e}")
            return False

    def upsert_synonyms(
        self, synonyms: List[Dict[str, Any]], embeddings: List[List[float]], batch_size: int = 100
    ) -> bool:
        if len(synonyms) != len(embeddings):
            raise ValueError(f"Mismatch: {len(synonyms)} synonyms vs {len(embeddings)} embeddings")

        total = len(synonyms)
        logger.info(f"Upserting {total} synonyms to Qdrant...")

        try:
            for i in range(0, total, batch_size):
                batch_synonyms = synonyms[i : i + batch_size]
                batch_embeddings = embeddings[i : i + batch_size]

                points = []
                for idx, (syn, emb) in enumerate(zip(batch_synonyms, batch_embeddings)):
                    point_key = f"{syn['material_code']}:{syn['synonym']}"
                    point_id = hashlib.sha256(point_key.encode("utf-8")).hexdigest()[:32]

                    points.append(
                        models.PointStruct(
                            id=point_id,
                            vector=emb,
                            payload={
                                "synonym": syn["synonym"],
                                "material_code": syn["material_code"],
                                "material_name": syn["material_name"],
                                "category": syn.get("category", "UNKNOWN"),
                                "confidence": syn.get("synonym_confidence", 1.0),
                            },
                        )
                    )

                self.client.upsert(collection_name=self.collection_name, points=points)

                logger.debug(f"Uploaded batch {i//batch_size + 1}/{(total-1)//batch_size + 1}")

            logger.info(f"Successfully upserted {total} synonyms")
            return True

        except Exception as e:
            logger.error(f"Failed to upsert synonyms: {e}")
            return False

    def search_similar(
        self, query_embedding: List[float], top_k: int = 5, score_threshold: float = 0.6
    ) -> List[Dict[str, Any]]:
        try:
            response = self.client.query_points(
                collection_name=self.collection_name,
                query=query_embedding,
                limit=top_k,
                score_threshold=score_threshold,
                search_params=models.SearchParams(hnsw_ef=128),
            )

            matches = []
            for result in response.points:
                matches.append(
                    {
                        "synonym": result.payload["synonym"],
                        "material_code": result.payload["material_code"],
                        "material_name": result.payload["material_name"],
                        "category": result.payload["category"],
                        "similarity_score": round(result.score, 4),
                        "vector_id": result.id,
                    }
                )

            logger.debug(f"Found {len(matches)} similar synonyms (threshold {score_threshold})")
            return matches

        except Exception as e:
            logger.error(f"Search failed: {e}")
            raise

    def delete_collection(self) -> bool:
        try:
            self.client.delete_collection(self.collection_name)
            logger.warning(f"Deleted collection '{self.collection_name}'")
            return True
        except UnexpectedResponse:
            return True
        except Exception as e:
            logger.error(f"Failed to delete collection: {e}")
            return False

    def get_collection_info(self) -> Optional[Dict[str, Any]]:
        try:
            info = self.client.get_collection(self.collection_name)
            return {
                "name": self.collection_name,
                "vector_count": info.points_count,
                "dimension": info.config.params.vectors.size,
                "distance": info.config.params.vectors.distance.value,
                "indexed_vectors": info.indexed_vectors_count,
            }
        except Exception as e:
            logger.error(f"Failed to get collection info: {e}")
            return None

    def count_vectors(self) -> int:
        try:
            result = self.client.count(collection_name=self.collection_name)
            return result.count
        except Exception:
            return 0


_vector_store: Optional[VectorStore] = None


def get_vector_store() -> VectorStore:
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStore()
    return _vector_store
