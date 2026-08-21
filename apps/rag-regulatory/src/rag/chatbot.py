from src.rag.llm import call_llm
from src.rag.retrieval import retrieve


def build_prompt(query, contexts):
    context_block = "\n\n".join(
        f"[Source: {item['source']}]\n{item['text']}" for item in contexts
    )
    return (
        "You are an Indian ESG and compliance research assistant. "
        "Answer only from the supplied sources. If the sources do not establish "
        "an answer, say that the information is not available. Do not invent "
        "deadlines, thresholds, obligations, or legal conclusions. "
        "Give a concise answer and identify the relevant source names.\n\n"
        f"Sources:\n{context_block}\n\nQuestion: {query}"
    )


def chat(query):
    contexts = retrieve(query)
    if not contexts:
        return {
            "answer": "No relevant regulatory source was found.",
            "sources": [],
        }

    answer = call_llm(build_prompt(query, contexts))
    return {
        "answer": answer,
        "sources": [
            {
                "name": item["source"],
                "category": item.get("category"),
                "url": item.get("source_url"),
                "score": round(item["score"], 4),
            }
            for item in contexts
        ],
    }
