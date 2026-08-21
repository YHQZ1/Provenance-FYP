# src/services/vector_store.py
"""
Qdrant vector database client for material synonym search.
Handles embedding storage and similarity search.
"""

import logging
from typing import Dict, List, Optional, Any

from qdrant_client import QdrantClient
from qdrant_client.http import models
from qdrant_client.http.exceptions import UnexpectedResponse

from src.config import settings

logger = logging.getLogger(__name__)


class VectorStore:
    """
    Manages Qdrant vector database for material synonym embeddings.
    Collection: material_synonyms (384-dim vectors, cosine similarity)
    """
    
    def __init__(self):
        """Initialize Qdrant client."""
        self.client = QdrantClient(
            host=settings.qdrant_host,
            port=settings.qdrant_port,
            prefer_grpc=False  # HTTP is fine for our scale
        )
        self.collection_name = settings.qdrant_collection_name
        self.vector_size = settings.vector_dimension
        
        logger.info(f"VectorStore initialized: {settings.qdrant_host}:{settings.qdrant_port}")
    
    def ensure_collection(self) -> bool:
        """
        Create collection if it doesn't exist.
        Idempotent - safe to call multiple times.
        
        Collection config:
        - 384 dimensions (MiniLM-L6-v2 output)
        - Cosine similarity (best for semantic similarity)
        - HNSW index for fast ANN search
        
        Returns:
            True if collection exists/created successfully
        """
        try:
            # Check if collection exists
            collections = self.client.get_collections().collections
            exists = any(c.name == self.collection_name for c in collections)
            
            if exists:
                logger.info(f"Collection '{self.collection_name}' already exists")
                return True
            
            # Create new collection
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=models.VectorParams(
                    size=self.vector_size,
                    distance=models.Distance.COSINE,
                    # HNSW config for approximate nearest neighbor search
                    hnsw_config=models.HnswConfigDiff(
                        m=16,  # Number of edges per node (higher = more accurate, slower)
                        ef_construct=100,  # Build-time accuracy
                    )
                ),
                # Keep vectors in RAM (fast), payload on disk if needed
                optimizers_config=models.OptimizersConfigDiff(
                    indexing_threshold=1000,  # Start indexing after 1k vectors
                ),
                on_disk_payload=False  # Small payload, keep in RAM
            )
            
            logger.info(f"Created collection '{self.collection_name}' ({self.vector_size}d, cosine)")
            return True
            
        except Exception as e:
            logger.error(f"Failed to ensure collection: {e}")
            return False
    
    def upsert_synonyms(
        self,
        synonyms: List[Dict[str, Any]],
        embeddings: List[List[float]],
        batch_size: int = 100
    ) -> bool:
        """
        Upload material synonyms with their embeddings to Qdrant.
        Called once during setup to seed the vector database.
        
        Args:
            synonyms: List of dicts with keys: synonym, material_code, material_name, category
            embeddings: List of 384-dimensional vectors (parallel array to synonyms)
            batch_size: Upload in batches to avoid memory issues
            
        Returns:
            True if all upserts successful
        """
        if len(synonyms) != len(embeddings):
            raise ValueError(f"Mismatch: {len(synonyms)} synonyms vs {len(embeddings)} embeddings")
        
        total = len(synonyms)
        logger.info(f"Upserting {total} synonyms to Qdrant...")
        
        try:
            # Process in batches
            for i in range(0, total, batch_size):
                batch_synonyms = synonyms[i:i + batch_size]
                batch_embeddings = embeddings[i:i + batch_size]
                
                points = []
                for idx, (syn, emb) in enumerate(zip(batch_synonyms, batch_embeddings)):
                    # Create unique ID from material_code + synonym hash
                    # Example: "PET_POLYPET_3020" → deterministic ID
                    point_id = f"{syn['material_code']}_{hash(syn['synonym'])}"
                    
                    points.append(
                        models.PointStruct(
                            id=point_id,
                            vector=emb,
                            payload={
                                "synonym": syn["synonym"],
                                "material_code": syn["material_code"],
                                "material_name": syn["material_name"],
                                "category": syn.get("category", "UNKNOWN"),
                                "confidence": syn.get("synonym_confidence", 1.0)
                            }
                        )
                    )
                
                # Upload batch
                self.client.upsert(
                    collection_name=self.collection_name,
                    points=points
                )
                
                logger.debug(f"Uploaded batch {i//batch_size + 1}/{(total-1)//batch_size + 1}")
            
            logger.info(f"Successfully upserted {total} synonyms")
            return True
            
        except Exception as e:
            logger.error(f"Failed to upsert synonyms: {e}")
            return False
    
    def search_similar(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        score_threshold: float = 0.6
    ) -> List[Dict[str, Any]]:
        """
        Find most similar material synonyms for a query embedding.
        Core RAG retrieval step.
        
        Args:
            query_embedding: 384-dim vector from embedding model
            top_k: Number of results to return (default 5)
            score_threshold: Minimum similarity (0-1), lower = more permissive
            
        Returns:
            List of matches with: synonym, material_code, material_name, score
        """
        try:
            results = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_embedding,
                limit=top_k,
                score_threshold=score_threshold,
                # HNSW search parameter: higher = more accurate, slower
                search_params=models.SearchParams(hnsw_ef=128)
            )
            
            matches = []
            for result in results:
                matches.append({
                    "synonym": result.payload["synonym"],
                    "material_code": result.payload["material_code"],
                    "material_name": result.payload["material_name"],
                    "category": result.payload["category"],
                    "similarity_score": round(result.score, 4),
                    "vector_id": result.id
                })
            
            logger.debug(f"Found {len(matches)} similar synonyms (threshold {score_threshold})")
            return matches
            
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return []
    
    def delete_collection(self) -> bool:
        """
        Delete entire collection. 
        USE WITH CAUTION - for testing/reset only.
        """
        try:
            self.client.delete_collection(self.collection_name)
            logger.warning(f"Deleted collection '{self.collection_name}'")
            return True
        except UnexpectedResponse:
            # Collection doesn't exist, that's fine
            return True
        except Exception as e:
            logger.error(f"Failed to delete collection: {e}")
            return False
    
    def get_collection_info(self) -> Optional[Dict[str, Any]]:
        """
        Get collection statistics for health checks.
        
        Returns:
            Dict with vector_count, dimension, distance metric
        """
        try:
            info = self.client.get_collection(self.collection_name)
            return {
                "name": info.config.params.vectors.on_disk,
                "vector_count": info.points_count,
                "dimension": info.config.params.vectors.size,
                "distance": info.config.params.vectors.distance.value,
                "indexed_vectors": info.indexed_vectors_count
            }
        except Exception as e:
            logger.error(f"Failed to get collection info: {e}")
            return None
    
    def count_vectors(self) -> int:
        """Quick count of vectors in collection."""
        try:
            result = self.client.count(collection_name=self.collection_name)
            return result.count
        except Exception:
            return 0


# Singleton instance
_vector_store: Optional[VectorStore] = None


def get_vector_store() -> VectorStore:
    """Get or create VectorStore singleton."""
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStore()
    return _vector_store