from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel, Field

from backend.app.core.tenant import validate_tenant_id
from backend.app.services.router import smart_query_router

router = APIRouter(prefix="/dispatcher", tags=["dispatcher"])


class DispatcherQueryPayload(BaseModel):
    tenant_id: str = Field(min_length=2, max_length=64)
    user_message: str = Field(min_length=1, max_length=4096)
    guest_id: str = Field(default="guest")


@router.post("/query")
async def dispatcher_query(payload: DispatcherQueryPayload, background_tasks: BackgroundTasks) -> dict:
    tenant_id = validate_tenant_id(payload.tenant_id)
    return smart_query_router(
        tenant_id=tenant_id,
        guest_id=payload.guest_id,
        user_msg=payload.user_message,
        background_tasks=background_tasks,
    )

