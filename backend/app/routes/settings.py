from __future__ import annotations

from fastapi import APIRouter, Body, Query

from backend.app.core.tenant import validate_tenant_id
from backend.app.services.memory_manager import (
    get_agent_settings,
    get_rag_threshold,
    set_agent_settings,
    set_rag_threshold,
    set_tenant_setting,
)

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


@router.get("/agent")
def get_agent_settings_endpoint(tenant_id: str = Query(..., min_length=2, max_length=64)) -> dict:
    """Get agent settings including auto-reply and source preferences."""
    tenant_id = validate_tenant_id(tenant_id)
    settings = get_agent_settings(tenant_id)
    return {"tenant_id": tenant_id, **settings}


@router.post("/agent")
def set_agent_settings_endpoint(
    tenant_id: str = Query(..., min_length=2, max_length=64),
    auto_reply_enabled: bool | None = Body(default=None),
    use_web_search: bool | None = Body(default=None),
    use_knowledge_base: bool | None = Body(default=None),
) -> dict:
    """Update agent settings. All fields are optional - only provided fields are updated."""
    tenant_id = validate_tenant_id(tenant_id)
    settings = set_agent_settings(
        tenant_id,
        auto_reply_enabled=auto_reply_enabled,
        use_web_search=use_web_search,
        use_knowledge_base=use_knowledge_base,
    )
    return {"tenant_id": tenant_id, **settings, "updated": True}
