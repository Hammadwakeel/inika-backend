from __future__ import annotations

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    tenant_id: str = Field(min_length=2, max_length=64)
    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1, max_length=256)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    tenant_id: str
    username: str
    expires_at: str


class SendMessageRequest(BaseModel):
    tenant_id: str = Field(min_length=2, max_length=64)
    jid: str = Field(min_length=3, max_length=256)
    text: str = Field(min_length=1, max_length=4096)


class IdentityPayload(BaseModel):
    tenant_id: str = Field(min_length=2, max_length=64)
    base_identity: str = Field(default="")
    behavioral_rules: str = Field(default="")


class QueryPayload(BaseModel):
    tenant_id: str = Field(min_length=2, max_length=64)
    user_message: str = Field(min_length=1, max_length=4096)
    top_k: int = Field(default=4, ge=1, le=10)


class DispatcherQueryPayload(BaseModel):
    tenant_id: str = Field(min_length=2, max_length=64)
    user_message: str = Field(min_length=1, max_length=4096)
    guest_id: str = Field(default="guest")

