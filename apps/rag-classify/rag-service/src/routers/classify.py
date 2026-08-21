# src/routers/classify.py
"""
Classification endpoints for material identification.
"""

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from src.models.schemas import (
    ClassificationRequest, 
    ClassificationResponse,
    FeedbackRequest
)
from src.services.rag_pipeline import get_pipeline

router = APIRouter(prefix="/classify", tags=["Classification"])


@router.post("", response_model=ClassificationResponse)
async def classify_material(request: ClassificationRequest):
    """
    Classify plastic material from text.
    
    - Encodes text to vector
    - Searches Qdrant for similar synonyms
    - Calls local LLM for final classification
    - Returns material code, confidence, and reasoning
    """
    try:
        pipeline = get_pipeline()
        
        result = pipeline.classify(
            text=request.text,
            document_id=request.document_id,
            company_id=request.company_id,
            save_to_db=request.document_id is not None
        )
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"error": "Classification failed", "details": result.get("errors")}
            )
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/feedback", status_code=status.HTTP_201_CREATED)
async def submit_feedback(request: FeedbackRequest):
    """
    Submit human correction for a classification.
    Used to improve model accuracy over time.
    """
    from src.services.db_client import get_db_client
    
    try:
        db = get_db_client()
        success = db.save_feedback(
            classification_id=request.classification_id,
            corrected_material_code=request.corrected_material_code,
            corrected_quantity=request.corrected_quantity,
            notes=request.notes
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save feedback"
            )
        
        return {"success": True, "message": "Feedback recorded"}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )