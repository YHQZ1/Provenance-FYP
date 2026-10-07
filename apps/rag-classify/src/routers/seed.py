import hmac

from fastapi import APIRouter, Depends, Header, HTTPException, status

from src.config import settings
from src.services.rag_pipeline import get_pipeline


def require_admin(x_admin_token: str = Header(default="")) -> None:
    if not settings.admin_token:
        raise HTTPException(
            status_code=403, detail="Admin endpoints are disabled. Set ADMIN_TOKEN to enable them."
        )
    if not hmac.compare_digest(x_admin_token, settings.admin_token):
        raise HTTPException(status_code=401, detail="Invalid admin token")


router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(require_admin)])


@router.post("/seed-synonyms")
def seed_synonyms():
    try:
        pipeline = get_pipeline()
        success = pipeline.seed_synonyms()

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Seeding failed. Check logs for details.",
            )

        info = pipeline.vector_store.get_collection_info()

        return {
            "success": True,
            "message": "Synonyms seeded successfully",
            "vectors_in_qdrant": info.get("vector_count", 0) if info else 0,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Seeding error: {str(e)}"
        )


@router.delete("/reset-qdrant")
def reset_qdrant():
    try:
        pipeline = get_pipeline()
        pipeline.vector_store.delete_collection()
        pipeline.vector_store.ensure_collection()

        return {"success": True, "message": "Qdrant collection reset"}

    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
