from pathlib import Path

import fitz
from pdf2image import convert_from_path


def extract_pdf_tokens(pdf_path: str | Path) -> tuple[list[dict], int]:
    """Extract tokens from a PDF text layer with normalized coordinates."""
    doc = fitz.open(str(pdf_path))
    tokens: list[dict] = []

    try:
        for page_number, page in enumerate(doc):
            page_width = page.rect.width or 1
            page_height = page.rect.height or 1
            for block in page.get_text("dict").get("blocks", []):
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        text = span.get("text", "").strip()
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
                                "page": page_number,
                                "conf": 1.0,
                                "source": "pdf",
                            }
                        )
        return tokens, len(doc)
    finally:
        doc.close()


def render_pdf_pages(pdf_path: str | Path, dpi: int = 300):
    return convert_from_path(str(pdf_path), dpi=dpi)
