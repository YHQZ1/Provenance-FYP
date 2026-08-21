from ocr_service.pipeline.parsing import extract_fields, parse_line_items, tokens_to_text


def test_tokens_are_reconstructed_per_page():
    tokens = [
        {"text": "Date:", "page": 1, "x": 0.1, "y": 0.1, "conf": 1},
        {"text": "01/02/2025", "page": 1, "x": 0.2, "y": 0.1, "conf": 1},
        {"text": "Second", "page": 0, "x": 0.1, "y": 0.1, "conf": 1},
    ]
    assert tokens_to_text(tokens) == "Second\n\nDate: 01/02/2025"


def test_invoice_fields_are_extracted():
    fields = extract_fields("Invoice No: INV-123\nDate: 01/02/2025\nGSTIN: 22AAAAA0000A1Z5", 0.9)
    assert fields["invoice_number"]["value"] == "INV-123"
    assert fields["invoice_date"]["value"] == "01/02/2025"
    assert fields["gstin"]["value"] == "22AAAAA0000A1Z5"


def test_line_items_extract_quantity_and_unit():
    items = parse_line_items("PET bottles clear 500 kg 42.5", 0.8)
    assert items == [
        {
            "description": "PET bottles clear",
            "quantity": 500.0,
            "unit": "kg",
            "rate": 42.5,
            "amount": None,
            "raw_text": "PET bottles clear 500 kg 42.5",
            "confidence": 0.8,
        }
    ]
