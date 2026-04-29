from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse

from app.core.tenant import validate_tenant_id
from app.services.router import get_recent_search_logs

router = APIRouter(prefix="/dispatcher", tags=["dispatcher"])


@router.get("/activity")
def dispatcher_activity(
    tenant_id: str = Query(..., min_length=2, max_length=64),
    limit: int = Query(30, ge=1, le=200),
) -> dict:
    safe = validate_tenant_id(tenant_id)
    return {"tenant_id": safe, "items": get_recent_search_logs(safe, limit=limit)}


@router.get("/activity/stream")
async def dispatcher_activity_stream(
    request: Request,
    tenant_id: str = Query(..., min_length=2, max_length=64),
    limit: int = Query(30, ge=1, le=200),
) -> StreamingResponse:
    safe = validate_tenant_id(tenant_id)

    async def event_generator():
        previous_payload = ""
        while True:
            if await request.is_disconnected():
                break
            payload = {"tenant_id": safe, "items": get_recent_search_logs(safe, limit=limit)}
            serialized = json.dumps(payload, separators=(",", ":"))
            if serialized != previous_payload:
                previous_payload = serialized
                yield f"data: {serialized}\n\n"
            await asyncio.sleep(1.5)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

