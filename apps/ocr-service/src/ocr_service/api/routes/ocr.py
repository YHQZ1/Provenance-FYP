import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from ocr_service.core.config import settings
from ocr_service.pipeline import OCRPipeline
from ocr_service.schemas import OCRResponse

router = APIRouter(prefix="/v1", tags=["ocr"])
pipeline = OCRPipeline()
SUPPORTED_TYPES = {"application/pdf", "image/png", "image/jpeg", "image/tiff"}


@router.post("/ocr", response_model=OCRResponse, status_code=status.HTTP_200_OK)
async def process_document(file: UploadFile = File(...)) -> OCRResponse:
    if file.content_type not in SUPPORTED_TYPES:
        raise HTTPException(status_code=415, detail="Supported files: PDF, PNG, JPEG, TIFF")

    suffix = Path(file.filename or "document").suffix.lower()
    if suffix not in {".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff"}:
        raise HTTPException(status_code=415, detail="Unsupported file extension")

    payload = await file.read()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(payload) > max_bytes:
        raise HTTPException(status_code=413, detail="Document exceeds the upload size limit")

    temp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(payload)
            temp_path = temp_file.name
        return pipeline.process(temp_path, file.filename)
    except ValueError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Document processing failed: {exc}") from exc
    finally:
        if temp_path:
            try:
                os.unlink(temp_path)
            except FileNotFoundError:
                pass
