import os


def required(name):
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


QDRANT_HOST = required("QDRANT_HOST")
QDRANT_PORT = int(required("QDRANT_PORT"))
CORS_ORIGINS = [origin.strip() for origin in required("CORS_ORIGINS").split(",") if origin.strip()]
QDRANT_COLLECTION = os.getenv("QDRANT_COLLECTION", "regulatory_docs")
OLLAMA_HOST = required("OLLAMA_HOST").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
OLLAMA_TIMEOUT = int(os.getenv("OLLAMA_TIMEOUT", "180"))
OLLAMA_MAX_TOKENS = int(os.getenv("OLLAMA_MAX_TOKENS", "512"))
TOP_K = int(os.getenv("REGULATORY_TOP_K", "5"))
MIN_SCORE = float(os.getenv("REGULATORY_MIN_SCORE", "0.35"))
