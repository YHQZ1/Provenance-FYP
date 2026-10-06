from src.rag.llm import call_llm
from src.rag.retrieval import retrieve
from src.rag.text import build_prompt, group_sources


def chat(query):
    contexts = retrieve(query)
    if not contexts:
        return {
            "answer": "The source library doesn't cover this question yet. Try rephrasing, or check the official CPCB and SEBI sites.",
            "sources": [],
        }

    answer = call_llm(build_prompt(query, contexts))
    return {"answer": answer, "sources": group_sources(contexts)}
