from fastapi import APIRouter

from ocr_service.api.routes.health import router as health_router
from ocr_service.api.routes.ocr import router as ocr_router

router = APIRouter()
router.include_router(health_router)
router.include_router(ocr_router)
