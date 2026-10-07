import argparse
import hashlib
import sys
import tempfile
from pathlib import Path
from uuid import UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pdfplumber
import requests
import yaml
from bs4 import BeautifulSoup
from qdrant_client.http.models import (
    FieldCondition,
    Filter,
    FilterSelector,
    MatchValue,
    PointStruct,
)

from src.config import QDRANT_COLLECTION
from src.rag.embeddings import embed
from src.rag.retrieval import client, ensure_collection
from src.rag.text import chunk_pages, strip_repeated_lines


def page_text(page):
    tables = page.find_tables()
    prose_area = page
    for table in tables:
        prose_area = prose_area.outside_bbox(table.bbox)
    parts = [prose_area.extract_text() or ""]
    for table in tables:
        for row in table.extract():
            cells = [" ".join((cell or "").split()) for cell in row]
            if any(cells):
                parts.append(" | ".join(cell for cell in cells if cell))
    return "\n".join(part for part in parts if part.strip())


def extract_pdf(content):
    with tempfile.NamedTemporaryFile(suffix=".pdf") as handle:
        handle.write(content)
        handle.flush()
        pages = []
        with pdfplumber.open(handle.name) as pdf:
            for page_number, page in enumerate(pdf.pages, start=1):
                text = page_text(page)
                if text.strip():
                    pages.append((page_number, text))
        return pages


def extract_source(source):
    response = requests.get(source["url"], timeout=60)
    response.raise_for_status()
    content_type = response.headers.get("content-type", "").lower()
    if "pdf" in content_type or source["url"].lower().split("?")[0].endswith(".pdf"):
        return extract_pdf(response.content)

    text = BeautifulSoup(response.text, "html.parser").get_text("\n", strip=True)
    return [(None, text)]


def point_id(source, index):
    digest = hashlib.sha256(f'{source["url"]}:{index}'.encode()).hexdigest()
    return str(UUID(digest[:32]))


def ingest(source):
    chunks = chunk_pages(strip_repeated_lines(extract_source(source)))
    if not chunks:
        raise ValueError("source contained no usable text")

    vectors = embed([text for _, text in chunks])
    points = [
        PointStruct(
            id=point_id(source, index),
            vector=vector.tolist(),
            payload={
                "text": text,
                "page": page,
                "source": source["title"],
                "source_url": source["url"],
                "category": source["category"],
            },
        )
        for index, ((page, text), vector) in enumerate(zip(chunks, vectors))
    ]

    client.delete(
        collection_name=QDRANT_COLLECTION,
        points_selector=FilterSelector(
            filter=Filter(
                must=[FieldCondition(key="source_url", match=MatchValue(value=source["url"]))]
            )
        ),
    )
    client.upsert(collection_name=QDRANT_COLLECTION, points=points)
    return len(points)


def main():
    parser = argparse.ArgumentParser(description="Ingest official regulatory sources into Qdrant.")
    parser.add_argument("--config", default="src/config/sources.yaml")
    args = parser.parse_args()

    with open(args.config, "r", encoding="utf-8") as handle:
        sources = yaml.safe_load(handle)["sources"]

    ensure_collection()
    failures = 0
    for source in sources:
        try:
            count = ingest(source)
            print(f'Ingested {count} chunks: {source["title"]}')
        except Exception as error:
            failures += 1
            print(f'Failed to ingest {source["title"]}: {error}')
    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
