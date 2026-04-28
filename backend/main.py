from __future__ import annotations

import json
import os
import shutil
import sqlite3
import subprocess
import time
import asyncio
from pathlib import Path
from typing import Annotated, Any

from fastapi import Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.app.core.tenant import validate_tenant_id
from backend.app.main import app
from backend.app.routes.auth_middleware import TokenData, get_current_user
from backend.message_dispatcher import router as dispatcher_router
from backend.app.routes.sse_streamer import router as sse_streamer_router
from backend.app.routes.settings import router as settings_router
from backend.app.routes.health import router as health_router
from backend.app.routes.migrations import router as migrations_router
from backend.app.routes.proactive import router as proactive_router
from backend.app.routes.booking import router as booking_router
from backend.app.routes.journey import router as journey_router
from backend.knowledge_engine import router as knowledge_engine_router

BASE_DIR = Path(__file__).resolve().parent.parent
TENANTS_ROOT = BASE_DIR / "data" / "tenants"
BRIDGE_SCRIPT = Path(__file__).resolve().parent / "whatsapp_bridge.js"
BRIDGE_PROCESSES: dict[str, subprocess.Popen[Any]] = {}


class SendMessageRequest(BaseModel):
    tenant_id: str = Field(min_length=2, max_length=64)
    jid: str = Field(min_length=3, max_length=256)
    text: str = Field(min_length=1, max_length=4096)


def tenant_dir(tenant_id: str) -> Path:
    safe_tenant = validate_tenant_id(tenant_id)
    path = TENANTS_ROOT / safe_tenant
    path.mkdir(parents=True, exist_ok=True)
    return path


def tenant_db(tenant_id: str) -> Path:
    return tenant_dir(tenant_id) / "axiom.db"


def bridge_status_path(tenant_id: str) -> Path:
    return tenant_dir(tenant_id) / "wa-status.json"


def bridge_chats_path(tenant_id: str) -> Path:
    return tenant_dir(tenant_id) / "wa-chats.json"


def bridge_messages_path(tenant_id: str) -> Path:
    return tenant_dir(tenant_id) / "wa-messages.json"


def bridge_outbox_path(tenant_id: str) -> Path:
    return tenant_dir(tenant_id) / "wa-outbox.json"


def tenant_session_dir(tenant_id: str) -> Path:
    return tenant_dir(tenant_id) / "wa-session"


def read_json_file(path: Path, fallback: dict[str, Any] | None = None) -> dict[str, Any]:
    if fallback is None:
        fallback = {}
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return fallback


def ensure_bridge_running(tenant_id: str) -> None:
    if not BRIDGE_SCRIPT.exists():
        raise HTTPException(status_code=500, detail="whatsapp_bridge.js not found")

    existing = BRIDGE_PROCESSES.get(tenant_id)
    if existing is not None and existing.poll() is None:
        return

    tenant_path = tenant_dir(tenant_id)
    log_file = (tenant_path / "wa-bridge.log").open("a", encoding="utf-8")
    cmd = [
        "node",
        str(BRIDGE_SCRIPT),
        "--tenant",
        tenant_id,
        "--tenantDir",
        str(tenant_path),
        "--mode",
        "daemon",
    ]
    try:
        proc = subprocess.Popen(
            cmd,
            stdout=log_file,
            stderr=log_file,
            env={**os.environ, "AXIOM_TENANT_ID": tenant_id},
            cwd=str(Path(__file__).resolve().parent),
            start_new_session=True,
        )
        BRIDGE_PROCESSES[tenant_id] = proc
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Failed to start bridge: {exc}") from exc

    if proc.pid:
        log_file.write(f"[AXIOM] Bridge spawned with PID {proc.pid}\n")
        log_file.flush()


