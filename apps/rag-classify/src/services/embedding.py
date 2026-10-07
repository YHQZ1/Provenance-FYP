import logging
from typing import List, Optional, Dict, Any

import numpy as np
from huggingface_hub import snapshot_download
from sentence_transformers import SentenceTransformer

from src.config import settings

logger = logging.getLogger(__name__)


class EmbeddingService:

    def __init__(self):
        self.model_name = settings.embedding_model
        self.vector_dimension = settings.vector_dimension
        self._model: Optional[SentenceTransformer] = None
        self._load_model()

    def _load_model(self):
        try:
            logger.info(f"Loading embedding model: {self.model_name}")

            model_path = snapshot_download(
                repo_id=self.model_name,
                cache_dir="/root/.cache/huggingface",
                allow_patterns=[
                    "*.json",
                    "*.txt",
                    "*.safetensors",
                    "*.model",
                    "*.vocab",
                ],
            )
            self._model = SentenceTransformer(
                model_path,
                device="cpu",
                cache_folder="/root/.cache/huggingface/sentence_transformers",
            )

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

    def encode(self, text: str, normalize: bool = True) -> List[float]:
        if not text or not text.strip():
            raise ValueError("Cannot encode empty text")

        try:
            embedding = self._model.encode(
                text, normalize_embeddings=normalize, convert_to_numpy=True, show_progress_bar=False
            )

            return embedding.tolist()

        except Exception as e:
            logger.error(f"Encoding failed for text: {text[:50]}... Error: {e}")
            raise

    def encode_batch(
        self, texts: List[str], normalize: bool = True, batch_size: int = 32
    ) -> List[List[float]]:
        if not texts:
            return []

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
            )

            return [emb.tolist() for emb in embeddings]

        except Exception as e:
            logger.error(f"Batch encoding failed: {e}")
            raise

    def get_model_info(self) -> Dict[str, Any]:
        if self._model is None:
            return {"status": "not_loaded"}

        return {
            "model_name": self.model_name,
            "vector_dimension": self.vector_dimension,
            "device": "cpu",
            "max_seq_length": self._model.max_seq_length,
            "normalize": True,
        }

    def calculate_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        a = np.array(vec1)
        b = np.array(vec2)

        dot = np.dot(a, b)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)

        if norm_a == 0 or norm_b == 0:
            return 0.0

        return float(dot / (norm_a * norm_b))


_embedding_service: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service


def encode_text(text: str) -> List[float]:
    return get_embedding_service().encode(text)


def encode_texts(texts: List[str]) -> List[List[float]]:
    return get_embedding_service().encode_batch(texts)
