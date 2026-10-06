"""Pure text helpers for ingestion and answers, kept free of model imports so they're cheap to test."""

from collections import Counter
from typing import Iterable, List, Optional, Tuple


def strip_repeated_lines(pages: List[Tuple[Optional[int], str]], share: float = 0.1) -> List[Tuple[Optional[int], str]]:
    """Drop running headers and footers: lines that repeat on a large share of pages.

    Left in, they make every chunk of a document look alike to the embedding model.
    """
    if len(pages) < 3:
        return pages

    def normalise(line: str) -> str:
        return " ".join(line.split()).lower()

    counts = Counter()
    for _, text in pages:
        counts.update({normalise(line) for line in text.splitlines() if line.strip()})
    threshold = max(4, int(len(pages) * share))
    repeated = {line for line, count in counts.items() if count >= threshold}
    return [
        (page, "\n".join(line for line in text.splitlines() if normalise(line) not in repeated))
        for page, text in pages
    ]


def _split_long(line: str, size: int) -> List[str]:
    return [line[i:i + size] for i in range(0, len(line), size)] or [line]


def chunk_text(text: str, size: int = 900, overlap: int = 120, minimum: int = 80) -> List[str]:
    """Pack whole lines into chunks of about `size` characters.

    Table rows are single lines, so a row (one obligation, one rate) is never cut in half,
    which kept the model from pairing one row's subject with the next row's figures.
    The last line of a chunk (up to `overlap` chars) is repeated at the start of the next.
    """
    lines = [piece for line in text.splitlines() if line.strip() for piece in _split_long(line.strip(), size)]
    chunks: List[str] = []
    current: List[str] = []
    length = 0
    for line in lines:
        if current and length + len(line) + 1 > size:
            chunks.append("\n".join(current))
            carry = current[-1] if len(current[-1]) <= overlap else ""
            current, length = ([carry], len(carry)) if carry else ([], 0)
        current.append(line)
        length += len(line) + 1
    if current:
        chunks.append("\n".join(current))
    return [chunk for chunk in chunks if len(chunk) >= minimum]


def chunk_pages(pages: Iterable[Tuple[Optional[int], str]], **kwargs) -> List[Tuple[Optional[int], str]]:
    """Chunk each page separately so every chunk can cite the page it came from."""
    return [(page, chunk) for page, text in pages for chunk in chunk_text(text, **kwargs)]


def group_sources(contexts: List[dict]) -> List[dict]:
    """One entry per document, best score first, with the pages that were used."""
    grouped: dict = {}
    for item in contexts:
        key = item.get("source_url") or item["source"]
        entry = grouped.setdefault(
            key,
            {
                "name": item["source"],
                "category": item.get("category"),
                "url": item.get("source_url"),
                "score": 0.0,
                "pages": [],
            },
        )
        entry["score"] = round(max(entry["score"], item["score"]), 4)
        page = item.get("page")
        if page is not None and page not in entry["pages"]:
            entry["pages"].append(page)
    for entry in grouped.values():
        entry["pages"].sort()
    return sorted(grouped.values(), key=lambda entry: entry["score"], reverse=True)


def cite(item: dict) -> str:
    page = item.get("page")
    return f"{item['source']}, p. {page}" if page is not None else item["source"]


def build_prompt(query: str, contexts: List[dict]) -> str:
    context_block = "\n\n".join(f"[Source: {cite(item)}]\n{item['text']}" for item in contexts)
    return (
        "You are an Indian ESG and compliance research assistant. "
        "Answer only from the supplied sources. If the sources do not establish "
        "an answer, say that the information is not available in the source library. "
        "Do not invent deadlines, thresholds, obligations, or legal conclusions. "
        "Quote amounts, rates, and dates exactly as they appear in the sources. Source text "
        "extracted from tables may have columns interleaved; if a figure is ambiguous, say so "
        "instead of guessing. Give a concise answer in plain language and cite sources by "
        "name and page, for example (CPCB EPR Guidelines, p. 4).\n\n"
        f"Sources:\n{context_block}\n\nQuestion: {query}"
    )
