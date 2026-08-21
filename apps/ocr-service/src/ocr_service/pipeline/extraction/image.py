from functools import lru_cache

import numpy as np
from PIL import Image

from ocr_service.core.config import settings
from ocr_service.pipeline.extraction.preprocess import preprocess_image


@lru_cache(maxsize=1)
def _get_ocr_engine():
    # Import lazily so native-PDF extraction and API health checks do not need
    # to initialize the heavyweight OCR model.
    from paddleocr import PaddleOCR

    return PaddleOCR(
        use_angle_cls=True,
        lang=settings.ocr_language,
        show_log=False,
        use_gpu=False,
        det_db_thresh=0.3,
        det_db_box_thresh=0.5,
        rec_batch_num=6,
        drop_score=settings.ocr_confidence_threshold,
    )


def extract_ocr_tokens(images: list[Image.Image]) -> list[dict]:
    ocr = _get_ocr_engine()
    tokens: list[dict] = []

    for page_number, image in enumerate(images):
        processed = preprocess_image(image)
        result = ocr.ocr(np.array(processed), cls=True)
        lines = result[0] if result and result[0] else []
        width, height = processed.size

        for line in lines:
            if not line or len(line) < 2:
                continue
            box, text_info = line[0], line[1]
            if not text_info or len(text_info) < 2:
                continue
            text, confidence = str(text_info[0]).strip(), float(text_info[1])
            if not text or confidence < settings.ocr_confidence_threshold:
                continue

            x_values = [point[0] for point in box]
            y_values = [point[1] for point in box]
            x_min, x_max = min(x_values) / width, max(x_values) / width
            y_min, y_max = min(y_values) / height, max(y_values) / height
            tokens.append(
                {
                    "text": text,
                    "x": max(0, min(1, x_min)),
                    "y": max(0, min(1, y_min)),
                    "w": max(0, min(1, x_max - x_min)),
                    "h": max(0, min(1, y_max - y_min)),
                    "page": page_number,
                    "conf": max(0, min(1, confidence)),
                    "source": "paddleocr",
                }
            )

    return tokens
