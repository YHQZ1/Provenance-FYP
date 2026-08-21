# | Step | Action                             | Service Used       |
# | ---- | ---------------------------------- | ------------------ |
# | 1    | Encode input text → vector         | `EmbeddingService` |
# | 2    | Search Qdrant for similar synonyms | `VectorStore`      |
# | 3    | Parse quantity from text           | `QuantityParser`   |
# | 4    | Call LLM with candidates + context | `LocalLLMService`  |
# | 5    | Enrich result with metadata        | All services       |
# | 6    | Save to database (optional)        | `DatabaseClient`   |
# | 7    | Return structured response         | API layer          |

# src/services/rag_pipeline.py
"""
RAG Pipeline orchestrator.
Coordinates embedding, retrieval, and LLM classification.
"""

import logging
import time
from typing import Dict, List, Optional, Any

from src.config import settings
from src.services.embedding import get_embedding_service
from src.services.vector_store import get_vector_store
from src.services.local_llm import get_llm_service
from src.services.quantity_parser import parse_quantity
from src.services.db_client import get_db_client

logger = logging.getLogger(__name__)


class RAGPipeline:
    """
    End-to-end RAG pipeline for plastic material classification.
    """
    
    def __init__(self):
        self.embedding = get_embedding_service()
        self.vector_store = get_vector_store()
        self.llm = get_llm_service()
        self.db = get_db_client()
        
        # Ensure Qdrant collection exists
        self.vector_store.ensure_collection()
        
        logger.info("RAG Pipeline initialized")
    
    def classify(
        self,
        text: str,
        document_id: Optional[str] = None,
        company_id: Optional[str] = None,
        save_to_db: bool = False
    ) -> Dict[str, Any]:
        """
        Complete classification pipeline.
        
        Args:
            text: Raw text from invoice/certificate
            document_id: Optional UUID to link to existing document
            company_id: Optional company scoping
            save_to_db: Whether to persist result to PostgreSQL
            
        Returns:
            Complete classification result with metadata
        """
        start_time = time.time()
        
        try:
            # Step 1: Encode text to vector
            logger.debug("Step 1: Encoding text...")
            query_vector = self.embedding.encode(text)
            
            # Step 2: Retrieve similar synonyms from Qdrant
            logger.debug("Step 2: Retrieving from vector store...")
            candidates = self.vector_store.search_similar(
                query_vector=query_vector,
                top_k=settings.top_k_synonyms,
                score_threshold=0.5  # Lower threshold = more candidates
            )
            
            # Step 3: Extract quantity from text
            logger.debug("Step 3: Parsing quantity...")
            extracted_qty = parse_quantity(text)
            qty_str = extracted_qty["raw_value"] if extracted_qty else None
            
            # Step 4: LLM classification with context
            logger.debug("Step 4: LLM classification...")
            llm_result = self.llm.classify_material(
                text=text,
                candidate_materials=candidates,
                extracted_quantity=qty_str
            )
            
            # Step 5: Calculate processing time
            processing_time_ms = int((time.time() - start_time) * 1000)
            
            # Step 6: Build response
            result = {
                "success": True,
                "document_type": self._detect_document_type(text),
                "classifications": [self._build_classification_result(
                    llm_result, candidates, extracted_qty
                )],
                "raw_text": text,
                "processing_time_ms": processing_time_ms,
                "model_used": settings.ollama_model,
                "errors": None
            }
            
            # Step 7: Save to database if requested
            if save_to_db and document_id:
                self._save_classification(
                    document_id=document_id,
                    result=result["classifications"][0],
                    processing_time_ms=processing_time_ms
                )
            
            logger.info(f"Classification complete in {processing_time_ms}ms")
            return result
            
        except Exception as e:
            logger.error(f"Pipeline failed: {e}")
            return {
                "success": False,
                "document_type": "UNKNOWN",
                "classifications": [],
                "raw_text": text,
                "processing_time_ms": int((time.time() - start_time) * 1000),
                "model_used": settings.ollama_model,
                "errors": [str(e)]
            }
    
    def _detect_document_type(self, text: str) -> str:
        """
        Rule-based document type detection.
        """
        text_lower = text.lower()
        
        invoice_keywords = ["invoice", "bill", "tax", "gst", "amount", "supplier", "buyer", "total"]
        cert_keywords = ["certificate", "recycler", "recycling", "authorized", "processor", "compliance"]
        
        invoice_score = sum(1 for k in invoice_keywords if k in text_lower)
        cert_score = sum(1 for k in cert_keywords if k in text_lower)
        
        if invoice_score > cert_score:
            return "INVOICE"
        elif cert_score > invoice_score:
            return "CERTIFICATE"
        else:
            return "UNKNOWN"
    
    def _build_classification_result(
        self,
        llm_result: Dict[str, Any],
        candidates: List[Dict[str, Any]],
        extracted_qty: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Build standardized classification result."""
        
        # Get best matching synonym for metadata
        best_match = candidates[0] if candidates else None
        
        return {
            "material_code": llm_result["material_code"],
            "material_name": llm_result.get("material_name", "Unknown"),
            "cpcb_category": llm_result.get("cpcb_category", "UNKNOWN"),
            "confidence_score": llm_result["confidence"],
            "reasoning": llm_result["reasoning"],
            "matched_synonyms": candidates[:3],  # Top 3 for context
            "extracted_quantity": extracted_qty,
            "requires_human_review": llm_result["needs_human_review"],
            "vector_similarity": best_match["similarity_score"] if best_match else 0.0
        }
    
    def _save_classification(
        self,
        document_id: str,
        result: Dict[str, Any],
        processing_time_ms: int
    ) -> bool:
        """Persist result to PostgreSQL."""
        try:
            self.db.save_classification(
                document_id=document_id,
                material_code=result["material_code"],
                confidence_score=result["confidence_score"],
                reasoning=result["reasoning"],
                matched_synonyms=result["matched_synonyms"],
                extracted_quantity=result["extracted_quantity"],
                requires_human_review=result["requires_human_review"],
                vector_similarity=result["vector_similarity"],
                processing_time_ms=processing_time_ms
            )
            return True
        except Exception as e:
            logger.error(f"Failed to save classification: {e}")
            return False
    
    def seed_synonyms(self) -> bool:
        """
        One-time setup: Load material_synonyms from PostgreSQL,
        encode them, and upload to Qdrant.
        """
        try:
            logger.info("Starting synonym seeding...")
            
            # Fetch from PostgreSQL
            synonyms = self.db.get_material_synonyms()
            if not synonyms:
                logger.warning("No synonyms found in database")
                return False
            
            logger.info(f"Found {len(synonyms)} synonyms to encode")
            
            # Encode in batches
            texts = [s["synonym"] for s in synonyms]
            embeddings = self.embedding.encode_batch(texts, batch_size=64)
            
            # Upload to Qdrant
            success = self.vector_store.upsert_synonyms(synonyms, embeddings)
            
            if success:
                count = self.vector_store.count_vectors()
                logger.info(f"Seeding complete. Qdrant now has {count} vectors")
            
            return success
            
        except Exception as e:
            logger.error(f"Seeding failed: {e}")
            return False
    
    def health_check(self) -> Dict[str, Any]:
        """Check all pipeline components."""
        return {
            "embedding": self.embedding.get_model_info(),
            "vector_store": self.vector_store.get_collection_info(),
            "llm": self.llm.test_connection(),
            "database": self.db.test_connection()
        }


# Singleton
_pipeline: Optional[RAGPipeline] = None

def get_pipeline() -> RAGPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = RAGPipeline()
    return _pipeline


# Convenience function
def classify_text(text: str, **kwargs) -> Dict[str, Any]:
    """Quick classify function."""
    return get_pipeline().classify(text, **kwargs)
