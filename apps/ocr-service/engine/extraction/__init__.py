import os
from pdf2image import convert_from_path
from PIL import Image

from engine.extraction.pdf import extract_pdf_tokens
from engine.extraction.ocr import extract_ocr_tokens


def extract_tokens(file_path: str):
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        pdf_tokens, page_count = extract_pdf_tokens(file_path)

        if len(pdf_tokens) > 50:
            tokens = pdf_tokens
        else:
            images = convert_from_path(file_path)
            tokens = extract_ocr_tokens(images)

    elif ext in [".png", ".jpg", ".jpeg"]:
        img = Image.open(file_path)
        tokens = extract_ocr_tokens([img])
        page_count = 1

    else:
        raise ValueError(f"Unsupported file type: {ext}")

    return {
        "tokens": tokens,
        "meta": {
            "pages": page_count,
            "extraction_version": "v1"
        }
    }