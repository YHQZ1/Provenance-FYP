# src/routers/health.py
"""
Health check endpoints for monitoring.
"""

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from src.services.rag_pipeline import get_pipeline
from src.models.schemas import HealthResponse, HealthStatus, ServiceHealth

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("", response_model=HealthResponse)
async def health_check():
    """
    Check health of all RAG service dependencies.
    Returns status of: embedding model, Qdrant, Ollama, PostgreSQL
    """
    pipeline = get_pipeline()
    checks = pipeline.health_check()
    
    services = []
    overall_status = HealthStatus.HEALTHY
    
    # Check embedding
    emb_info = checks["embedding"]
    emb_healthy = emb_info.get("status") != "not_loaded"
    services.append(ServiceHealth(
        service="embedding",
        status=HealthStatus.HEALTHY if emb_healthy else HealthStatus.UNHEALTHY,
        error=None if emb_healthy else "Model not loaded"
    ))
    if not emb_healthy:
        overall_status = HealthStatus.UNHEALTHY
    
    # Check Qdrant
    vs_info = checks["vector_store"]
    vs_healthy = vs_info is not None and vs_info.get("vector_count", 0) >= 0
    services.append(ServiceHealth(
        service="qdrant",
        status=HealthStatus.HEALTHY if vs_healthy else HealthStatus.UNHEALTHY,
        error=None if vs_healthy else "Cannot connect to Qdrant"
    ))
    if not vs_healthy:
        overall_status = HealthStatus.UNHEALTHY
    
    # Check Ollama
    llm_info = checks["llm"]
    llm_healthy = llm_info.get("status") == "healthy"
    services.append(ServiceHealth(
        service="ollama",
        status=HealthStatus.HEALTHY if llm_healthy else HealthStatus.UNHEALTHY,
        error=llm_info.get("error") if not llm_healthy else None
    ))
    if not llm_healthy:
        overall_status = HealthStatus.UNHEALTHY
    
    # Check PostgreSQL
    db_healthy = checks["database"]
    services.append(ServiceHealth(
        service="postgresql",
        status=HealthStatus.HEALTHY if db_healthy else HealthStatus.UNHEALTHY,
        error=None if db_healthy else "Cannot connect to database"
    ))
    if not db_healthy:
        overall_status = HealthStatus.UNHEALTHY
    
    # Degraded if some non-critical issues
    unhealthy_count = sum(1 for s in services if s.status != HealthStatus.HEALTHY)
    if unhealthy_count > 0 and overall_status == HealthStatus.HEALTHY:
        overall_status = HealthStatus.DEGRADED
    
    return HealthResponse(
        status=overall_status,
        services=services
    )