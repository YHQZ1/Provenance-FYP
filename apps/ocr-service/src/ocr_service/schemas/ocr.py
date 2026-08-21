from typing import Any

from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    width: float = Field(ge=0, le=1)
    height: float = Field(ge=0, le=1)


class OCRToken(BaseModel):
    text: str
    page: int = Field(ge=0)
    confidence: float = Field(ge=0, le=1)
    source: str
    box: BoundingBox


class ExtractedField(BaseModel):
    value: str | None = None
    confidence: float = Field(default=0, ge=0, le=1)


class InvoiceLineItem(BaseModel):
    description: str
    quantity: float | None = None
    unit: str | None = None
    rate: float | None = None
    amount: float | None = None
    raw_text: str
    confidence: float = Field(default=0, ge=0, le=1)


class OCRResponse(BaseModel):
    document_type: str = "unknown"
    filename: str | None = None
    pages: int = Field(ge=1)
    raw_text: str
    tokens: list[OCRToken]
    fields: dict[str, ExtractedField]
    line_items: list[InvoiceLineItem]
    confidence: float = Field(ge=0, le=1)
    warnings: list[str] = []
    metadata: dict[str, Any] = {}
