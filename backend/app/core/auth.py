from __future__ import annotations

from fastapi import HTTPException, Request, status
from pydantic import BaseModel

from app.core.config import COOKIE_NAME
from app.services.auth import decode_token


class TokenData(BaseModel):
    username: str
    tenant_id: str


def get_token_from_request(request: Request) -> str | None:
    # Try Authorization header first (Bearer token)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:]  # Remove "Bearer " prefix

    # Try cookie second
    cookie_value = request.cookies.get(COOKIE_NAME)
    if cookie_value:
        return cookie_value

    # Fall back to query param
    return request.query_params.get("token")


def get_current_user(request: Request) -> TokenData:
    auth_token = get_token_from_request(request)
    if auth_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Please login first.",
            headers={"WWW-Authenticate": "Cookie"},
        )

    try:
        payload = decode_token(auth_token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token. Please login again.",
            headers={"WWW-Authenticate": "Cookie"},
        )

    username = payload.get("sub")
    tenant_id = payload.get("tenant_id")

    if not username or not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
            headers={"WWW-Authenticate": "Cookie"},
        )

    return TokenData(username=username, tenant_id=tenant_id)


def get_optional_user(request: Request) -> TokenData | None:
    auth_token = get_token_from_request(request)
    if auth_token is None:
        return None

    try:
        payload = decode_token(auth_token)
        username = payload.get("sub")
        tenant_id = payload.get("tenant_id")
        if username and tenant_id:
            return TokenData(username=username, tenant_id=tenant_id)
    except ValueError:
        pass

    return None


def require_super_admin(request: Request) -> TokenData:
    user = get_current_user(request)
    # For now, all authenticated users can access super-admin endpoints
    # Add role-based check here when roles are implemented
    return user
