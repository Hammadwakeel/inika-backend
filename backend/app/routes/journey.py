from fastapi import APIRouter, Depends, Query

from backend.app.core.tenant import validate_tenant_id
from backend.app.routes.auth_middleware import TokenData, get_current_user, require_super_admin
from backend.app.services.auth_service import get_tenant_conn
from backend.app.services.journey_scheduler import JourneyScheduler, run_all_tenants, run_journey_for_tenant
from backend.app.services.booking_client import get_active_guests

router = APIRouter(prefix="/journey", tags=["journey"])

_scheduler: JourneyScheduler | None = None


def get_scheduler() -> JourneyScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = JourneyScheduler(check_interval_seconds=900)  # 15 minutes
    return _scheduler


@router.get("/status")
def journey_status(
    tenant_id: str = Query(..., min_length=2, max_length=64),
    current_user: TokenData = Depends(get_current_user),
) -> dict:
    tenant_id = validate_tenant_id(tenant_id)
    if tenant_id != current_user.tenant_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Access denied")

    return {
        "status": "ok",
        "tenant_id": tenant_id,
        "scheduler": "running" if get_scheduler()._running else "stopped",
        "message": "Journey scheduler is active (runs every 15 minutes)",
    }


@router.get("/summary")
def journey_summary(
    tenant_id: str = Query(..., min_length=2, max_length=64),
    current_user: TokenData = Depends(get_current_user),
) -> dict:
    """Get guest list with message status for the frontend dashboard."""
    tenant_id = validate_tenant_id(tenant_id)
    if tenant_id != current_user.tenant_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Access denied")

    guests = get_active_guests(tenant_id)

    # Get message counts from database
    with get_tenant_conn(tenant_id) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS journey_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guest_id TEXT NOT NULL,
                jid TEXT,
                message_type TEXT NOT NULL,
                message_text TEXT NOT NULL,
                job_id TEXT,
                created_at INTEGER NOT NULL,
                delivered INTEGER DEFAULT 0
            )
        """)
        message_counts = {}
        rows = conn.execute(
            """
            SELECT guest_id, message_type, COUNT(*) as cnt
            FROM journey_messages
            GROUP BY guest_id, message_type
            """
        ).fetchall()
        for row in rows:
            gid = row["guest_id"]
            mtype = row["message_type"]
            if gid not in message_counts:
                message_counts[gid] = {}
            message_counts[gid][mtype] = row["cnt"]

    # Build guest list with status
    guest_list = []
    for g in guests:
        gid = g.get("id", "")
        counts = message_counts.get(gid, {})
        guest_list.append({
            "guest_id": gid,
            "gname": g.get("gname", ""),
            "room": g.get("room", ""),
            "mobile": g.get("mobile", ""),
            "gstatus": g.get("gstatus", ""),
            "cindate": g.get("cindate", ""),
            "coutdate": g.get("coutdate", ""),
            "btype": g.get("btype", ""),
            "welcome_sent": counts.get("checkin-morning", 0) + counts.get("checkin-afternoon", 0) + counts.get("checkin-evening", 0) + counts.get("checkin-late", 0),
            "breakfast_sent": counts.get("daily-morning", 0),
            "lunch_sent": counts.get("daily-lunch", 0),
            "dinner_sent": counts.get("daily-evening", 0),
            "checkout_sent": counts.get("checkout-morning", 0),
            "amenity_sent": 0,
            "total_sent": sum(counts.values()),
        })

    total_messages = sum(g.get("total_sent", 0) for g in guest_list)

    return {
        "status": "ok",
        "tenant_id": tenant_id,
        "total_guests": len(guest_list),
        "active_guests": len([g for g in guest_list if g.get("gstatus") in ("Arrived", "StayOver")]),
        "checked_out": len([g for g in guest_list if g.get("gstatus") == "Checked Out"]),
        "total_messages_sent": total_messages,
        "guests": guest_list,
    }


@router.post("/trigger")
async def trigger_journey(
    tenant_id: str = Query(..., min_length=2, max_length=64),
    dry_run: bool = Query(False),
    current_user: TokenData = Depends(get_current_user),
) -> dict:
    tenant_id = validate_tenant_id(tenant_id)
    if tenant_id != current_user.tenant_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Access denied")

    result = await run_journey_for_tenant(tenant_id, dry_run=dry_run)
    return result


@router.post("/run-all")
async def run_all_journeys(
    dry_run: bool = Query(False),
    current_user: TokenData = Depends(require_super_admin),
) -> dict:
    result = await run_all_tenants(dry_run=dry_run)
    return result


@router.post("/start")
async def start_scheduler(
    current_user: TokenData = Depends(get_current_user),
) -> dict:
    scheduler = get_scheduler()
    await scheduler.start()
    return {"status": "ok", "message": "Journey scheduler started"}


@router.post("/stop")
async def stop_scheduler(
    current_user: TokenData = Depends(get_current_user),
) -> dict:
    scheduler = get_scheduler()
    await scheduler.stop()
    return {"status": "ok", "message": "Journey scheduler stopped"}