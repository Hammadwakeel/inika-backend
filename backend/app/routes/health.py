from __future__ import annotations

import os
import time
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter(tags=["health"])


class HealthStatus(BaseModel):
    status: str
    timestamp: int
    checks: dict[str, dict[str, str | bool]]


def check_database(tenant_id: str | None = None) -> dict[str, str | bool]:
    try:
        from backend.app.services.auth_service import get_tenant_conn

        if tenant_id:
            with get_tenant_conn(tenant_id) as conn:
                conn.execute("SELECT 1")
            return {"status": "ok", "message": "Database connected"}
        return {"status": "ok", "message": "DB module available"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def check_whatsapp_bridge(tenant_id: str) -> dict[str, str | bool]:
    try:
        from backend.main import bridge_status_path, read_json_file

        status_file = bridge_status_path(tenant_id)
        if not status_file.exists():
            return {"status": "warning", "message": "Status file not found"}

        status_data = read_json_file(status_file, {})
        linked = status_data.get("linked", False)
        bridge_status = status_data.get("status", "unknown")

        return {
            "status": "ok" if linked else "warning",
            "linked": linked,
            "bridge_status": bridge_status,
            "message": f"WhatsApp {'connected' if linked else 'disconnected'}",
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


def check_vector_index(tenant_id: str) -> dict[str, str | bool]:
    try:
        from backend.knowledge_engine import index_path

        idx_path = index_path(tenant_id)
        exists = idx_path.exists()
        return {
            "status": "ok" if exists else "warning",
            "exists": exists,
            "message": "Vector index found" if exists else "No index built yet",
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


def check_api_keys() -> dict[str, dict[str, str | bool]]:
    checks = {}
    required_keys = {
        "OPENROUTER_API_KEY": "OpenRouter",
        "TAVILY_API_KEY": "Tavily Search",
    }

    for key, name in required_keys.items():
        value = os.environ.get(key, "")
        if value:
            if key == "OPENROUTER_API_KEY":
                masked = value[:12] + "..." if len(value) > 12 else "***"
            else:
                masked = value[:8] + "..." if len(value) > 8 else "***"
            checks[key] = {"status": "ok", "key": masked, "message": f"{name} configured"}
        else:
            checks[key] = {"status": "warning", "key": "", "message": f"{name} not configured"}

    return checks


def check_system_resources() -> dict[str, str | bool]:
    try:
        import psutil

        memory = psutil.virtual_memory()
        disk = psutil.disk_usage("/")

        return {
            "status": "ok",
            "memory_percent": memory.percent,
            "memory_available_mb": memory.available // (1024 * 1024),
            "disk_percent": disk.percent,
            "disk_free_gb": round(disk.free / (1024**3), 2),
        }
    except ImportError:
        return {"status": "warning", "message": "psutil not installed, resource check skipped"}
    except Exception as e:
        return {"status": "warning", "message": str(e)}


@router.get("/health")
async def health_check(request: Request) -> JSONResponse:
    tenant_id = request.query_params.get("tenant_id")

    checks = {
        "database": check_database(tenant_id),
        "system": check_system_resources(),
        "api_keys": check_api_keys(),
    }

    if tenant_id:
        checks["whatsapp_bridge"] = check_whatsapp_bridge(tenant_id)
        checks["vector_index"] = check_vector_index(tenant_id)

    overall_status = "ok"
    if any(c.get("status") == "error" for c in checks.values()):
        overall_status = "error"
    elif any(c.get("status") == "warning" for c in checks.values()):
        overall_status = "warning"

    response = {
        "status": overall_status,
        "timestamp": int(time.time()),
        "checks": checks,
    }

    status_code = 200 if overall_status in ("ok", "warning") else 503
    return JSONResponse(content=response, status_code=status_code)


@router.get("/health/live")
async def liveness_check() -> dict:
    return {"status": "alive", "timestamp": int(time.time())}


@router.get("/health/ready")
async def readiness_check() -> dict:
    try:
        from backend.app.core.config import JWT_SECRET
        from backend.app.services.auth_service import get_tenant_conn

        return {"status": "ready", "timestamp": int(time.time())}
    except Exception as e:
        return {"status": "not_ready", "error": str(e), "timestamp": int(time.time())}
