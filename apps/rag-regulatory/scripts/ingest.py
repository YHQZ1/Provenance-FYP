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
from qdrant_client.http.models import PointStruct

from src.config import QDRANT_COLLECTION
from src.rag.embeddings import embed
from src.rag.retrieval import client, ensure_collection


def chunk_text(text, size=900, overlap=120):
    chunks = []
    start = 0
    while start < len(text):
        chunk = text[start:start + size].strip()
        if len(chunk) >= 80:
            chunks.append(chunk)
        start += size - overlap
    return chunks


def extract_pdf(content):
    with tempfile.NamedTemporaryFile(suffix=".pdf") as handle:
        handle.write(content)
        handle.flush()
        pages = []
        with pdfplumber.open(handle.name) as pdf:
            for page_number, page in enumerate(pdf.pages, start=1):
                text = page.extract_text() or ""
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
    pages = extract_source(source)
    text = "\n".join(text for _, text in pages)
    chunks = chunk_text(text)
    if not chunks:
        raise ValueError("source contained no usable text")

    vectors = embed(chunks)
    points = [
        PointStruct(
            id=point_id(source, index),
            vector=vector.tolist(),
            payload={
                "text": chunk,
                "source": source["title"],
                "source_url": source["url"],
                "category": source["category"],
            },
        )
        for index, (chunk, vector) in enumerate(zip(chunks, vectors))
    ]
    client.upsert(collection_name=QDRANT_COLLECTION, points=points)
    return len(points)


def main():
    parser = argparse.ArgumentParser(description="Ingest official regulatory sources into Qdrant.")
    parser.add_argument("--config", default="src/config/sources.yaml")
    args = parser.parse_args()

    with open(args.config, "r", encoding="utf-8") as handle:
        sources = yaml.safe_load(handle)["sources"]

    ensure_collection()
    for source in sources:
        count = ingest(source)
        print(f'Ingested {count} chunks: {source["title"]}')


if __name__ == "__main__":
    main()
