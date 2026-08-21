from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("OCR_APP_NAME", "Provenance OCR Service")
    extraction_version: str = os.getenv("OCR_EXTRACTION_VERSION", "v2")
    max_upload_size_mb: int = int(os.getenv("OCR_MAX_UPLOAD_SIZE_MB", "25"))
    ocr_confidence_threshold: float = float(
        os.getenv("OCR_CONFIDENCE_THRESHOLD", "0.5")
    )
    ocr_language: str = os.getenv("OCR_LANGUAGE", "en")


settings = Settings()
