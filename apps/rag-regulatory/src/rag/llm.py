import time

import requests
from prometheus_client import Histogram

from src.config import OLLAMA_HOST, OLLAMA_MAX_TOKENS, OLLAMA_MODEL, OLLAMA_TIMEOUT

LLM_CALL = Histogram(
    "llm_call_duration_seconds",
    "Language model call duration",
    ["outcome"],
    buckets=(0.5, 1, 2, 5, 10, 20, 30, 60, 120, 180),
)


def call_llm(prompt):
    started = time.perf_counter()
    outcome = "error"
    try:
        answer = _generate(prompt)
        outcome = "ok"
        return answer
    finally:
        LLM_CALL.labels(outcome).observe(time.perf_counter() - started)


def _generate(prompt):
    response = requests.post(
        f"{OLLAMA_HOST}/api/generate",
        json={
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {"num_predict": OLLAMA_MAX_TOKENS, "temperature": 0.1},
        },
        timeout=OLLAMA_TIMEOUT,
    )
    response.raise_for_status()
    return response.json().get("response", "").strip()
