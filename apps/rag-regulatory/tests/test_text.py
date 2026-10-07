from src.rag.text import build_prompt, chunk_pages, chunk_text, group_sources, strip_repeated_lines


def test_chunks_skip_fragments_and_split_very_long_lines():
    chunks = chunk_text("a" * 2000, size=900, overlap=100)
    assert [len(chunk) for chunk in chunks] == [900, 900, 200]
    assert chunk_text("too short") == []


def test_table_rows_are_never_split():
    rows = [
        f"10.{i} | Obligation {i} applies to producers | file by 30th June | Rs. {i}000 per ton"
        for i in range(20)
    ]
    chunks = chunk_text("\n".join(rows), size=300, overlap=120)
    for chunk in chunks:
        assert all(line in rows for line in chunk.splitlines())
    assert all(any(row in chunk.splitlines() for chunk in chunks) for row in rows)


def test_chunks_keep_their_page():
    chunks = chunk_pages([(1, "x" * 100), (2, "y" * 100)])
    assert [page for page, _ in chunks] == [1, 2]


def test_sources_are_grouped_per_document():
    contexts = [
        {
            "source": "EPR Guidelines",
            "source_url": "u1",
            "category": "plastic_epr",
            "score": 0.6,
            "page": 4,
            "text": "",
        },
        {
            "source": "EPR Guidelines",
            "source_url": "u1",
            "category": "plastic_epr",
            "score": 0.7,
            "page": 2,
            "text": "",
        },
        {
            "source": "BRSR Core",
            "source_url": "u2",
            "category": "brsr",
            "score": 0.5,
            "page": None,
            "text": "",
        },
    ]
    grouped = group_sources(contexts)
    assert [entry["name"] for entry in grouped] == ["EPR Guidelines", "BRSR Core"]
    assert grouped[0]["pages"] == [2, 4]
    assert grouped[0]["score"] == 0.7


def test_prompt_cites_pages():
    prompt = build_prompt(
        "What is EPR?", [{"source": "EPR Guidelines", "page": 3, "text": "EPR means..."}]
    )
    assert "[Source: EPR Guidelines, p. 3]" in prompt
    assert "Question: What is EPR?" in prompt


def test_running_headers_are_removed():
    header = "Guidelines for Assessment of Environment Compensation"
    pages = [(i, f"{header}\nPage {i} content about EPR targets") for i in range(1, 6)] + [
        (i, f"Unrelated page {i}") for i in range(6, 40)
    ]
    cleaned = strip_repeated_lines(pages)
    assert all(header not in text for _, text in cleaned)
    assert cleaned[0][1] == "Page 1 content about EPR targets"
