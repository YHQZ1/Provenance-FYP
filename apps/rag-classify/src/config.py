# Loads all environment variables from .env file
# Validates that required vars exist (fail fast on startup)
# Converts types (URL strings → proper objects, ints, floats)
# Provides single Settings object imported everywhere

"""
Application configuration using Pydantic Settings.
Loads from .env file and validates on startup.
"""

from functools import lru_cache
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    All application settings loaded from environment variables.
    Priority: 1) Environment vars, 2) .env file, 3) Default values
    """
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,  # DATABASE_URL or database_url both work
        extra="ignore" # Ignore extra vars in .env (like SUPABASE_URL if not used)
    )
    
    # === Database (Supabase PostgreSQL) ===
    database_url: str = Field(
        ...,
        validation_alias=AliasChoices("DATABASE_URL", "SUPABASE_DATABASE_URL"),
        description="Supabase PostgreSQL connection URL (required)"
    )
    
    # === Vector Database (Qdrant) ===
    qdrant_host: str = Field(
        default="localhost",
        description="Qdrant hostname (localhost for dev, qdrant for Docker)"
    )
    qdrant_port: int = Field(
        default=6333,
        description="Qdrant HTTP port"
    )
    qdrant_collection_name: str = Field(
        default="material_synonyms",
        description="Name of the collection storing material embeddings"
    )
    
    # === LLM (Ollama) ===
    ollama_host: str = Field(
        default="http://localhost:11434",
        description="Ollama API base URL"
    )
    ollama_model: str = Field(
        default="llama3.2:3b",
        description="Model name for classification (must be pulled in Ollama)"
    )
    ollama_timeout: int = Field(
        default=120,
        description="Timeout for LLM generation in seconds (classification can be slow)"
    )
    
    # === Embeddings ===
    embedding_model: str = Field(
        default="sentence-transformers/all-MiniLM-L6-v2",
        description="HuggingFace model name for text embeddings"
    )
    vector_dimension: int = Field(
        default=384,
        description="Embedding dimension (must match model output)"
    )
    
    # === RAG Pipeline ===
    top_k_synonyms: int = Field(
        default=5,
        description="Number of similar synonyms to retrieve from Qdrant"
    )
    confidence_threshold: float = Field(
        default=0.7,
        description="Minimum confidence score to auto-accept classification (0-1)"
    )
    
    # === API ===
    api_host: str = Field(default="0.0.0.0")
    api_port: int = Field(default=8001)
    debug: bool = Field(default=False)
    
    
    @property
    def qdrant_url(self) -> str:
        """Construct full Qdrant HTTP URL."""
        return f"http://{self.qdrant_host}:{self.qdrant_port}"
    
    @property
    def ollama_base_url(self) -> str:
        """Ensure Ollama URL has no trailing slash."""
        return self.ollama_host.rstrip("/")


@lru_cache()
def get_settings() -> Settings:
    """
    Cached settings instance.
    Use this function everywhere instead of creating new Settings() objects.
    """
    return Settings()


# Export for easy importing
settings = get_settings()