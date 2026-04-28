from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Query, Request, status

from backend.app.core.tenant import validate_tenant_id
from backend.app.routes.auth_middleware import TokenData, get_current_user


def require_tenant(tenant_id: str = Query(..., min_length=2, max_length=64)) -> str:
    return validate_tenant_id(tenant_id)


def require_auth(tenant_id: str = Query(..., min_length=2, max_length=64)) -> str:
    validated = validate_tenant_id(tenant_id)
    return validated


async def require_tenant_match(
    tenant_id: Annotated[str, Query(min_length=2, max_length=64)],
    current_user: TokenData = Depends(get_current_user),
) -> str:
    validated_tenant = validate_tenant_id(tenant_id)
    if validated_tenant != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this tenant.",
        )
    return validated_tenant


async def get_authenticated_tenant(
    request: Request,
    tenant_id: Annotated[str, Query(min_length=2, max_length=64)],
    current_user: TokenData = Depends(get_current_user),
) -> str:
    validated = validate_tenant_id(tenant_id)
    if validated != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant ID mismatch. You can only access your own tenant.",
        )
    return validated


TenantUser = Annotated[str, Depends(require_tenant_match)]
AuthUser = Annotated[TokenData, Depends(get_current_user)]
AuthenticatedTenant = Annotated[str, Depends(get_authenticated_tenant)]
