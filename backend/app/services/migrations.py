from __future__ import annotations

import sqlite3
import time
from typing import Any

from backend.app.services.auth_service import get_tenant_conn


MIGRATIONS: list[tuple[int, str, str]] = [
    (
        1,
        "initial_schema",
        """
        CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY,
            applied_at INTEGER NOT NULL
        );
        """,
    ),
    (
        2,
        "add_auth_attempts",
        """
        CREATE TABLE IF NOT EXISTS auth_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            ip_address TEXT NOT NULL DEFAULT '',
            attempts INTEGER NOT NULL DEFAULT 0,
            locked_until INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL DEFAULT 0
        );
        """,
    ),
    (
        3,
        "add_tenant_settings",
        """
        CREATE TABLE IF NOT EXISTS tenant_settings (
            key TEXT NOT NULL UNIQUE,
            value TEXT NOT NULL DEFAULT '',
            updated_at INTEGER NOT NULL DEFAULT 0
        );
        """,
    ),
    (
        4,
        "add_performance_indexes",
        """
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE INDEX IF NOT EXISTS idx_sessions_guest_id ON sessions(guest_id);
        CREATE INDEX IF NOT EXISTS idx_session_history_session_id ON session_history(session_id);
        CREATE INDEX IF NOT EXISTS idx_search_logs_session_id ON search_logs(session_id);
        """,
    ),
    (
        5,
        "add_wal_mode",
        """
        PRAGMA journal_mode=WAL;
        PRAGMA busy_timeout=30000;
        """,
    ),
]


def get_current_version(conn: sqlite3.Connection) -> int:
    try:
        row = conn.execute(
            "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1"
        ).fetchone()
        return int(row["version"]) if row else 0
    except Exception:
        return 0


def run_migrations(tenant_id: str, target_version: int | None = None) -> dict[str, Any]:
    with get_tenant_conn(tenant_id) as conn:
        current = get_current_version(conn)

        if target_version is None:
            target_version = len(MIGRATIONS)

        applied: list[dict[str, Any]] = []
        now = int(time.time())

        for version, name, sql in MIGRATIONS:
            if version <= current:
                continue
            if version > target_version:
                break

            try:
                for statement in sql.split(";"):
                    statement = statement.strip()
                    if statement:
                        conn.execute(statement)
                conn.execute(
                    "INSERT INTO schema_version (version, applied_at) VALUES (?, ?)",
                    (version, now),
                )
                conn.commit()
                applied.append({
                    "version": version,
                    "name": name,
                    "applied_at": now,
                })
            except Exception as e:
                conn.rollback()
                return {
                    "status": "error",
                    "error": str(e),
                    "failed_at_version": version,
                    "applied": applied,
                }

        return {
            "status": "ok",
            "tenant_id": tenant_id,
            "from_version": current,
            "to_version": get_current_version(conn),
            "applied": applied,
        }


def check_migrations_needed(tenant_id: str) -> dict[str, Any]:
    with get_tenant_conn(tenant_id) as conn:
        current = get_current_version(conn)
        latest = len(MIGRATIONS)
        return {
            "tenant_id": tenant_id,
            "current_version": current,
            "latest_version": latest,
            "migrations_needed": latest - current,
            "up_to_date": current >= latest,
        }
