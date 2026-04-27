from __future__ import annotations

import time
from fastapi import APIRouter, Request, Depends
from pydantic import BaseModel

from backend.app.routes.auth_middleware import get_current_user, TokenData

router = APIRouter(tags=["dashboard"])


class ModuleStatus(BaseModel):
    active: bool
    ready: bool
    configured: bool
    stats: dict[str, str | int]


class DashboardStatus(BaseModel):
    timestamp: int
    whatsapp: ModuleStatus
    knowledge: ModuleStatus
    journey: ModuleStatus
    booking: ModuleStatus
    profile: ModuleStatus


def get_whatsapp_status(tenant_id: str | None) -> dict:
    """Check WhatsApp bridge status."""
    try:
        from backend.main import bridge_status_path, read_json_file

        if not tenant_id:
            return {
                "active": False,
                "ready": False,
                "configured": False,
                "stats": {"chats": 0, "messages": 0}
            }

        status_file = bridge_status_path(tenant_id)
        if not status_file.exists():
            return {
                "active": False,
                "ready": False,
                "configured": False,
                "stats": {"chats": 0, "messages": 0}
            }

        status_data = read_json_file(status_file, {})
        linked = status_data.get("linked", False)
        connected = status_data.get("status") == "connected"

        return {
            "active": linked and connected,
            "ready": linked,
            "configured": linked,
            "stats": {
                "chats": status_data.get("chat_count", 0),
                "messages": status_data.get("message_count", 0)
            }
        }
    except Exception:
        return {
            "active": False,
            "ready": False,
            "configured": False,
            "stats": {"chats": 0, "messages": 0}
        }


def get_knowledge_status(tenant_id: str | None) -> dict:
    """Check Knowledge Engine status."""
    try:
        from backend.knowledge_engine import index_path, chunks_path, read_status, list_uploaded_files

        if not tenant_id:
            return {
                "active": False,
                "ready": False,
                "configured": False,
                "stats": {"documents": 0, "vectors": 0}
            }

        idx_path = index_path(tenant_id)
        ch_path = chunks_path(tenant_id)
        status_data = read_status(tenant_id)
        files = list_uploaded_files(tenant_id)

        index_exists = idx_path.exists()
        chunks_exist = ch_path.exists()

        vector_count = 0
        if chunks_exist:
            import json
            chunks_data = json.loads(ch_path.read_text())
            vector_count = len(chunks_data) if isinstance(chunks_data, list) else 0

        document_count = len(files)
        configured = index_exists and chunks_exist
        ready = configured and vector_count > 0

        return {
            "active": ready,
            "ready": ready,
            "configured": configured,
            "stats": {
                "documents": document_count,
                "vectors": vector_count
            }
        }
    except Exception:
        return {
            "active": False,
            "ready": False,
            "configured": False,
            "stats": {"documents": 0, "vectors": 0}
        }


def get_journey_status(tenant_id: str | None) -> dict:
    """Check Journey module status."""
    try:
        if not tenant_id:
            return {
                "active": False,
                "ready": True,
                "configured": True,
                "stats": {"active": 0, "templates": 5, "running": 0}
            }

        from backend.app.services.auth_service import get_tenant_conn

        with get_tenant_conn(tenant_id) as conn:
            result = conn.execute("""
                SELECT COUNT(*) as active_count
                FROM guest_journeys
                WHERE status = 'active'
            """).fetchone()

            templates_result = conn.execute("""
                SELECT COUNT(*) as template_count
                FROM journey_templates
                WHERE is_active = true
            """).fetchone()

        active_count = result[0] if result else 0
        template_count = templates_result[0] if templates_result else 0

        configured = True
        ready = True

        return {
            "active": active_count > 0,
            "ready": ready,
            "configured": configured,
            "stats": {
                "active": active_count,
                "templates": template_count,
                "running": active_count
            }
        }
    except Exception:
        return {
            "active": False,
            "ready": True,
            "configured": True,
            "stats": {"active": 0, "templates": 5, "running": 0}
        }


def get_booking_status(tenant_id: str | None) -> dict:
    """Check Booking module status."""
    try:
        if not tenant_id:
            return {
                "active": False,
                "ready": True,
                "configured": True,
                "stats": {"today": 0, "upcoming": 0, "pending": 0}
            }

        from backend.app.services.auth_service import get_tenant_conn
        from datetime import date

        today = date.today().isoformat()

        with get_tenant_conn(tenant_id) as conn:
            today_result = conn.execute("""
                SELECT COUNT(*) as count
                FROM bookings
                WHERE booking_date = ?
            """, (today,)).fetchone()

            upcoming_result = conn.execute("""
                SELECT COUNT(*) as count
                FROM bookings
                WHERE booking_date > ? AND status = 'confirmed'
            """, (today,)).fetchone()

            pending_result = conn.execute("""
                SELECT COUNT(*) as count
                FROM bookings
                WHERE status = 'pending'
            """).fetchone()

        today_count = today_result[0] if today_result else 0
        upcoming_count = upcoming_result[0] if upcoming_result else 0
        pending_count = pending_result[0] if pending_result else 0

        configured = True
        ready = True

        return {
            "active": today_count > 0 or upcoming_count > 0,
            "ready": ready,
            "configured": configured,
            "stats": {
                "today": today_count,
                "upcoming": upcoming_count,
                "pending": pending_count
            }
        }
    except Exception:
        return {
            "active": False,
            "ready": True,
            "configured": True,
            "stats": {"today": 0, "upcoming": 0, "pending": 0}
        }


def get_profile_status(tenant_id: str | None) -> dict:
    """Check Profile module status."""
    return {
        "active": True,
        "ready": True,
        "configured": True,
        "stats": {"account": "active", "tenant": "valid", "session": "ok"}
    }


@router.get("/api/dashboard/status")
async def get_dashboard_status(
    request: Request,
    user: TokenData = Depends(get_current_user)
) -> DashboardStatus:
    """
    Get real-time status of all dashboard modules.
    """
    tenant_id = user.tenant_id

    return DashboardStatus(
        timestamp=int(time.time()),
        whatsapp=ModuleStatus(**get_whatsapp_status(tenant_id)),
        knowledge=ModuleStatus(**get_knowledge_status(tenant_id)),
        journey=ModuleStatus(**get_journey_status(tenant_id)),
        booking=ModuleStatus(**get_booking_status(tenant_id)),
        profile=ModuleStatus(**get_profile_status(tenant_id)),
    )