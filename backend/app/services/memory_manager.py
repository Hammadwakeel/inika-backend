from __future__ import annotations

import sqlite3
import time
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Generator

from app.core.tenant import tenant_db_path
from app.services.auth import get_tenant_conn
from app.services.llm_service import chat_completion


def ensure_session_schema(tenant_id: str) -> None:
    with get_tenant_conn(tenant_id) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL UNIQUE,
                guest_id TEXT NOT NULL,
                session_summary TEXT NOT NULL DEFAULT '',
                summarized_until_history_id INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS session_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS search_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                user_query TEXT NOT NULL,
                event_type TEXT NOT NULL,
                detail TEXT NOT NULL,
                score REAL,
                source TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS tenant_settings (
                key TEXT NOT NULL UNIQUE,
                value TEXT NOT NULL DEFAULT '',
                updated_at INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sessions_guest_id ON sessions(guest_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_session_history_session_id ON session_history(session_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_search_logs_session_id ON search_logs(session_id)")
        conn.commit()


def get_or_create_session(tenant_id: str, guest_id: str) -> str:
    ensure_session_schema(tenant_id)
    now_ts = int(time.time())
    with get_tenant_conn(tenant_id) as conn:
        row = conn.execute(
            "SELECT session_id FROM sessions WHERE guest_id = ? ORDER BY id DESC LIMIT 1",
            (guest_id,),
        ).fetchone()
        if row:
            conn.execute(
                "UPDATE sessions SET updated_at = ? WHERE session_id = ?",
                (now_ts, row["session_id"]),
            )
            conn.commit()
            return str(row["session_id"])

        session_id = f"sess-{uuid.uuid4().hex[:16]}"
        conn.execute(
            "INSERT INTO sessions (session_id, guest_id, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (session_id, guest_id, now_ts, now_ts),
        )
        conn.commit()
        return session_id


def append_session_message(tenant_id: str, session_id: str, role: str, content: str) -> None:
    ensure_session_schema(tenant_id)
    now_ts = int(time.time())
    with get_tenant_conn(tenant_id) as conn:
        conn.execute(
            "INSERT INTO session_history (session_id, role, content, created_at) VALUES (?, ?, ?, ?)",
            (session_id, role, content, now_ts),
        )
        conn.execute(
            "UPDATE sessions SET updated_at = ? WHERE session_id = ?",
            (now_ts, session_id),
        )
        conn.commit()


def get_recent_messages(tenant_id: str, session_id: str, limit: int = 10) -> list[dict[str, Any]]:
    ensure_session_schema(tenant_id)
    with get_tenant_conn(tenant_id) as conn:
        rows = conn.execute(
            """
            SELECT id, role, content, created_at
            FROM session_history
            WHERE session_id = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (session_id, limit),
        ).fetchall()
        ordered = list(reversed(rows))
        return [dict(row) for row in ordered]


def get_message_count(tenant_id: str, session_id: str) -> int:
    ensure_session_schema(tenant_id)
    with get_tenant_conn(tenant_id) as conn:
        row = conn.execute(
            "SELECT COUNT(*) FROM session_history WHERE session_id = ?",
            (session_id,),
        ).fetchone()
        return int(row[0] if row else 0)


def get_session_summary(tenant_id: str, session_id: str) -> str:
    ensure_session_schema(tenant_id)
    with get_tenant_conn(tenant_id) as conn:
        row = conn.execute(
            "SELECT session_summary FROM sessions WHERE session_id = ?",
            (session_id,),
        ).fetchone()
        if not row:
            return ""
        return str(row["session_summary"] or "")


def summarize_session_window(tenant_id: str, session_id: str) -> bool:
    ensure_session_schema(tenant_id)
    with get_tenant_conn(tenant_id) as conn:
        session_row = conn.execute(
            "SELECT session_summary, summarized_until_history_id FROM sessions WHERE session_id = ?",
            (session_id,),
        ).fetchone()
        if not session_row:
            return False

        total_row = conn.execute(
            "SELECT COUNT(*) AS c FROM session_history WHERE session_id = ?",
            (session_id,),
        ).fetchone()
        total_count = int(total_row["c"] if total_row else 0)
        if total_count <= 20:
            return False

        summarized_until = int(session_row["summarized_until_history_id"] or 0)
        window_rows = conn.execute(
            """
            SELECT id, role, content
            FROM session_history
            WHERE session_id = ? AND id > ?
            ORDER BY id ASC
            LIMIT 15
            """,
            (session_id, summarized_until),
        ).fetchall()
        if len(window_rows) < 15:
            return False

        dialogue = "\n".join([f"{row['role'].upper()}: {row['content']}" for row in window_rows])
        existing_summary = str(session_row["session_summary"] or "")

        system_prompt = (
            "You summarize chat memory for an AI assistant. "
            "Keep durable facts, user preferences, commitments, and pending tasks in concise bullet points."
        )
        user_prompt = (
            f"Existing summary:\n{existing_summary or 'None'}\n\n"
            f"New messages to fold into summary:\n{dialogue}\n\n"
            "Return an updated compact summary."
        )
        try:
            updated_summary = chat_completion(system_prompt=system_prompt, user_prompt=user_prompt).strip()
        except Exception:
            updated_summary = (existing_summary + "\n" + dialogue)[-4000:].strip()

        max_id = int(window_rows[-1]["id"])
        now_ts = int(time.time())
        conn.execute(
            """
            UPDATE sessions
            SET session_summary = ?, summarized_until_history_id = ?, updated_at = ?
            WHERE session_id = ?
            """,
            (updated_summary, max_id, now_ts, session_id),
        )
        conn.commit()
        return True


def get_tenant_setting(tenant_id: str, key: str, default: str = "") -> str:
    ensure_session_schema(tenant_id)
    with get_tenant_conn(tenant_id) as conn:
        row = conn.execute(
            "SELECT value FROM tenant_settings WHERE key = ?",
            (key,),
        ).fetchone()
        return str(row["value"]) if row else default


def set_tenant_setting(tenant_id: str, key: str, value: str) -> None:
    ensure_session_schema(tenant_id)
    now_ts = int(time.time())
    with get_tenant_conn(tenant_id) as conn:
        conn.execute(
            """
            INSERT INTO tenant_settings (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            """,
            (key, value, now_ts),
        )
        conn.commit()


def get_rag_threshold(tenant_id: str) -> float:
    value = get_tenant_setting(tenant_id, "rag_threshold", "0.15")
    try:
        threshold = float(value)
        return max(0.0, min(1.0, threshold))
    except (ValueError, TypeError):
        return 0.15


def get_agent_settings(tenant_id: str) -> dict[str, bool]:
    """Get agent settings for auto-reply and sources."""
    return {
        "auto_reply_enabled": get_tenant_setting(tenant_id, "auto_reply_enabled", "false").lower() == "true",
        "use_web_search": get_tenant_setting(tenant_id, "use_web_search", "false").lower() == "true",
        "use_knowledge_base": get_tenant_setting(tenant_id, "use_knowledge_base", "true").lower() == "true",
    }


def set_agent_settings(tenant_id: str, auto_reply_enabled: bool | None = None,
                       use_web_search: bool | None = None, use_knowledge_base: bool | None = None) -> dict[str, bool]:
    """Set agent settings for auto-reply and sources."""
    if auto_reply_enabled is not None:
        set_tenant_setting(tenant_id, "auto_reply_enabled", "true" if auto_reply_enabled else "false")
    if use_web_search is not None:
        set_tenant_setting(tenant_id, "use_web_search", "true" if use_web_search else "false")
    if use_knowledge_base is not None:
        set_tenant_setting(tenant_id, "use_knowledge_base", "true" if use_knowledge_base else "false")
    return get_agent_settings(tenant_id)

