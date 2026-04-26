from __future__ import annotations

import time
import uuid

from fastapi import APIRouter, HTTPException, Request, Response

from backend.app.core.tenant import validate_tenant_id
from backend.app.models.schemas import LoginRequest, TokenResponse
from backend.app.services.auth_service import (
    create_access_token,
    get_tenant_conn,
    hash_password,
    validate_password_strength,
    verify_password,
)

router = APIRouter(tags=["auth"])

MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_SECONDS = 15 * 60  # 15 minutes


def init_auth_attempts_table(conn) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS auth_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            ip_address TEXT NOT NULL DEFAULT '',
            attempts INTEGER NOT NULL DEFAULT 0,
            locked_until INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL DEFAULT 0
        )
        """
    )
    conn.commit()


def is_account_locked(conn, username: str, ip_address: str) -> tuple[bool, int]:
    now = int(time.time())
    row = conn.execute(
        "SELECT locked_until FROM auth_attempts WHERE username = ? AND ip_address = ? ORDER BY id DESC LIMIT 1",
        (username, ip_address),
    ).fetchone()

    if row and row["locked_until"] > now:
        remaining = row["locked_until"] - now
        return True, remaining

    return False, 0


def record_failed_attempt(conn, username: str, ip_address: str) -> int:
    now = int(time.time())
    row = conn.execute(
        "SELECT attempts, locked_until FROM auth_attempts WHERE username = ? AND ip_address = ? ORDER BY id DESC LIMIT 1",
        (username, ip_address),
    ).fetchone()

    if row and row["locked_until"] > now:
        return max(0, row["locked_until"] - now)

    attempts = (row["attempts"] + 1) if row else 1
    locked_until = now + LOCKOUT_DURATION_SECONDS if attempts >= MAX_LOGIN_ATTEMPTS else 0

    conn.execute(
        """
        INSERT INTO auth_attempts (username, ip_address, attempts, locked_until, updated_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (username, ip_address, attempts, locked_until, now),
    )
    conn.commit()

    if locked_until > now:
        return LOCKOUT_DURATION_SECONDS
    return 0


def clear_failed_attempts(conn, username: str, ip_address: str) -> None:
    conn.execute(
        "DELETE FROM auth_attempts WHERE username = ? AND ip_address = ?",
        (username, ip_address),
    )
    conn.commit()


@router.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, response: Response, request: Request) -> TokenResponse:
    tenant_id = validate_tenant_id(payload.tenant_id)

    with get_tenant_conn(tenant_id) as conn:
        init_auth_attempts_table(conn)

        ip_address = request.client.host if request.client else "unknown"
        is_locked, remaining = is_account_locked(conn, payload.username, ip_address)

        if is_locked:
            raise HTTPException(
                status_code=429,
                detail=f"Account locked. Try again in {remaining // 60} minutes.",
            )

        row = conn.execute(
            "SELECT username, hashed_password FROM users WHERE username = ?",
            (payload.username,),
        ).fetchone()
        tenant_user_count = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
        if row is None and tenant_user_count == 0:
            conn.execute(
                "INSERT INTO users (username, hashed_password) VALUES (?, ?)",
                (payload.username, hash_password(payload.password)),
            )
            conn.commit()
            row = conn.execute(
                "SELECT username, hashed_password FROM users WHERE username = ?",
                (payload.username,),
            ).fetchone()

    if row is None or not verify_password(payload.password, row["hashed_password"]):
        with get_tenant_conn(tenant_id) as conn:
            init_auth_attempts_table(conn)
            remaining = record_failed_attempt(conn, payload.username, ip_address)
            if remaining > 0:
                raise HTTPException(
                    status_code=429,
                    detail=f"Account locked. Try again in {remaining // 60} minutes.",
                )
        raise HTTPException(status_code=401, detail="Invalid username or password")

    with get_tenant_conn(tenant_id) as conn:
        init_auth_attempts_table(conn)
        clear_failed_attempts(conn, payload.username, ip_address)

    from backend.app.core.config import COOKIE_NAME, COOKIE_SECURE, JWT_EXPIRE_MINUTES

    token, expires_at = create_access_token(subject=row["username"], tenant_id=tenant_id)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=JWT_EXPIRE_MINUTES * 60,
        path="/",
    )
    return TokenResponse(
        access_token=token,
        tenant_id=tenant_id,
        username=row["username"],
        expires_at=expires_at.isoformat(),
    )


@router.get("/auth/tenant-id")
def generate_tenant_id() -> dict:
    return {"tenant_id": f"tenant-{uuid.uuid4().hex[:12]}"}


@router.post("/auth/bootstrap")
def bootstrap_user(payload: LoginRequest) -> dict:
    tenant_id = validate_tenant_id(payload.tenant_id)

    valid, msg = validate_password_strength(payload.password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)

    with get_tenant_conn(tenant_id) as conn:
        existing = conn.execute(
            "SELECT 1 FROM users WHERE username = ?",
            (payload.username,),
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="User already exists")
        conn.execute(
            "INSERT INTO users (username, hashed_password) VALUES (?, ?)",
            (payload.username, hash_password(payload.password)),
        )
        conn.commit()
    return {"message": "User created", "tenant_id": tenant_id}


@router.post("/auth/logout")
def logout(response: Response) -> dict:
    from backend.app.core.config import COOKIE_NAME

    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"message": "Logged out successfully"}

