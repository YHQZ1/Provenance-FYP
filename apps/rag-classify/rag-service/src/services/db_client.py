# | Function                  | Purpose                                                             |
# | ------------------------- | ------------------------------------------------------------------- |
# | `get_material_synonyms()` | Fetch all trade names from `material_synonyms` table to seed Qdrant |
# | `save_classification()`   | Save RAG results to `document_classifications` table                |
# | `save_feedback()`         | Store human corrections for future model improvement                |
# | `get_material_by_code()`  | Lookup material details from `materials_master`                     |
# | `test_connection()`       | Health check for database connectivity                              |

# src/services/db_client.py
"""
PostgreSQL database client for Supabase.
Handles all database operations for the RAG service.
"""

import logging
from contextlib import contextmanager
from typing import Dict, List, Optional, Any
from datetime import datetime

import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import SimpleConnectionPool

from src.config import settings

logger = logging.getLogger(__name__)


class DatabaseClient:
    """
    PostgreSQL client with connection pooling.
    Optimized for Supabase but works with any PostgreSQL.
    """
    
    def __init__(self):
        self.pool: Optional[SimpleConnectionPool] = None
        self._connect()
    
    def _connect(self):
        """Initialize connection pool."""
        try:
            # Parse DATABASE_URL for psycopg2
            # Convert postgresql:// to psycopg2 format if needed
            db_url = str(settings.database_url)
            
            self.pool = SimpleConnectionPool(
                minconn=1,
                maxconn=10,
                dsn=db_url,
                # Supabase requires SSL, but local Docker might not
                # sslmode='require'  # Uncomment for production Supabase
            )
            logger.info("Database connection pool initialized")
        except Exception as e:
            logger.error(f"Failed to initialize database pool: {e}")
            raise
    
    @contextmanager
    def get_cursor(self, commit: bool = False):
        """
        Context manager for database transactions.
        Usage:
            with db.get_cursor(commit=True) as cur:
                cur.execute("INSERT ...")
        """
        if not self.pool:
            raise RuntimeError("Database not connected")
        
        conn = self.pool.getconn()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            yield cur
            if commit:
                conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"Database error: {e}")
            raise
        finally:
            cur.close()
            self.pool.putconn(conn)
    
    def test_connection(self) -> bool:
        """Health check - verify database is reachable."""
        try:
            with self.get_cursor() as cur:
                cur.execute("SELECT 1 as health_check")
                result = cur.fetchone()
                return result["health_check"] == 1
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False
    
    def get_material_synonyms(self) -> List[Dict[str, Any]]:
        """
        Fetch all material synonyms for seeding Qdrant.
        Joins with materials_master to get full material details.
        
        Returns:
            List of dicts with: synonym, material_code, material_name, category
        """
        query = """
            SELECT 
                ms.synonym,
                ms.material_code,
                mm.name as material_name,
                mm.category,
                ms.confidence_score as synonym_confidence
            FROM material_synonyms ms
            JOIN materials_master mm ON ms.material_code = mm.code
            WHERE ms.is_active = true
            ORDER BY ms.material_code, ms.synonym
        """
        
        try:
            with self.get_cursor() as cur:
                cur.execute(query)
                rows = cur.fetchall()
                return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Failed to fetch material synonyms: {e}")
            return []
    
    def get_material_by_code(self, code: str) -> Optional[Dict[str, Any]]:
        """
        Lookup material details by code (PET, HDPE, etc.).
        
        Args:
            code: Material code from materials_master
            
        Returns:
            Material details or None if not found
        """
        query = """
            SELECT code, name, category, description, 
                   cpc_code, pwm_rules
            FROM materials_master
            WHERE code = %s
        """
        
        try:
            with self.get_cursor() as cur:
                cur.execute(query, (code,))
                row = cur.fetchone()
                return dict(row) if row else None
        except Exception as e:
            logger.error(f"Failed to fetch material {code}: {e}")
            return None
    
    def save_classification(
        self,
        document_id: str,
        material_code: str,
        confidence_score: float,
        reasoning: str,
        matched_synonyms: List[Dict],
        extracted_quantity: Optional[Dict] = None,
        requires_human_review: bool = False,
        vector_similarity: Optional[float] = None,
        processing_time_ms: Optional[int] = None
    ) -> bool:
        """
        Save classification result to document_classifications table.
        Called after successful RAG classification.
        
        Args:
            document_id: UUID of the document being classified
            material_code: Predicted material code (PET, HDPE, etc.)
            confidence_score: Overall confidence (0-1)
            reasoning: LLM explanation
            matched_synonyms: Top synonyms from vector search
            extracted_quantity: Parsed quantity dict or None
            requires_human_review: Flag for low confidence
            vector_similarity: Best match similarity score
            processing_time_ms: Time taken to classify
            
        Returns:
            True if saved successfully
        """
        query = """
            INSERT INTO document_classifications (
                id,
                document_id,
                material_code,
                confidence_score,
                reasoning,
                matched_synonym,
                vector_similarity,
                quantity_kg,
                requires_human_review,
                created_at,
                metadata
            ) VALUES (
                gen_random_uuid(),
                %s, %s, %s, %s, %s, %s, %s, %s, NOW(), %s
            )
            RETURNING id
        """
        
        # Extract best synonym name for storage
        best_synonym = matched_synonyms[0]["synonym"] if matched_synonyms else None
        
        # Convert quantity to KG if present
        quantity_kg = None
        if extracted_quantity:
            qty = extracted_quantity.get("normalized_value", 0)
            unit = extracted_quantity.get("unit", "KG").upper()
            if unit == "MT":
                quantity_kg = qty * 1000  # Convert metric tons to KG
            else:
                quantity_kg = qty
        
        # Build metadata JSON
        metadata = {
            "matched_synonyms": matched_synonyms,
            "processing_time_ms": processing_time_ms,
            "model_used": settings.ollama_model
        }
        
        try:
            with self.get_cursor(commit=True) as cur:
                cur.execute(
                    query,
                    (
                        document_id,
                        material_code,
                        confidence_score,
                        reasoning,
                        best_synonym,
                        vector_similarity,
                        quantity_kg,
                        requires_human_review,
                        psycopg2.extras.Json(metadata)
                    )
                )
                result = cur.fetchone()
                if result:
                    logger.info(f"Saved classification {result['id']} for document {document_id}")
                    return True
                return False
        except Exception as e:
            logger.error(f"Failed to save classification: {e}")
            return False
    
    def save_feedback(
        self,
        classification_id: str,
        corrected_material_code: str,
        corrected_quantity: Optional[float] = None,
        notes: Optional[str] = None
    ) -> bool:
        """
        Save human feedback/correction for a classification.
        Updates both feedback table and marks classification as corrected.
        
        Args:
            classification_id: UUID of the classification record
            corrected_material_code: Human-corrected material code
            corrected_quantity: Corrected quantity if changed
            notes: Explanation of correction
            
        Returns:
            True if saved successfully
        """
        # Insert into classification_feedback
        feedback_query = """
            INSERT INTO classification_feedback (
                id,
                classification_id,
                corrected_material_code,
                corrected_quantity_kg,
                notes,
                created_at
            ) VALUES (
                gen_random_uuid(),
                %s, %s, %s, %s, NOW()
            )
        """
        
        # Update the original classification to mark as corrected
        update_query = """
            UPDATE document_classifications
            SET 
                corrected_material_code = %s,
                corrected_quantity_kg = %s,
                corrected_at = NOW()
            WHERE id = %s
        """
        
        try:
            with self.get_cursor(commit=True) as cur:
                # Save feedback
                cur.execute(
                    feedback_query,
                    (classification_id, corrected_material_code, corrected_quantity, notes)
                )
                
                # Update original record
                cur.execute(
                    update_query,
                    (corrected_material_code, corrected_quantity, classification_id)
                )
                
                logger.info(f"Saved feedback for classification {classification_id}")
                return True
        except Exception as e:
            logger.error(f"Failed to save feedback: {e}")
            return False
    
    def get_pending_classifications(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Fetch classifications pending human review.
        Useful for building review dashboards later.
        
        Args:
            limit: Max records to fetch
            
        Returns:
            List of pending classifications with document info
        """
        query = """
            SELECT 
                dc.id,
                dc.document_id,
                dc.material_code,
                dc.confidence_score,
                dc.reasoning,
                dc.quantity_kg,
                dc.created_at,
                d.raw_text,
                d.document_type,
                c.name as company_name
            FROM document_classifications dc
            JOIN documents d ON dc.document_id = d.id
            JOIN companies c ON d.company_id = c.id
            WHERE dc.requires_human_review = true
              AND dc.corrected_material_code IS NULL
            ORDER BY dc.confidence_score ASC
            LIMIT %s
        """
        
        try:
            with self.get_cursor() as cur:
                cur.execute(query, (limit,))
                rows = cur.fetchall()
                return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Failed to fetch pending classifications: {e}")
            return []


# Singleton instance
_db_client: Optional[DatabaseClient] = None


def get_db_client() -> DatabaseClient:
    """Get or create database client singleton."""
    global _db_client
    if _db_client is None:
        _db_client = DatabaseClient()
    return _db_client


# Convenience functions for direct import
def test_db_connection() -> bool:
    """Quick health check function."""
    return get_db_client().test_connection()


def fetch_material_synonyms() -> List[Dict[str, Any]]:
    """Fetch all synonyms for Qdrant seeding."""
    return get_db_client().get_material_synonyms()