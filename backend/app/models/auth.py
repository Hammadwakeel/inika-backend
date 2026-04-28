from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class LoginRequest(BaseModel):
    """tenant_id is optional: bootstrap generates one; login can resolve the property by username+password."""

    tenant_id: str | None = Field(default=None, min_length=2, max_length=64)
    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1, max_length=256)

    @field_validator("tenant_id", mode="before")
    @classmethod
    def _empty_tenant_to_none(cls, v: object) -> str | None:
        if v is None:
            return None
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator("username", mode="before")
    @classmethod
    def _normalize_username(cls, v: object) -> str:
        if not isinstance(v, str):
            raise ValueError("username must be a string")
        normalized = v.strip()
        if not normalized:
            raise ValueError("username is required")
        return normalized


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    tenant_id: str
    username: str
    expires_at: str