def restart_bridge(tenant_id: str) -> None:
    existing = BRIDGE_PROCESSES.get(tenant_id)
    if existing is not None and existing.poll() is None:
        try:
            existing.terminate()
            existing.wait(timeout=5)
        except subprocess.TimeoutExpired:
            existing.kill()
        except OSError:
            pass
        except Exception:
            pass
    BRIDGE_PROCESSES.pop(tenant_id, None)
    ensure_bridge_running(tenant_id)


def reset_bridge_session(tenant_id: str) -> None:
    session_dir = tenant_session_dir(tenant_id)
    if session_dir.exists():
        shutil.rmtree(session_dir, ignore_errors=True)
    status_path = bridge_status_path(tenant_id)
    chats_path = bridge_chats_path(tenant_id)
    messages_path = bridge_messages_path(tenant_id)
    outbox_path = bridge_outbox_path(tenant_id)
    for path in (status_path, chats_path, messages_path, outbox_path):
        if path.exists():
            try:
                path.unlink()
            except OSError:
                pass


def ensure_whatsapp_chat_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS whatsapp_chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            jid TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            last_message TEXT NOT NULL DEFAULT '',
            timestamp INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()


def ensure_whatsapp_message_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS whatsapp_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id TEXT NOT NULL UNIQUE,
            jid TEXT NOT NULL,
            sender TEXT NOT NULL,
            text TEXT NOT NULL DEFAULT '',
            timestamp INTEGER NOT NULL DEFAULT 0,
            from_me INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()


def ensure_auto_reply_log_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS auto_reply_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_message_id TEXT NOT NULL UNIQUE,
            jid TEXT NOT NULL,
            response TEXT NOT NULL DEFAULT '',
            sent_at INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()


# Per-conversation rate limiting: track last reply time per jid
_last_reply_time: dict[str, float] = {}
_REPLY_COOLDOWN = 10  # seconds between replies per conversation


