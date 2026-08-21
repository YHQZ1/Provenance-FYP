import requests

from src.config import OLLAMA_HOST, OLLAMA_MAX_TOKENS, OLLAMA_MODEL, OLLAMA_TIMEOUT


def call_llm(prompt):
    response = requests.post(
        f"{OLLAMA_HOST}/api/generate",
        json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False, "options": {"num_predict": OLLAMA_MAX_TOKENS, "temperature": 0.1}},
        timeout=OLLAMA_TIMEOUT,
    )
    response.raise_for_status()
    return response.json().get("response", "").strip()
