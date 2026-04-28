from __future__ import annotations

import json
from typing import Annotated, Any, AsyncIterator

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from fastapi.responses import StreamingResponse

from backend.app.core.tenant import validate_tenant_id
from backend.app.routes.auth_middleware import TokenData, get_current_user
from backend.app.services.booking_client import (
    fetch_guest_inventory,
    get_active_guests,
    get_guest_by_mobile,
    get_guest_by_room,
    get_guest_journey_status,
    sync_guests_to_db,
    fetch_todays_bookings,
)

router = APIRouter(prefix="/booking", tags=["booking"])


@router.get("/todays")
def get_todays_bookings(
    current_user: Annotated[TokenData, Depends(get_current_user)],
    tenant_id: str = Query(..., min_length=2, max_length=64),
) -> dict[str, Any]:
    tenant_id = validate_tenant_id(tenant_id)
    if tenant_id != current_user.tenant_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Access denied")

    guests = fetch_todays_bookings(tenant_id)
    return {
        "status": "ok",
        "count": len(guests),
        "guests": guests,
        "message": f"Found {len(guests)} guests for today",
    }


@router.get("/sync")
async def sync_booking_data(
    current_user: Annotated[TokenData, Depends(get_current_user)],
    tenant_id: str = Query(..., min_length=2, max_length=64),
) -> dict[str, Any]:
    tenant_id = validate_tenant_id(tenant_id)
    if tenant_id != current_user.tenant_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Access denied")

    raw = fetch_guest_inventory(tenant_id)
    if raw.get("status") == "error":
        return {"status": "error", "message": raw.get("error", "Failed to fetch")}

    try:
        data = json.loads(raw.get("data", "{}"))
        guests = data.get("data", [])
        if not isinstance(guests, list):
            guests = []

        synced = sync_guests_to_db(tenant_id, guests)
        return {
            "status": "ok",
            "synced": synced,
            "total_received": len(guests),
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/guests")
def list_guests(
    current_user: Annotated[TokenData, Depends(get_current_user)],
    tenant_id: str = Query(..., min_length=2, max_length=64),
) -> dict[str, Any]:
    tenant_id = validate_tenant_id(tenant_id)
    if tenant_id != current_user.tenant_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Access denied")

    guests = get_active_guests(tenant_id)
    return {
        "status": "ok",
        "count": len(guests),
        "guests": guests,
    }


@router.get("/guest/{identifier}")
def get_guest(
    identifier: str,
    current_user: Annotated[TokenData, Depends(get_current_user)],
    tenant_id: str = Query(..., min_length=2, max_length=64),
) -> dict[str, Any]:
    tenant_id = validate_tenant_id(tenant_id)
    if tenant_id != current_user.tenant_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Access denied")

    guest = get_guest_by_mobile(tenant_id, identifier)
    if not guest:
        guest = get_guest_by_room(tenant_id, identifier)
    if not guest:
        return {"status": "error", "message": "Guest not found"}

    journey = get_guest_journey_status(tenant_id, guest.get("id", ""))
    return {
        "status": "ok",
        "guest": guest,
        "journey": journey,
    }


@router.get("/guest/{identifier}/journey")
def get_journey(
    identifier: str,
    current_user: Annotated[TokenData, Depends(get_current_user)],
    tenant_id: str = Query(..., min_length=2, max_length=64),
) -> dict[str, Any]:
    tenant_id = validate_tenant_id(tenant_id)
    if tenant_id != current_user.tenant_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Access denied")

    guest = get_guest_by_mobile(tenant_id, identifier)
    if not guest:
        guest = get_guest_by_room(tenant_id, identifier)
    if not guest:
        return {"status": "error", "message": "Guest not found"}

    journey = get_guest_journey_status(tenant_id, guest.get("id", ""))
    return {"status": "ok", "journey": journey}
