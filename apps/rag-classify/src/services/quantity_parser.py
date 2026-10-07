import re
from typing import Optional, Dict, Any

QUANTITY_PATTERNS = [
    r"(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(KG|kg|Kg|MT|mt|Mt|TON|ton|Ton|kgs|KGS)",
    r"(\d+)\s*(KG|kg|Kg|MT|mt|Mt)",
    r"(\d+\.\d+)(KG|kg|Kg|MT|mt|Mt)",
]

UNIT_MAP = {
    "kg": "KG",
    "kgs": "KG",
    "KG": "KG",
    "Kg": "KG",
    "mt": "MT",
    "MT": "MT",
    "Mt": "MT",
    "ton": "MT",
    "tons": "MT",
    "TON": "MT",
    "Ton": "MT",
}


def parse_quantity(text: str) -> Optional[Dict[str, Any]]:
    if not text:
        return None

    for pattern in QUANTITY_PATTERNS:
        match = re.search(pattern, text)
        if match:
            raw_value = match.group(1)
            raw_unit = match.group(2)

            try:
                numeric = float(raw_value.replace(",", ""))
            except ValueError:
                continue

            unit = UNIT_MAP.get(raw_unit, "KG")

            if unit == "MT":
                normalized = numeric * 1000
                unit = "KG"
            else:
                normalized = numeric

            return {
                "raw_value": match.group(0),
                "normalized_value": round(normalized, 2),
                "unit": unit,
                "original_unit": raw_unit.upper(),
            }

    return None


def extract_all_quantities(text: str) -> list:
    quantities = []
    for pattern in QUANTITY_PATTERNS:
        for match in re.finditer(pattern, text):
            parsed = parse_quantity(match.group(0))
            if parsed:
                quantities.append(parsed)
    return quantities
