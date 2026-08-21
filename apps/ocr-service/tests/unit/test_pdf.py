from pathlib import Path

from ocr_service.pipeline.extraction.pdf import extract_pdf_tokens


def test_native_pdf_extraction_uses_normalized_confidence():
    fixture = Path(__file__).parents[1] / "fixtures" / "pdfs" / "test.pdf"
    if not fixture.exists():
        return

    tokens, pages = extract_pdf_tokens(fixture)
    assert pages == 31
    assert tokens
    assert all(0 <= token["conf"] <= 1 for token in tokens)
    assert all(0 <= token["x"] <= 1 for token in tokens)
