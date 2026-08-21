"""
PDF Text Extraction Module

Logic: Extracts text from PDFs using two methods:
1. extract_pdf_tokens - Direct text extraction using PyMuPDF (preserves formatting)
2. extract_images_from_pdf - Converts pages to images for OCR processing (when text layer is missing)

Key principle: Native PDF text extraction is faster and more accurate when available.
Image conversion is fallback for scanned PDFs without text layers.
Coordinates normalized to 0-1 range for consistency with OCR output.
"""

import fitz
from pdf2image import convert_from_path
from PIL import Image


def extract_pdf_tokens(pdf_path):
    doc = fitz.open(pdf_path)
    tokens = []

    for page_num, page in enumerate(doc):
        page_dict = page.get_text("dict")
        page_width = page.rect.width
        page_height = page.rect.height

        for block in page_dict.get("blocks", []):
            if "lines" not in block:
                continue

            for line in block["lines"]:
                for span in line["spans"]:
                    text = span["text"].strip()
                    if not text:
                        continue

                    x0, y0, x1, y1 = span["bbox"]

                    tokens.append(
                        {
                            "text": text,
                            "x": x0 / page_width,
                            "y": y0 / page_height,
                            "w": (x1 - x0) / page_width,
                            "h": (y1 - y0) / page_height,
                            "page": page_num,
                            "conf": 100.0,
                            "source": "pdf",
                        }
                    )

    page_count = len(doc)
    doc.close()
    return tokens, page_count


def extract_images_from_pdf(pdf_path, dpi=300):
    try:
        images = convert_from_path(pdf_path, dpi=dpi)
        return images
    except Exception as e:
        print(f"Error extracting images from PDF: {e}")
        return []