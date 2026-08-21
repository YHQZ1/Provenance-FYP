import re


FIELD_PATTERNS = {
    "invoice_number": [
        r"(?im)\b(?:invoice|inv)\s*(?:no|number|#)\s*[:#.-]*\s*([A-Z0-9][A-Z0-9./\\-]*)",
    ],
    "invoice_date": [
        r"(?im)\b(?:invoice\s*date|inv\.?\s*date)\b[^\n]{0,80}?([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})",
        r"(?im)(?<!due\s)\bdate\b[^\n]{0,80}?([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})",
    ],
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
            match = re.search(pattern, text)
            if match:
                value = match.group(1).strip()
                break
        if name == "invoice_date" and value is None:
            value = _find_date_on_invoice_line(text)
        fields[name] = {"value": value, "confidence": average_confidence if value else 0}
    return fields


def parse_line_items(text: str, average_confidence: float) -> list[dict]:
    items: list[dict] = []
    normalized_lines = [" ".join(line.split()) for line in text.splitlines() if line.strip()]

    quantity_pattern = re.compile(
        r"(?P<description>.+?)\s+(?P<quantity>\d+(?:[,.]\d+)?)\s*"
        r"(?P<unit>kg|kgs|mt|mtr|pcs|nos|units?)\b"
        r"(?:\s+(?P<rate>\d+(?:[,.]\d+)?))?\s*$",
        re.I,
    )
    for line in normalized_lines:
        match = quantity_pattern.match(line)
        if match:
            items.append(_make_item(match.group("description"), match.group("quantity"), match.group("unit"), match.group("rate"), line, average_confidence))

    _append_description_quantity_items(items, normalized_lines, average_confidence)
    _append_hsn_quantity_items(items, normalized_lines, average_confidence)
    _append_numbered_table_items(items, normalized_lines, average_confidence)
    return _deduplicate_items(items)


def _append_description_quantity_items(items: list[dict], lines: list[str], confidence: float) -> None:
    pattern = re.compile(
        r"\bdescription\s+(?P<description>.+?)\s+(?:place of supply|hsn/?sac)\b.*?"
        r"\bquantity\s+(?P<quantity>\d+(?:[,.]\d+)?)\b",
        re.I,
    )
    for line in lines:
        match = pattern.search(line)
        if match:
            items.append(_make_item(match.group("description"), match.group("quantity"), "unit", None, line, confidence))


def _append_numbered_table_items(items: list[dict], lines: list[str], confidence: float) -> None:
    for line in lines:
        match = re.search(r"\bsr\.?\s*no\.?\s*particulars\s+1(?P<description>.+?)\s+hsn\b", line, re.I)
        if match:
            items.append(_make_item(match.group("description"), "1", "unit", None, line, confidence))
            continue

        match = re.search(r"\bs\.\s*n\.\s*(?P<description>.+?)(?:\s+serial:|$)", line, re.I)
        if match and not any("4u rack" in item["description"].lower() for item in items):
            quantity = _find_first_quantity_with_unit(lines)
            if quantity:
                items.append(_make_item(match.group("description"), quantity[0], quantity[1], None, line, confidence))


def _append_hsn_quantity_items(items: list[dict], lines: list[str], confidence: float) -> None:
    row_pattern = re.compile(
        r"\b\d+\s+(?P<description>[A-Za-z][A-Za-z &()./-]+?)\s+"
        r"\d{4,8}(?:\s+\d{4,8})?\s+"
        r"(?P<quantities>(?:\d[\d,.]*\s*(?:kg|kgs|mt)\s*)+)",
        re.I,
    )
    quantity_pattern = re.compile(r"(?P<quantity>\d[\d,.]*)\s*(?P<unit>kg|kgs|mt)\b", re.I)
    unit_before_hsn_pattern = re.compile(
        r"\b\d+\s*(?P<description>[A-Za-z][A-Za-z &()./-]+?)\s+"
        r"(?P<unit>kg|kgs|mt|mtr|pcs|nos|units?)\s+\d{4,8}\s+"
        r"(?P<quantity>\d[\d,.]*)\b",
        re.I,
    )

    for line in lines:
        unit_before_hsn = unit_before_hsn_pattern.search(line)
        if unit_before_hsn:
            items.append(
                _make_item(
                    unit_before_hsn.group("description"),
                    unit_before_hsn.group("quantity"),
                    unit_before_hsn.group("unit"),
                    None,
                    line,
                    confidence,
                )
            )

        match = row_pattern.search(line)
        if not match:
            continue

        description = _collapse_repeated_description(match.group("description"))
        for quantity_match in quantity_pattern.finditer(match.group("quantities")):
            items.append(
                _make_item(
                    description,
                    quantity_match.group("quantity"),
                    quantity_match.group("unit"),
                    None,
                    line,
                    confidence,
                )
            )


def _collapse_repeated_description(description: str) -> str:
    words = description.strip(" -:.").split()
    if len(words) % 2 == 0:
        midpoint = len(words) // 2
        if [word.lower() for word in words[:midpoint]] == [word.lower() for word in words[midpoint:]]:
            return " ".join(words[:midpoint])
    return " ".join(words)


def _find_first_quantity_with_unit(lines: list[str]) -> tuple[str, str] | None:
    pattern = re.compile(r"\b(\d+(?:[,.]\d+)?)\s*(kg|kgs|mt|mtr|pcs|nos|units?)\b", re.I)
    for line in lines:
        match = pattern.search(line)
        if match:
            return match.group(1), match.group(2)
    return None


def _make_item(description: str, quantity: str, unit: str, rate: str | None, raw_text: str, confidence: float) -> dict:
    return {
        "description": description.strip(" -:.") or raw_text,
        "quantity": float(quantity.replace(",", "")),
        "unit": unit.lower(),
        "rate": float(rate.replace(",", "")) if rate else None,
        "amount": None,
        "raw_text": raw_text,
        "confidence": confidence,
    }


def _deduplicate_items(items: list[dict]) -> list[dict]:
    unique: list[dict] = []
    seen: set[tuple[str, float, str]] = set()
    for item in items:
        key = (item["description"].lower(), item["quantity"], item["unit"])
        if key not in seen:
            seen.add(key)
            unique.append(item)
    return unique


def _find_date_on_invoice_line(text: str) -> str | None:
    date_pattern = re.compile(r"\b([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})\b")
    for line in text.splitlines():
        if re.search(r"\b(?:invoice|inv)\b", line, re.I):
            match = date_pattern.search(line)
            if match:
                return match.group(1)
    return None
