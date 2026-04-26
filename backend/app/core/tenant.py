from __future__ import annotations

import re
from pathlib import Path

from fastapi import HTTPException

from backend.app.core.config import DB_FILENAME, TENANTS_ROOT

TENANT_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{2,64}$")


def validate_tenant_id(tenant_id: str) -> str:
    if not TENANT_ID_PATTERN.fullmatch(tenant_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid tenant_id. Use letters, numbers, _ or - only.",
        )
    return tenant_id


def tenant_dir(tenant_id: str) -> Path:
    safe_tenant_id = validate_tenant_id(tenant_id)
    path = TENANTS_ROOT / safe_tenant_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def tenant_db_path(tenant_id: str) -> Path:
    return tenant_dir(tenant_id) / DB_FILENAME

