from fastapi import FastAPI

from ocr_service.api.router import router
from ocr_service.core.config import settings

app = FastAPI(title=settings.app_name, version="0.1.0")
app.include_router(router)
