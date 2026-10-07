import logging
from contextlib import contextmanager
from typing import Dict, List, Optional, Any

from psycopg2.extras import RealDictCursor
from psycopg2.pool import SimpleConnectionPool

from src.config import settings

logger = logging.getLogger(__name__)


class DatabaseClient:

    def __init__(self):
        self.pool: Optional[SimpleConnectionPool] = None
        self._connect()

    def _connect(self):
        try:
            db_url = str(settings.database_url)

            self.pool = SimpleConnectionPool(
                minconn=1,
                maxconn=10,
                dsn=db_url,
            )
            logger.info("Database connection pool initialized")
        except Exception as e:
            logger.error(f"Failed to initialize database pool: {e}")
            raise

    @contextmanager
    def get_cursor(self, commit: bool = False):
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
        try:
            with self.get_cursor() as cur:
                cur.execute("SELECT 1 as health_check")
                result = cur.fetchone()
                return result["health_check"] == 1
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False

    def get_material_synonyms(self) -> List[Dict[str, Any]]:
        query = """
            SELECT 
                ms.synonym,
                ms.material_code,
                mm.material_name,
                mm.category,
                1.0 as synonym_confidence
            FROM material_synonyms ms
            JOIN materials_master mm ON ms.material_code = mm.material_code
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
        query = """
            SELECT material_code, material_name, category, description
            FROM materials_master
            WHERE material_code = %s
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
        processing_time_ms: Optional[int] = None,
    ) -> bool:
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
                created_at
            ) VALUES (
                gen_random_uuid(),
                %s, %s, %s, %s, %s, %s, %s, %s, NOW()
            )
            RETURNING id
        """

        best_synonym = matched_synonyms[0]["synonym"] if matched_synonyms else None

        quantity_kg = None
        if extracted_quantity:
            qty = extracted_quantity.get("normalized_value", 0)
            unit = extracted_quantity.get("unit", "KG").upper()
            if unit == "MT":
                quantity_kg = qty * 1000
            else:
                quantity_kg = qty

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
                    ),
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
        notes: Optional[str] = None,
    ) -> bool:
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

        update_query = """
            UPDATE document_classifications
            SET
                corrected_material_code = %s,
                corrected_quantity_kg = %s,
                reviewer_notes = %s,
                verified_by_user = true,
                requires_human_review = false,
                updated_at = NOW()
            WHERE id = %s
        """

        try:
            with self.get_cursor(commit=True) as cur:
                cur.execute(
                    feedback_query,
                    (classification_id, corrected_material_code, corrected_quantity, notes),
                )

                cur.execute(
                    update_query,
                    (corrected_material_code, corrected_quantity, notes, classification_id),
                )

                logger.info(f"Saved feedback for classification {classification_id}")
                return True
        except Exception as e:
            logger.error(f"Failed to save feedback: {e}")
            return False

    def get_pending_classifications(self, limit: int = 10) -> List[Dict[str, Any]]:
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
                c.company_name
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


_db_client: Optional[DatabaseClient] = None


def get_db_client() -> DatabaseClient:
    global _db_client
    if _db_client is None:
        _db_client = DatabaseClient()
    return _db_client


def test_db_connection() -> bool:
    return get_db_client().test_connection()


def fetch_material_synonyms() -> List[Dict[str, Any]]:
    return get_db_client().get_material_synonyms()
