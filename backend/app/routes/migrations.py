from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.tenant import validate_tenant_id
from app.services.migrations import check_migrations_needed, run_migrations

router = APIRouter(prefix="/migrations", tags=["migrations"])


@router.get("/status")
def migration_status(tenant_id: str = Query(..., min_length=2, max_length=64)) -> dict:
    tenant_id = validate_tenant_id(tenant_id)
    return check_migrations_needed(tenant_id)


@router.post("/run")
def run_migrations_endpoint(
    tenant_id: str = Query(..., min_length=2, max_length=64),
    target_version: int | None = Query(default=None),
) -> dict:
    tenant_id = validate_tenant_id(tenant_id)
    return run_migrations(tenant_id, target_version)
