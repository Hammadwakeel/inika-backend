from __future__ import annotations

import asyncio
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Query

from app.core.tenant import validate_tenant_id
from app.routes.auth_middleware import TokenData, get_current_user
from app.services.proactive_engine import ProactiveEngine, run_proactive_engine

router = APIRouter(prefix="/proactive", tags=["proactive"])


@router.get("/status")
def proactive_status(
    tenant_id: str = Query(..., min_length=2, max_length=64),
    current_user: TokenData = Annotated[TokenData, Depends(get_current_user)],
) -> dict:
    tenant_id = validate_tenant_id(tenant_id)
    if tenant_id != current_user.tenant_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Access denied")

    return {
        "status": "ok",
        "tenant_id": tenant_id,
        "message": "Proactive engine is running",
    }


@router.post("/trigger")
async def trigger_proactive(
    tenant_id: str = Query(..., min_length=2, max_length=64),
    current_user: TokenData = Annotated[TokenData, Depends(get_current_user)],
) -> dict:
    tenant_id = validate_tenant_id(tenant_id)
    if tenant_id != current_user.tenant_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Access denied")

    result = await run_proactive_engine(tenant_id)
    return result