def get_new_incoming_messages(tenant_id: str, messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return only genuinely NEW incoming messages that haven't been replied to yet."""
    if not messages:
        return []

    now = int(time.time())
    cutoff = now - 120  # Only consider messages from last 2 minutes

    db_path = tenant_db(tenant_id)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        ensure_auto_reply_log_table(conn)

        # Get all replied message IDs
        replied = conn.execute("SELECT source_message_id FROM auto_reply_log").fetchall()
        replied_ids = {str(row["source_message_id"]) for row in replied}

        # Clean up old reply logs (keep only last 10 minutes)
        conn.execute("DELETE FROM auto_reply_log WHERE sent_at < ?", (now - 600,))
        conn.commit()

        # Filter: only NEW incoming messages
        new_incoming = []
        for msg in messages:
            msg_id = str(msg.get("message_id", "")).strip()
            from_me = bool(msg.get("from_me", False))
            jid = str(msg.get("jid", "")).strip()
            text = str(msg.get("text", "")).strip()
            timestamp = int(msg.get("timestamp", 0))

            if from_me or not msg_id or not text:
                continue
            if jid == "status@broadcast" or "@g.us" in jid:  # Skip group chats
                continue
            if timestamp < cutoff:
                continue  # Too old, ignore

            if msg_id in replied_ids:
                continue  # Already auto-replied

            # Per-conversation rate limit
            conversation_key = f"{tenant_id}:{jid}"
            last_reply = _last_reply_time.get(conversation_key, 0)
            if now - last_reply < _REPLY_COOLDOWN:
                continue  # Too soon since last reply to this conversation

            new_incoming.append(msg)

        return new_incoming
    finally:
        conn.close()


def log_auto_reply(tenant_id: str, jid: str, msg_id: str, response: str) -> None:
    """Log that an auto-reply was sent to prevent duplicates."""
    db_path = tenant_db(tenant_id)
    conn = sqlite3.connect(db_path)
    try:
        ensure_auto_reply_log_table(conn)
        conn.execute(
            """
            INSERT OR IGNORE INTO auto_reply_log (source_message_id, jid, response, sent_at)
            VALUES (?, ?, ?, ?)
            """,
            (msg_id, jid, response[:500], int(time.time())),
        )
        conn.commit()
    finally:
        conn.close()
        # Update rate limit tracker
        conversation_key = f"{tenant_id}:{jid}"
        _last_reply_time[conversation_key] = time.time()


def persist_chats(tenant_id: str, chats: list[dict[str, Any]]) -> None:
    db_path = tenant_db(tenant_id)
    conn = sqlite3.connect(db_path)
    try:
        ensure_whatsapp_chat_table(conn)
        for chat in chats:
            conn.execute(
                """
                INSERT INTO whatsapp_chats (jid, name, last_message, timestamp)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(jid) DO UPDATE SET
                    name = excluded.name,
                    last_message = excluded.last_message,
                    timestamp = excluded.timestamp,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (
                    chat.get("jid", ""),
                    chat.get("name", ""),
                    chat.get("last_message", ""),
                    int(chat.get("timestamp", 0)),
                ),
            )
        conn.commit()
    finally:
        conn.close()


def persist_messages(tenant_id: str, messages: list[dict[str, Any]]) -> None:
    db_path = tenant_db(tenant_id)
    conn = sqlite3.connect(db_path)
    try:
        ensure_whatsapp_message_table(conn)
        for message in messages:
            conn.execute(
                """
                INSERT INTO whatsapp_messages (message_id, jid, sender, text, timestamp, from_me)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(message_id) DO UPDATE SET
                    sender = excluded.sender,
                    text = excluded.text,
                    timestamp = excluded.timestamp,
                    from_me = excluded.from_me
                """,
                (
                    message.get("message_id", ""),
                    message.get("jid", ""),
                    message.get("sender", ""),
                    message.get("text", ""),
                    int(message.get("timestamp", 0)),
                    1 if bool(message.get("from_me", False)) else 0,
                ),
            )
        conn.commit()
    finally:
        conn.close()


def get_saved_chats(tenant_id: str) -> list[dict[str, Any]]:
    db_path = tenant_db(tenant_id)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        ensure_whatsapp_chat_table(conn)
        rows = conn.execute(
            """
            SELECT jid, name, last_message, timestamp
            FROM whatsapp_chats
            ORDER BY timestamp DESC
            """
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def get_saved_messages(tenant_id: str, jid: str | None = None) -> list[dict[str, Any]]:
    db_path = tenant_db(tenant_id)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        ensure_whatsapp_message_table(conn)
        if jid:
            rows = conn.execute(
                """
                SELECT message_id, jid, sender, text, timestamp, from_me
                FROM whatsapp_messages
                WHERE jid = ?
                ORDER BY timestamp ASC
                LIMIT 500
                """,
                (jid,),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT message_id, jid, sender, text, timestamp, from_me
                FROM whatsapp_messages
                ORDER BY timestamp DESC
                LIMIT 500
                """
            ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def sync_tenant_data(tenant_id: str) -> dict[str, Any]:
    payload = read_json_file(bridge_status_path(tenant_id), {"linked": False, "status": "pending"})
    linked = bool(payload.get("linked", False))
    chats_payload = read_json_file(bridge_chats_path(tenant_id), {"chats": []})
    chats = chats_payload.get("chats", []) if linked else []
    if linked and isinstance(chats, list):
        persist_chats(tenant_id, chats)

    messages_payload = read_json_file(bridge_messages_path(tenant_id), {"messages": []})
    messages = messages_payload.get("messages", []) if linked else []
    if linked and isinstance(messages, list) and not messages and isinstance(chats, list):
        # Fallback seed so a chat thread is not empty when provider only sends chat summaries.
        messages = [
            {
                "message_id": f"seed-{chat.get('jid', '')}-{int(chat.get('timestamp', 0))}",
                "jid": chat.get("jid", ""),
                "sender": chat.get("name", chat.get("jid", "")),
                "text": chat.get("last_message", "Recent activity"),
                "timestamp": int(chat.get("timestamp", 0)),
                "from_me": False,
            }
            for chat in chats
            if chat.get("jid")
        ]
    if linked and isinstance(messages, list):
        # Step 1: Find genuinely NEW incoming messages BEFORE persisting
        new_messages = get_new_incoming_messages(tenant_id, messages)
        if new_messages:
            print(f"[DEBUG] Found {len(new_messages)} new incoming messages in {tenant_id}")
            for msg in new_messages:
                print(f"[DEBUG] New msg: jid={msg.get('jid')}, text={msg.get('text')[:50]}")

        # Step 2: Persist all messages
        persist_messages(tenant_id, messages)

        # Step 3: Trigger auto-reply for only genuinely new messages
        if new_messages:
            for msg in new_messages:
                _trigger_auto_reply(tenant_id, msg)

    return payload


def _trigger_auto_reply(tenant_id: str, message: dict[str, Any]) -> None:
    """Trigger auto-reply in background thread for a new incoming message."""
    import threading
    from backend.app.services.memory_manager import get_agent_settings

    msg_id = str(message.get("message_id", "")).strip()
    jid = str(message.get("jid", "")).strip()
    text = str(message.get("text", "")).strip()

    print(f"[AUTO-REPLY] Checking msg: jid={jid}, text={text[:30]}...")

    try:
        settings = get_agent_settings(tenant_id)
        print(f"[AUTO-REPLY] Settings for {tenant_id}: {settings}")
        if not settings.get("auto_reply_enabled", False):
            print(f"[AUTO-REPLY] Auto-reply disabled for {tenant_id}")
            return
    except Exception as e:  # noqa: BLE001
        print(f"[AUTO-REPLY] Error reading settings: {e}")
        return

    if not msg_id or not jid or not text:
        print(f"[AUTO-REPLY] Missing required fields")
        return

    def _do_reply():
        try:
            from backend.app.services.router import smart_query_router

            result = smart_query_router(
                tenant_id=tenant_id,
                guest_id=jid,
                user_msg=text,
                background_tasks=None,
                llm_timeout=25,
            )

            response_text = str(result.get("response", "")).strip()
            if not response_text:
                print(f"Auto-reply: empty response for {msg_id}")
                return

            # Send the reply
            job_id = enqueue_outbound_message(tenant_id, jid, response_text)

            # Persist the sent message
            persist_messages(
                tenant_id,
                [{
                    "message_id": f"auto-{msg_id}",
                    "jid": jid,
                    "sender": "Axiom",
                    "text": response_text,
                    "timestamp": int(time.time()),
                    "from_me": True,
                }],
            )
            persist_chats(
                tenant_id,
                [{
                    "jid": jid,
                    "name": jid,
                    "last_message": response_text,
                    "timestamp": int(time.time()),
                }],
            )

            # Log that we replied to prevent duplicates
            log_auto_reply(tenant_id, jid, msg_id, response_text)

            print(f"Auto-reply sent: {msg_id} -> {jid}")

        except TimeoutError:
            print(f"Auto-reply timeout for {msg_id}")
        except Exception as exc:  # noqa: BLE001
            print(f"Auto-reply error: {exc}")

    threading.Thread(target=_do_reply, daemon=True).start()


def enqueue_outbound_message(tenant_id: str, jid: str, text: str) -> str:
    outbox_path = bridge_outbox_path(tenant_id)
    payload = read_json_file(outbox_path, {"messages": []})
    messages = payload.get("messages", [])
    if not isinstance(messages, list):
        messages = []
    job_id = f"out-{int(time.time() * 1000)}-{len(messages)}"
    messages.append(
        {
            "job_id": job_id,
            "jid": jid,
            "text": text,
            "created_at": int(time.time()),
        }
    )
    outbox_path.write_text(json.dumps({"messages": messages}, ensure_ascii=True), encoding="utf-8")
    return job_id


@app.get("/whatsapp/qr")
async def whatsapp_qr(
    request: Request,
    tenant_id: str = Query(..., min_length=2, max_length=64),
) -> dict[str, Any]:
    user = get_current_user(request)
    safe_tenant = validate_tenant_id(tenant_id)
    if safe_tenant != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied to this tenant")
    ensure_bridge_running(safe_tenant)

    payload: dict[str, Any] = {}
    status_file = bridge_status_path(safe_tenant)
    # Give daemon a short window to generate a fresh QR/status file.
    for _ in range(12):
        payload = read_json_file(status_file, {})
        if payload.get("linked") is True or payload.get("qr_base64"):
            break
        await asyncio.sleep(0.5)

    status = str(payload.get("status", "pending"))
    if "restart required" in status.lower() or "stream errored" in status.lower():
        restart_bridge(safe_tenant)
        payload = read_json_file(status_file, {})
        status = str(payload.get("status", "pending"))

    if (not payload.get("linked")) and not payload.get("qr_base64") and (
        "connection failure" in status.lower() or "timed out" in status.lower()
    ):
        reset_bridge_session(safe_tenant)
        restart_bridge(safe_tenant)
        for _ in range(10):
            payload = read_json_file(status_file, {})
            if payload.get("qr_base64"):
                break
            await asyncio.sleep(0.5)
        status = str(payload.get("status", "pending"))

    return {
        "tenant_id": safe_tenant,
        "linked": payload.get("linked", False),
        "qr_base64": payload.get("qr_base64"),
        "status": status,
    }


@app.get("/whatsapp/chats")
async def whatsapp_chats(
    request: Request,
    tenant_id: str = Query(..., min_length=2, max_length=64),
) -> dict[str, Any]:
    user = get_current_user(request)
    safe_tenant = validate_tenant_id(tenant_id)
    if safe_tenant != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied to this tenant")
    ensure_bridge_running(safe_tenant)

    payload = sync_tenant_data(safe_tenant)
    linked = bool(payload.get("linked", False))
    saved = get_saved_chats(safe_tenant)

    return {
        "tenant_id": safe_tenant,
        "linked": linked,
        "status": payload.get("status", "pending"),
        "count": len(saved),
        "chats": saved,
    }


@app.get("/whatsapp/messages")
async def whatsapp_messages(
    request: Request,
    tenant_id: str = Query(..., min_length=2, max_length=64),
    jid: str | None = Query(default=None),
) -> dict[str, Any]:
    user = get_current_user(request)
    safe_tenant = validate_tenant_id(tenant_id)
    if safe_tenant != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied to this tenant")
    ensure_bridge_running(safe_tenant)
    payload = sync_tenant_data(safe_tenant)
    messages = get_saved_messages(safe_tenant, jid=jid)
    return {
        "tenant_id": safe_tenant,
        "linked": bool(payload.get("linked", False)),
        "status": payload.get("status", "pending"),
        "count": len(messages),
        "messages": messages,
    }


@app.get("/whatsapp/stream")
async def whatsapp_stream(
    request: Request,
    tenant_id: str = Query(..., min_length=2, max_length=64),
    jid: str | None = Query(default=None),
) -> StreamingResponse:
    user = get_current_user(request)
    safe_tenant = validate_tenant_id(tenant_id)
    if safe_tenant != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied to this tenant")
    ensure_bridge_running(safe_tenant)

    async def event_generator():
        previous_payload = ""
        while True:
            if await request.is_disconnected():
                break
            payload = sync_tenant_data(safe_tenant)
            data = {
                "tenant_id": safe_tenant,
                "linked": bool(payload.get("linked", False)),
                "status": payload.get("status", "pending"),
                "qr_base64": payload.get("qr_base64"),
                "chats": get_saved_chats(safe_tenant),
                "messages": get_saved_messages(safe_tenant, jid=jid) if jid else [],
            }
            serialized = json.dumps(data, separators=(",", ":"))
            if serialized != previous_payload:
                previous_payload = serialized
                yield f"data: {serialized}\n\n"
            await asyncio.sleep(2)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/whatsapp/restart")
async def whatsapp_restart(
    request: Request,
    tenant_id: str = Query(..., min_length=2, max_length=64),
    reset_session: bool = Query(False),
) -> dict[str, Any]:
    user = get_current_user(request)
    safe_tenant = validate_tenant_id(tenant_id)
    if safe_tenant != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied to this tenant")
    if reset_session:
        reset_bridge_session(safe_tenant)
    restart_bridge(safe_tenant)
    return {"tenant_id": safe_tenant, "restarted": True, "reset_session": reset_session}


@app.post("/whatsapp/send")
async def whatsapp_send(
    request: Request,
    payload: SendMessageRequest,
) -> dict[str, Any]:
    user = get_current_user(request)
    safe_tenant = validate_tenant_id(payload.tenant_id)
    if safe_tenant != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied to this tenant")
    ensure_bridge_running(safe_tenant)
    current = sync_tenant_data(safe_tenant)
    if not bool(current.get("linked", False)):
        raise HTTPException(status_code=409, detail="WhatsApp is not linked for this tenant")

    job_id = enqueue_outbound_message(safe_tenant, payload.jid, payload.text)
    persist_messages(
        safe_tenant,
        [
            {
                "message_id": f"queued-{job_id}",
                "jid": payload.jid,
                "sender": "You",
                "text": payload.text,
                "timestamp": int(time.time()),
                "from_me": True,
            }
        ],
    )
    persist_chats(
        safe_tenant,
        [
            {
                "jid": payload.jid,
                "name": payload.jid,
                "last_message": payload.text,
                "timestamp": int(time.time()),
            }
        ],
    )
    return {"ok": True, "queued": True, "job_id": job_id, "tenant_id": safe_tenant, "jid": payload.jid}


class SuggestReplyRequest(BaseModel):
    tenant_id: str = Field(min_length=2, max_length=64)
    jid: str = Field(min_length=3, max_length=256)


@app.post("/whatsapp/suggest-reply")
async def whatsapp_suggest_reply(
    request: Request,
    payload: SuggestReplyRequest,
) -> dict[str, Any]:
    """Get AI-suggested reply based on conversation context using RAG."""
    user = get_current_user(request)
    safe_tenant = validate_tenant_id(payload.tenant_id)
    if safe_tenant != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied to this tenant")

    messages = get_saved_messages(safe_tenant, jid=payload.jid)
    if not messages:
        raise HTTPException(status_code=400, detail="No messages in conversation")

    # Build conversation context from recent messages
    recent_msgs = messages[-10:] if len(messages) > 10 else messages
    conversation_context = "\n".join([
        f"{'Guest' if not msg.get('from_me') else 'You'}: {msg.get('text', '')}"
        for msg in recent_msgs
        if msg.get('text')
    ])

    # Get the guest's last message for RAG query
    guest_messages = [msg for msg in recent_msgs if not msg.get('from_me')]
    if not guest_messages:
        raise HTTPException(status_code=400, detail="No guest message to respond to")

    last_guest_msg = guest_messages[-1].get('text', '')

    # Use smart_query_router to get RAG-based response
    from backend.app.services.router import smart_query_router
    result = smart_query_router(
        tenant_id=safe_tenant,
        guest_id=payload.jid,
        user_msg=last_guest_msg,
        background_tasks=None,
        llm_timeout=30,
    )

    suggested_reply = str(result.get("response", "")).strip()

    return {
        "suggested_reply": suggested_reply,
        "source": result.get("context_source", "unknown"),
        "confidence": result.get("rag_score", 0.0),
        "route": result.get("route", "unknown"),
    }


app.include_router(knowledge_engine_router)
app.include_router(dispatcher_router)
app.include_router(sse_streamer_router)
app.include_router(settings_router)
app.include_router(health_router)
app.include_router(migrations_router)
app.include_router(proactive_router)
app.include_router(booking_router)
app.include_router(journey_router)

