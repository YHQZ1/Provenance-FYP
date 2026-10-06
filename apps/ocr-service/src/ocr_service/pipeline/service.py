from pathlib import Path

from PIL import Image

from ocr_service.core.config import settings
from ocr_service.pipeline.extraction.image import extract_ocr_tokens
from ocr_service.pipeline.extraction.pdf import extract_pdf_tokens, render_pdf_pages
from ocr_service.pipeline.parsing import extract_fields, parse_line_items, tokens_to_text
from ocr_service.schemas import BoundingBox, ExtractedField, InvoiceLineItem, OCRResponse, OCRToken


class OCRPipeline:
    def _extract_pdf(self, path: Path) -> tuple[list[dict], int, list[str]]:
        """Use the text layer where it exists and OCR only the pages that are scanned."""
        warnings: list[str] = []
        tokens, pages = extract_pdf_tokens(path)
        limit = min(pages, settings.max_pages)
        if pages > settings.max_pages:
            warnings.append(
                f"Only the first {settings.max_pages} of {pages} pages were processed."
            )
            tokens = [token for token in tokens if token["page"] < limit]

        pages_with_text = {token["page"] for token in tokens}
        scanned = [page for page in range(limit) if page not in pages_with_text]
        if scanned:
            images = render_pdf_pages(path, dpi=settings.render_dpi, page_numbers=scanned)
            tokens.extend(extract_ocr_tokens(images, page_numbers=scanned))
            warnings.append(
                "No text layer found; the document was read with OCR."
                if len(scanned) == limit
                else f"{len(scanned)} scanned page(s) were read with OCR."
            )
        return tokens, pages, warnings

    def process(self, file_path: str | Path, filename: str | None = None) -> OCRResponse:
        path = Path(file_path)
        suffix = path.suffix.lower()
        if suffix not in {".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff"}:
            raise ValueError(f"Unsupported file type: {suffix or 'unknown'}")

        warnings: list[str] = []
        if suffix == ".pdf":
            tokens, pages, pdf_warnings = self._extract_pdf(path)
            warnings.extend(pdf_warnings)
        else:
            with Image.open(path) as image:
                tokens = extract_ocr_tokens([image.copy()])
            pages = 1

        raw_text = tokens_to_text(tokens)
        confidence = sum(token["conf"] for token in tokens) / len(tokens) if tokens else 0
        fields = extract_fields(raw_text, confidence)
        line_items = parse_line_items(raw_text, confidence)
        if not tokens:
            warnings.append("No text was extracted from the document.")

        return OCRResponse(
            document_type="invoice" if line_items or "invoice" in raw_text.lower() else "unknown",
            filename=filename or path.name,
            pages=max(1, pages),
            raw_text=raw_text,
            tokens=[
                OCRToken(
                    text=token["text"],
                    page=token["page"],
                    confidence=token["conf"],
                    source=token["source"],
                    box=BoundingBox(
                        x=token["x"], y=token["y"], width=token["w"], height=token["h"]
                    ),
                )
                for token in tokens
            ],
            fields={key: ExtractedField(**value) for key, value in fields.items()},
            line_items=[InvoiceLineItem(**item) for item in line_items],
            confidence=confidence,
            warnings=warnings,
            metadata={"extraction_version": settings.extraction_version},
        )
