from functools import lru_cache
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    database_url: str = Field(
        ...,
        validation_alias=AliasChoices("DATABASE_URL", "SUPABASE_DATABASE_URL"),
        description="Supabase PostgreSQL connection URL (required)",
    )

    qdrant_host: str = Field(..., description="Qdrant hostname (required)")
    qdrant_port: int = Field(..., description="Qdrant HTTP port (required)")
    qdrant_collection_name: str = Field(
        default="material_synonyms",
        description="Name of the collection storing material embeddings",
    )

    ollama_host: str = Field(
        ...,
        validation_alias=AliasChoices("OLLAMA_HOST"),
        description="Ollama API base URL (required)",
    )
    ollama_model: str = Field(
        default="llama3.2:3b",
        description="Model name for classification (must be pulled in Ollama)",
    )
    ollama_timeout: int = Field(
        default=120,
        description="Timeout for LLM generation in seconds (classification can be slow)",
    )

    embedding_model: str = Field(
        default="sentence-transformers/all-MiniLM-L6-v2",
        description="HuggingFace model name for text embeddings",
    )
    vector_dimension: int = Field(
        default=384, description="Embedding dimension (must match model output)"
    )

    top_k_synonyms: int = Field(
        default=5, description="Number of similar synonyms to retrieve from Qdrant"
    )
    confidence_threshold: float = Field(
        default=0.7, description="Minimum confidence score to auto-accept classification (0-1)"
    )

    admin_token: str = Field(
        default="",
        description="Token required for /admin endpoints. Admin endpoints are disabled when empty.",
    )

    api_host: str = Field(default="0.0.0.0")
    api_port: int = Field(default=8001)
    debug: bool = Field(default=False)

    @property
    def ollama_base_url(self) -> str:
        return self.ollama_host.rstrip("/")


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
