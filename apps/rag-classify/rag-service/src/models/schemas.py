# src/models/schemas.py
"""
Pydantic models for API request/response validation.
These define the JSON structure for all RAG service endpoints.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


class DocumentType(str, Enum):
    """Types of documents that can be classified."""
    INVOICE = "INVOICE"
    CERTIFICATE = "CERTIFICATE"
    UNKNOWN = "UNKNOWN"


class ClassificationRequest(BaseModel):
    """
    POST /classify request body.
    Contains text extracted from invoice/certificate to classify.
    """
    
    text: str = Field(
        ...,
        min_length=10,
        description="Raw text extracted from document (OCR output)",
        examples=["Reliance Industries POLYPET 3020 Bottle Grade 10,000 KG 15-01-2025"]
    )
    
    document_id: Optional[str] = Field(
        default=None,
        description="Optional document ID to link classification to existing record"
    )
    
    company_id: Optional[str] = Field(
        default=None,
        description="Optional company ID for scoping the classification"
    )
    
    @field_validator("text")
    @classmethod
    def clean_text(cls, v: str) -> str:
        """Normalize whitespace in input text."""
        return " ".join(v.split())  # Remove extra spaces, newlines


class ExtractedQuantity(BaseModel):
    """Quantity found in text with normalized values."""
    
    raw_value: str = Field(..., description="Original text found (e.g., '10,000 KG')")
    normalized_value: float = Field(..., description="Numeric value (e.g., 10000.0)")
    unit: str = Field(..., description="Unit of measurement (KG, MT, etc.)")


class SynonymMatch(BaseModel):
    """A material synonym retrieved from vector search."""
    
    synonym: str = Field(..., description="The trade name/synonym text")
    material_code: str = Field(..., description="Standardized code (PET, HDPE, etc.)")
    material_name: str = Field(..., description="Full material name")
    similarity_score: float = Field(
        ..., 
        ge=0.0, 
        le=1.0, 
        description="Vector similarity (0-1, higher is better)"
    )


class ClassificationResult(BaseModel):
    """
    Single material classification result.
    One document may have multiple materials (future: list of these).
    """
    
    material_code: str = Field(
        ...,
        description="Standardized plastic code from materials_master",
        examples=["PET", "HDPE", "LDPE", "PP", "PS", "PVC", "MLP"]
    )
    
    material_name: str = Field(
        ...,
        description="Full material name",
        examples=["Polyethylene Terephthalate", "High Density Polyethylene"]
    )
    
    confidence_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Overall confidence (0-1) combining vector + LLM scores",
        examples=[0.94]
    )
    
    reasoning: str = Field(
        ...,
        description="LLM explanation for why this material was chosen",
        examples=["POLYPET is a trade name for PET resin used in bottle manufacturing"]
    )
    
    matched_synonyms: List[SynonymMatch] = Field(
        default=[],
        description="Top matching synonyms from vector database"
    )
    
    extracted_quantity: Optional[ExtractedQuantity] = Field(
        default=None,
        description="Quantity extracted from text if found"
    )
    
    requires_human_review: bool = Field(
        default=False,
        description="True if confidence below threshold or ambiguous"
    )
    
    suggested_category: Optional[str] = Field(
        default=None,
        description="Suggested filing category if ambiguous"
    )


class ClassificationResponse(BaseModel):
    """
    POST /classify response body.
    Complete classification result with metadata.
    """
    
    success: bool = Field(..., description="Whether classification succeeded")
    
    document_type: DocumentType = Field(
        default=DocumentType.UNKNOWN,
        description="Detected document type (INVOICE, CERTIFICATE, etc.)"
    )
    
    classifications: List[ClassificationResult] = Field(
        default=[],
        description="List of materials found (usually 1, but could be multiple)"
    )
    
    raw_text: Optional[str] = Field(
        default=None,
        description="Echo of input text for verification"
    )
    
    processing_time_ms: int = Field(
        ...,
        description="Total time for classification in milliseconds",
        examples=[1250]
    )
    
    model_used: str = Field(
        default="llama3.2:3b",
        description="LLM model used for classification"
    )
    
    errors: Optional[List[str]] = Field(
        default=None,
        description="Any errors or warnings during processing"
    )


class HealthStatus(str, Enum):
    """Service health states."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"


class ServiceHealth(BaseModel):
    """Health check for individual service."""
    
    service: str = Field(..., examples=["postgresql", "qdrant", "ollama"])
    status: HealthStatus
    latency_ms: Optional[int] = None
    error: Optional[str] = None


class HealthResponse(BaseModel):
    """
    GET /health response.
    System health check for all dependencies.
    """
    
    status: HealthStatus
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    version: str = "0.1.0"
    
    services: List[ServiceHealth]
    
    @property
    def is_healthy(self) -> bool:
        """Quick check if all services are up."""
        return all(s.status == HealthStatus.HEALTHY for s in self.services)


class FeedbackRequest(BaseModel):
    """
    POST /feedback request for human corrections.
    Used to improve RAG system over time.
    """
    
    document_id: str = Field(..., description="ID of classified document")
    original_classification: str = Field(..., description="What RAG predicted")
    corrected_material_code: str = Field(..., description="Human-corrected code")
    corrected_quantity: Optional[float] = Field(default=None)
    notes: Optional[str] = Field(default=None, description="Why correction was needed")