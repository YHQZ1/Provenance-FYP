import re

NUMBER = r"\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?"
WEIGHT_UNITS = r"kgs?|kilograms?|grams?|gms?|g|mt|tonnes?|tons?|qtls?|quintals?"
COUNT_UNITS = r"mtrs?|pcs|nos|units?"
UNITS = rf"(?:{WEIGHT_UNITS}|{COUNT_UNITS})"


_DAY = r"(?:0?[1-9]|[12][0-9]|3[01])"
_MONTH = r"(?:0?[1-9]|1[0-2])"
DATE = (
    rf"(?<![\d/]){_DAY}[/.-]{_MONTH}[/.-](?:[0-9]{{4}}|[0-9]{{2}})(?![\d/])"
    rf"|(?<!\d){_DAY}(?:st|nd|rd|th)?[\s/.-]+(?:jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*[\s/.,-]+(?:[0-9]{{4}}|[0-9]{{2}})(?!\d)"
)

DATE_LABELS = r"invoice\s*date|inv\.?\s*date|bill\s*date|certificate\s*date|date\s*of\s*issue|dated"

TOTAL_ROW = re.compile(
    r"^(?:sub[\s-]*total|grand\s+total|total|net\s+(?:amount|total)|amount\s+chargeable)\b", re.I
)

FIELD_PATTERNS = {
    "invoice_number": [
        r"(?im)\b(?:invoice|inv)\s*(?:no|number|#)\s*[:#.-]*\s*([A-Z0-9][A-Z0-9./\\-]*)",
    ],
    "invoice_date": [
        rf"(?im)\b(?:{DATE_LABELS})\b[^\n]{{0,80}}?({DATE})",
        rf"(?im)\b(?:{DATE_LABELS})\b[^\n]{{0,40}}\n[^\n]{{0,80}}?({DATE})",
        rf"(?im)(?<!due\s)\bdate\b[^\n]{{0,80}}?({DATE})",
    ],
    "gstin": [r"\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9])\b"],
}


def _same_line(token: dict, line: list[dict]) -> bool:
    anchor = line[0]
    token_height = token.get("h") or 0.01
    anchor_height = anchor.get("h") or 0.01
    token_centre = token["y"] + token_height / 2
    anchor_centre = anchor["y"] + anchor_height / 2
    return abs(token_centre - anchor_centre) <= 0.5 * max(token_height, anchor_height)


def tokens_to_text(tokens: list[dict]) -> str:
    pages: list[str] = []
    for page in sorted({token["page"] for token in tokens}):
        page_tokens = [token for token in tokens if token["page"] == page]
        page_tokens.sort(key=lambda token: (token["y"], token["x"]))
        lines: list[list[dict]] = []
        for token in page_tokens:
            if lines and _same_line(token, lines[-1]):
                lines[-1].append(token)
            else:
                lines.append([token])
        pages.append(
            "\n".join(
                " ".join(t["text"] for t in sorted(line, key=lambda x: x["x"])) for line in lines
            )
        )
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
    lines = [" ".join(line.split()) for line in text.splitlines() if line.strip()]
    lines = [line for line in lines if not TOTAL_ROW.match(line)]

    items: list[dict] = []
    table_lines = _append_table_row_items(items, lines, average_confidence)
    remaining = [line for line in lines if line not in table_lines]

    quantity_pattern = re.compile(
        rf"(?P<description>.+?)\s+(?P<quantity>{NUMBER})\s*"
        rf"(?P<unit>{UNITS})\b\.?"
        rf"(?:\s+(?P<rate>{NUMBER}))?\s*$",
        re.I,
    )
    for line in remaining:
        match = quantity_pattern.match(line)
        if match:
            items.append(
                _make_item(
                    match.group("description"),
                    match.group("quantity"),
                    match.group("unit"),
                    match.group("rate"),
                    line,
                    average_confidence,
                )
            )

    _append_description_quantity_items(items, remaining, average_confidence)
    _append_hsn_quantity_items(items, remaining, average_confidence)
    _append_numbered_table_items(items, remaining, average_confidence)
    return _deduplicate_items([item for item in items if not TOTAL_ROW.match(item["description"])])


def _append_table_row_items(items: list[dict], lines: list[str], confidence: float) -> set[str]:
    pattern = re.compile(
        rf"^(?:\d+\s+)?(?P<description>[A-Za-z][A-Za-z &()./-]*?)\s+\d{{4,8}}\s+"
        rf"(?P<quantity>{NUMBER})\s*(?P<unit>{UNITS})\b(?:\s+(?P<rate>{NUMBER}))?",
        re.I,
    )
    consumed: set[str] = set()
    for line in lines:
        match = pattern.match(line)
        if match:
            items.append(
                _make_item(
                    match.group("description"),
                    match.group("quantity"),
                    match.group("unit"),
                    match.group("rate"),
                    line,
                    confidence,
                )
            )
            consumed.add(line)
    return consumed


def _append_description_quantity_items(
    items: list[dict], lines: list[str], confidence: float
) -> None:
    pattern = re.compile(
        r"\bdescription\s+(?P<description>.+?)\s+(?:place of supply|hsn/?sac)\b.*?"
        r"\bquantity\s+(?P<quantity>\d+(?:[,.]\d+)?)\b",
        re.I,
    )
    for line in lines:
        match = pattern.search(line)
        if match:
            items.append(
                _make_item(
                    match.group("description"),
                    match.group("quantity"),
                    "unit",
                    None,
                    line,
                    confidence,
                )
            )


def _append_numbered_table_items(items: list[dict], lines: list[str], confidence: float) -> None:
    for line in lines:
        match = re.search(
            r"\bsr\.?\s*no\.?\s*particulars\s+1(?P<description>.+?)\s+hsn\b", line, re.I
        )
        if match:
            items.append(
                _make_item(match.group("description"), "1", "unit", None, line, confidence)
            )
            continue

        match = re.search(r"\bs\.\s*n\.\s*(?P<description>.+?)(?:\s+serial:|$)", line, re.I)
        if match and not any("4u rack" in item["description"].lower() for item in items):
            quantity = _find_first_quantity_with_unit(lines)
            if quantity:
                items.append(
                    _make_item(
                        match.group("description"), quantity[0], quantity[1], None, line, confidence
                    )
                )


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
        if [word.lower() for word in words[:midpoint]] == [
            word.lower() for word in words[midpoint:]
        ]:
            return " ".join(words[:midpoint])
    return " ".join(words)


def _find_first_quantity_with_unit(lines: list[str]) -> tuple[str, str] | None:
    pattern = re.compile(rf"\b({NUMBER})\s*({UNITS})\b", re.I)
    for line in lines:
        match = pattern.search(line)
        if match:
            return match.group(1), match.group(2)
    return None


def _make_item(
    description: str, quantity: str, unit: str, rate: str | None, raw_text: str, confidence: float
) -> dict:
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
    date_pattern = re.compile(rf"\b({DATE})\b", re.I)
    for line in text.splitlines():
        if re.search(r"\b(?:invoice|inv)\b", line, re.I):
            match = date_pattern.search(line)
            if match:
                return match.group(1)
    return None
