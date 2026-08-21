# | Function           | What It Does             | Why We Need It                                |
# | ------------------ | ------------------------ | --------------------------------------------- |
# | `__init__`         | Loads MiniLM model       | One-time model load, reused for all encodings |
# | `encode()`         | Text → 384d vector       | Core transformation for RAG                   |
# | `encode_batch()`   | Multiple texts → vectors | Efficient bulk processing during seeding      |
# | `get_model_info()` | Debug/health check       | Verify model loaded correctly                 |

"""
Embedding service using sentence-transformers.
Converts text to 384-dimensional vectors for Qdrant search.
"""

import logging
from typing import List, Optional, Dict, Any

import numpy as np
from sentence_transformers import SentenceTransformer

from src.config import settings

logger = logging.getLogger(__name__)


class EmbeddingService:
    """
    Wrapper for sentence-transformers model.
    Thread-safe singleton for encoding text to vectors.
    """
    
    def __init__(self):
        """Load embedding model (one-time initialization)."""
        self.model_name = settings.embedding_model
        self.vector_dimension = settings.vector_dimension
        self._model: Optional[SentenceTransformer] = None
        self._load_model()
    
    def _load_model(self):
        """Load model from HuggingFace or local cache."""
        try:
            logger.info(f"Loading embedding model: {self.model_name}")
            
            # device='cpu' for Docker compatibility (no GPU in container)
            # cache_folder ensures model persists between container restarts
            self._model = SentenceTransformer(
                self.model_name,
                device='cpu',
                cache_folder='/root/.cache/torch/sentence_transformers'
            )
            
            # Verify dimensions match config
            actual_dim = self._model.get_sentence_embedding_dimension()
            if actual_dim != self.vector_dimension:
                raise ValueError(
                    f"Model dimension mismatch! "
                    f"Config: {self.vector_dimension}, Model: {actual_dim}"
                )
            
            logger.info(f"Model loaded: {actual_dim} dimensions, device=cpu")
            
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            raise RuntimeError(f"Cannot initialize embedding service: {e}")
    
    def encode(
        self,
        text: str,
        normalize: bool = True
    ) -> List[float]:
        """
        Encode single text to 384-dimensional vector.
        
        Args:
            text: Input text (e.g., "POLYPET 3020 Bottle Grade")
            normalize: If True, returns unit vector (length 1)
                      Required for cosine similarity to work correctly
            
        Returns:
            List of 384 floats (JSON-serializable)
        """
        if not text or not text.strip():
            raise ValueError("Cannot encode empty text")
        
        try:
            # model.encode returns numpy array
            embedding = self._model.encode(
                text,
                normalize_embeddings=normalize,
                convert_to_numpy=True,
                show_progress_bar=False
            )
            
            # Convert to Python list for JSON serialization
            return embedding.tolist()
            
        except Exception as e:
            logger.error(f"Encoding failed for text: {text[:50]}... Error: {e}")
            raise
    
    def encode_batch(
        self,
        texts: List[str],
        normalize: bool = True,
        batch_size: int = 32
    ) -> List[List[float]]:
        """
        Encode multiple texts efficiently.
        Used for seeding Qdrant with all material synonyms.
        
        Args:
            texts: List of strings to encode
            normalize: Normalize to unit vectors
            batch_size: Process this many at once (memory/speed tradeoff)
            
        Returns:
            List of vectors (parallel to input texts)
        """
        if not texts:
            return []
        
        # Filter empty strings
        valid_texts = [t for t in texts if t and t.strip()]
        if len(valid_texts) != len(texts):
            logger.warning(f"Skipped {len(texts) - len(valid_texts)} empty texts")
        
        try:
            logger.info(f"Batch encoding {len(valid_texts)} texts...")
            
            embeddings = self._model.encode(
                valid_texts,
                normalize_embeddings=normalize,
                batch_size=batch_size,
                convert_to_numpy=True,
                show_progress_bar=True,
                # Speed optimizations for CPU
                precision='float32'  # Not float16, CPU prefers full precision
            )
            
            # Convert numpy 2D array to list of lists
            return [emb.tolist() for emb in embeddings]
            
        except Exception as e:
            logger.error(f"Batch encoding failed: {e}")
            raise
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model metadata for health checks."""
        if self._model is None:
            return {"status": "not_loaded"}
        
        return {
            "model_name": self.model_name,
            "vector_dimension": self.vector_dimension,
            "device": "cpu",
            "max_seq_length": self._model.max_seq_length,
            "normalize": True
        }
    
    def calculate_similarity(
        self,
        vec1: List[float],
        vec2: List[float]
    ) -> float:
        """
        Calculate cosine similarity between two vectors.
        Utility for debugging/validation.
        
        Args:
            vec1, vec2: Two 384-dimensional vectors
            
        Returns:
            Similarity score (-1 to 1, higher is more similar)
        """
        # Convert to numpy for vectorized math
        a = np.array(vec1)
        b = np.array(vec2)
        
        # Cosine similarity = dot product / (magnitudes)
        # If normalized, this simplifies to dot product
        dot = np.dot(a, b)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        
        if norm_a == 0 or norm_b == 0:
            return 0.0
        
        return float(dot / (norm_a * norm_b))


# Singleton instance
_embedding_service: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    """Get or create EmbeddingService singleton."""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service


# Convenience functions
def encode_text(text: str) -> List[float]:
    """Quick encode function."""
    return get_embedding_service().encode(text)


def encode_texts(texts: List[str]) -> List[List[float]]:
    """Quick batch encode function."""
    return get_embedding_service().encode_batch(texts)