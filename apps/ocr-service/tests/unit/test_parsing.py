from ocr_service.pipeline.parsing import extract_fields, parse_line_items, tokens_to_text


INVOICE_0_TEXT = """Tax Invoice
Invoice No:1410515599 Customer No:791114435
Delivery Type Invoice Date INTERNATIONAL CARRIER 27/07/2020
Payment Terms Due Date 25/09/2020
Description Dell Latitude 3301 CTO Place of Supply MAHARASHTRA HSN/SAC Quantity 1 Unit Price 51,207.00"""

INVOICE_1_TEXT = """TAX INVOICE
INVOICE NO VST/783 12-07-2022
S.N. 4U Rack 500 D Model With Accessories
QTY NET AMT 7,174.40
2 Nos 6,080.00 18%"""

INVOICE_2_TEXT = """Tax Invoice
To, Hindalco Industries Limited Date:- Invoice No.- AMC/2122/FA/0019 28-09-2021
Sr.NoParticulars 1Sale of Old Car of Lalit Kumar Apparao Kodi HSN 87032291 Amount"""

INVOICE_3_TEXT = """Tax Invoice
S Description of Goods HSN/SAC Quantity Rate Amount No
2 Plastic Compounds Plastic Compounds 3902 3902 11,000.00KG 7,000.00KG 63.50 62.00 KG KG"""

INVOICE_4_TEXT = """Tax Invoice
No. DESCRIPTION OF GOODS UNIT HSN CODE QTY RATE Amount
1PLASTIC SCRAP KGS 3915 2375.000 15.00 35625.00"""


def test_tokens_are_reconstructed_per_page():
    tokens = [
        {"text": "Date:", "page": 1, "x": 0.1, "y": 0.1, "conf": 1},
        {"text": "01/02/2025", "page": 1, "x": 0.2, "y": 0.1, "conf": 1},
        {"text": "Second", "page": 0, "x": 0.1, "y": 0.1, "conf": 1},
    ]
    assert tokens_to_text(tokens) == "Second\n\nDate: 01/02/2025"


def test_invoice_fields_require_labels_and_ignore_due_date():
    fields = extract_fields(INVOICE_0_TEXT, 0.9)
    assert fields["invoice_number"]["value"] == "1410515599"
    assert fields["invoice_date"]["value"] == "27/07/2020"


def test_invoice_fields_support_common_invoice_layouts():
    fields_one = extract_fields(INVOICE_1_TEXT, 0.9)
    fields_two = extract_fields(INVOICE_2_TEXT, 0.9)
    assert fields_one["invoice_number"]["value"] == "VST/783"
    assert fields_one["invoice_date"]["value"] == "12-07-2022"
    assert fields_two["invoice_number"]["value"] == "AMC/2122/FA/0019"
    assert fields_two["invoice_date"]["value"] == "28-09-2021"


def test_gstin_is_extracted():
    fields = extract_fields("GSTIN: 22AAAAA0000A1Z5", 0.9)
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


def test_invoice_fixture_layouts_produce_line_items():
    invoice_zero = parse_line_items(INVOICE_0_TEXT, 0.9)
    invoice_one = parse_line_items(INVOICE_1_TEXT, 0.9)
    invoice_two = parse_line_items(INVOICE_2_TEXT, 0.9)

    assert invoice_zero[0]["description"] == "Dell Latitude 3301 CTO"
    assert invoice_zero[0]["quantity"] == 1
    assert "4U Rack 500 D" in invoice_one[0]["description"]
    assert invoice_one[0]["quantity"] == 2
    assert invoice_one[0]["unit"] == "nos"
    assert "Sale of Old Car" in invoice_two[0]["description"]
    assert invoice_two[0]["quantity"] == 1


def test_hsn_rows_extract_multiple_quantities_from_flattened_invoice_table():
    items = parse_line_items(INVOICE_3_TEXT, 0.9)

    assert len(items) == 2
    assert all(item["description"] == "Plastic Compounds" for item in items)
    assert [item["quantity"] for item in items] == [11000.0, 7000.0]
    assert all(item["unit"] == "kg" for item in items)


def test_hsn_rows_extract_quantity_when_unit_precedes_hsn_code():
    items = parse_line_items(INVOICE_4_TEXT, 0.9)

    assert len(items) == 1
    assert items[0]["description"] == "PLASTIC SCRAP"
    assert items[0]["quantity"] == 2375.0
    assert items[0]["unit"] == "kgs"
