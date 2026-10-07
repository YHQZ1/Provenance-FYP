from dataclasses import replace
from pathlib import Path

import fitz

from ocr_service.pipeline import service as service_module
from ocr_service.pipeline.service import OCRPipeline


def _make_pdf(tmp_path: Path, pages: list[str]) -> Path:
    document = fitz.open()
    for text in pages:
        page = document.new_page()
        if text:
            page.insert_text((72, 72), text)
    path = tmp_path / "mixed.pdf"
    document.save(path)
    document.close()
    return path


def test_only_scanned_pages_are_sent_to_ocr(tmp_path, monkeypatch):
    path = _make_pdf(tmp_path, ["PET Preform 1,00,000 kg", "", "HDPE Granules 250 kg"])
    rendered: list[int] = []

    def fake_render(_path, dpi, page_numbers):
        rendered.extend(page_numbers)
        return [object() for _ in page_numbers]

    def fake_ocr(images, page_numbers):
        return [
            {
                "text": "LDPE Film 40 kg",
                "x": 0.1,
                "y": 0.1,
                "w": 0.3,
                "h": 0.02,
                "page": page,
                "conf": 0.9,
                "source": "paddleocr",
            }
            for page in page_numbers
        ]

    monkeypatch.setattr(service_module, "render_pdf_pages", fake_render)
    monkeypatch.setattr(service_module, "extract_ocr_tokens", fake_ocr)

    result = OCRPipeline().process(path, "mixed.pdf")

    assert rendered == [1]
    assert result.pages == 3
    assert {item.description for item in result.line_items} == {
        "PET Preform",
        "HDPE Granules",
        "LDPE Film",
    }
    assert any("1 scanned page" in warning for warning in result.warnings)


def test_page_limit_is_enforced(tmp_path, monkeypatch):
    path = _make_pdf(tmp_path, [f"Item {i} {i + 1} kg" for i in range(3)])
    monkeypatch.setattr(service_module, "settings", replace(service_module.settings, max_pages=2))

    result = OCRPipeline().process(path, "long.pdf")

    assert all(token.page < 2 for token in result.tokens)
    assert any("first 2 of 3 pages" in warning for warning in result.warnings)
