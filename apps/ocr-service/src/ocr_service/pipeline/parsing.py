import re


FIELD_PATTERNS = {
    "invoice_number": [r"(?:invoice|inv)\s*(?:no|number|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9/-]+)"],
    "invoice_date": [r"(?:invoice\s*)?date\s*[:#-]?\s*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})"],
    "gstin": [r"\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9])\b"],
}


def tokens_to_text(tokens: list[dict]) -> str:
    pages: list[str] = []
    for page in sorted({token["page"] for token in tokens}):
        page_tokens = [token for token in tokens if token["page"] == page]
        page_tokens.sort(key=lambda token: (token["y"], token["x"]))
        lines: list[list[dict]] = []
        for token in page_tokens:
            if not lines or abs(token["y"] - lines[-1][0]["y"]) >= 0.02:
                lines.append([token])
            else:
                lines[-1].append(token)
        pages.append("\n".join(" ".join(t["text"] for t in sorted(line, key=lambda x: x["x"])) for line in lines))
    return "\n\n".join(pages)


def extract_fields(text: str, average_confidence: float) -> dict[str, dict]:
    fields = {}
    for name, patterns in FIELD_PATTERNS.items():
        value = None
        for pattern in patterns:
            match = re.search(pattern, text, re.I)
            if match:
                value = match.group(1).strip()
                break
        fields[name] = {"value": value, "confidence": average_confidence if value else 0}
    return fields


def parse_line_items(text: str, average_confidence: float) -> list[dict]:
    items = []
    quantity_pattern = re.compile(
        r"(?P<description>.+?)\s+(?P<quantity>\d+(?:[,.]\d+)?)\s*(?P<unit>kg|kgs|mt|mtr|pcs|units?)\b(?:\s+(?P<rate>\d+(?:[,.]\d+)?))?\s*$",
        re.I,
    )
    for line in text.splitlines():
        line = " ".join(line.split())
        match = quantity_pattern.match(line)
        if not match:
            continue
        items.append(
            {
                "description": match.group("description").strip(" -:.") or line,
                "quantity": float(match.group("quantity").replace(",", "")),
                "unit": match.group("unit").lower(),
                "rate": float(match.group("rate").replace(",", "")) if match.group("rate") else None,
                "amount": None,
                "raw_text": line,
                "confidence": average_confidence,
            }
        )
    return items
