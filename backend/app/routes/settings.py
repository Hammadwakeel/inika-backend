from __future__ import annotations

from fastapi import APIRouter, Query

from backend.app.core.tenant import validate_tenant_id
from backend.app.services.memory_manager import get_rag_threshold, set_tenant_setting

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/rag-threshold")
def get_rag_threshold_endpoint(tenant_id: str = Query(..., min_length=2, max_length=64)) -> dict:
    tenant_id = validate_tenant_id(tenant_id)
    threshold = get_rag_threshold(tenant_id)
    return {"tenant_id": tenant_id, "rag_threshold": threshold}


@router.post("/rag-threshold")
def set_rag_threshold_endpoint(
    tenant_id: str = Query(..., min_length=2, max_length=64),
    threshold: float = Query(..., ge=0.0, le=1.0),
) -> dict:
    tenant_id = validate_tenant_id(tenant_id)
    set_tenant_setting(tenant_id, "rag_threshold", str(threshold))
    return {"tenant_id": tenant_id, "rag_threshold": threshold, "updated": True}
