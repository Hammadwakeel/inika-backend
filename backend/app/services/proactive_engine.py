from __future__ import annotations

import asyncio
import sqlite3
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from backend.app.core.tenant import TENANTS_ROOT, validate_tenant_id
from backend.app.services.auth_service import get_tenant_conn
from backend.app.services.llm_service import chat_completion


MESSAGE_TEMPLATES = {
    "welcome": {
        "trigger": "checkin",
        "delay_minutes": 5,
        "template": "Welcome to {hotel_name}! We're delighted to have you with us. I'm Axiom, your AI concierge. How may I assist you today?",
    },
    "breakfast": {
        "trigger": "schedule",
        "delay_minutes": 0,
        "cron_hour": 8,
        "template": "Good morning! Breakfast is served at our restaurant from 7:00 AM to 10:30 AM. Would you like to make a reservation?",
    },
    "lunch": {
        "trigger": "schedule",
        "delay_minutes": 0,
        "cron_hour": 12,
        "template": "It's lunchtime! Our restaurant is open for lunch from 11:30 AM to 3:00 PM. Shall I reserve a table for you?",
    },
    "dinner": {
        "trigger": "schedule",
        "delay_minutes": 0,
        "cron_hour": 19,
        "template": "Good evening! Dinner service begins at 6:00 PM. Would you like to join us this evening?",
    },
    "checkout_reminder": {
        "trigger": "checkout",
        "delay_minutes": 60,
        "template": "Just a friendly reminder that checkout is at {checkout_time}. If you need a late checkout, please let me know and I'll arrange it with the front desk.",
    },
    "housekeeping": {
        "trigger": "schedule",
        "delay_minutes": 0,
        "cron_hour": 10,
        "template": "Good morning! If you need any housekeeping services during your stay, just let me know - we're here to make your stay comfortable.",
    },
    "amenities": {
        "trigger": "stay_milestone",
        "delay_minutes": 0,
        "hours_after_checkin": 24,
        "template": "How is your stay so far? If you'd like to explore our amenities - spa, pool, gym, or restaurant - I'm happy to help you book or arrange anything.",
    },
}


def get_active_guests(tenant_id: str) -> list[dict[str, Any]]:
    with get_tenant_conn(tenant_id) as conn:
        rows = conn.execute(
            """
            SELECT DISTINCT guest_id, session_id, session_summary, updated_at
            FROM sessions
            WHERE updated_at > ?
            ORDER BY updated_at DESC
            """,
            (int(time.time()) - 86400,),
        ).fetchall()
        return [dict(row) for row in rows]


def get_sent_messages(tenant_id: str, message_type: str, since_timestamp: int) -> list[str]:
    with get_tenant_conn(tenant_id) as conn:
        rows = conn.execute(
            """
            SELECT guest_id FROM proactive_messages
            WHERE tenant_id = ? AND message_type = ? AND created_at > ?
            """,
            (tenant_id, message_type, since_timestamp),
        ).fetchall()
        return [row["guest_id"] for row in rows]


def log_proactive_message(tenant_id: str, guest_id: str, message_type: str, message_text: str) -> None:
    with get_tenant_conn(tenant_id) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS proactive_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id TEXT NOT NULL,
                guest_id TEXT NOT NULL,
                message_type TEXT NOT NULL,
                message_text TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                delivered INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        conn.execute(
            """
            INSERT INTO proactive_messages (tenant_id, guest_id, message_type, message_text, created_at, delivered)
            VALUES (?, ?, ?, ?, ?, 0)
            """,
            (tenant_id, guest_id, message_type, message_text, int(time.time())),
        )
        conn.commit()


def get_guest_context(tenant_id: str, guest_id: str) -> dict[str, Any]:
    with get_tenant_conn(tenant_id) as conn:
        row = conn.execute(
            """
            SELECT session_summary, updated_at
            FROM sessions
            WHERE guest_id = ?
            ORDER BY updated_at DESC
            LIMIT 1
            """,
            (guest_id,),
        ).fetchone()

        if not row:
            return {"summary": "", "last_activity": 0}

        return {
            "summary": row["session_summary"] or "",
            "last_activity": row["updated_at"],
        }


def should_send_message(tenant_id: str, guest_id: str, message_type: str, template: dict) -> bool:
    trigger = template.get("trigger", "")

    if trigger == "schedule":
        return True

    if trigger == "checkin":
        context = get_guest_context(tenant_id, guest_id)
        first_message = context.get("first_message_time", 0)
        if first_message == 0:
            return True
        delay_seconds = template.get("delay_minutes", 5) * 60
        return (time.time() - first_message) >= delay_seconds

    if trigger == "stay_milestone":
        context = get_guest_context(tenant_id, guest_id)
        checkin_time = context.get("checkin_time", 0)
        if checkin_time == 0:
            return True
        hours_required = template.get("hours_after_checkin", 24)
        return (time.time() - checkin_time) >= (hours_required * 3600)

    return True


def get_hotel_name(tenant_id: str) -> str:
    with get_tenant_conn(tenant_id) as conn:
        row = conn.execute(
            "SELECT value FROM tenant_settings WHERE key = 'hotel_name'"
        ).fetchone()
        return row["value"] if row else "our hotel"


def personalize_message(template: str, tenant_id: str, guest_id: str) -> str:
    hotel_name = get_hotel_name(tenant_id)
    context = get_guest_context(tenant_id, guest_id)

    personalized = template.replace("{hotel_name}", hotel_name)
    personalized = personalized.replace("{guest_name}", context.get("guest_name", "dear guest"))
    personalized = personalized.replace("{checkout_time}", context.get("checkout_time", "12:00 PM"))

    return personalized


def generate_proactive_messages(tenant_id: str) -> list[dict[str, Any]]:
    guests = get_active_guests(tenant_id)
    messages_to_send = []

    current_hour = datetime.now().hour

    for template_key, template in MESSAGE_TEMPLATES.items():
        trigger = template.get("trigger", "")

        if trigger == "schedule":
            target_hour = template.get("cron_hour", 12)
            if current_hour != target_hour:
                continue

        for guest in guests:
            guest_id = guest["guest_id"]
            if not should_send_message(tenant_id, guest_id, template_key, template):
                continue

            personalized = personalize_message(template["template"], tenant_id, guest_id)
            messages_to_send.append({
                "tenant_id": tenant_id,
                "guest_id": guest_id,
                "message_type": template_key,
                "message_text": personalized,
            })

    return messages_to_send


def enqueue_proactive_message(tenant_id: str, jid: str, text: str) -> str:
    from pathlib import Path

    tenant_dir = TENANTS_ROOT / validate_tenant_id(tenant_id)
    tenant_dir.mkdir(parents=True, exist_ok=True)
    outbox_path = tenant_dir / "wa-outbox.json"

    import json
    payload = {"messages": []}
    if outbox_path.exists():
        try:
            payload = json.loads(outbox_path.read_text())
        except Exception:
            pass

    messages = payload.get("messages", [])
    job_id = f"proactive-{int(time.time() * 1000)}-{len(messages)}"
    messages.append({
        "job_id": job_id,
        "jid": jid,
        "text": text,
        "created_at": int(time.time()),
        "proactive": True,
    })

    outbox_path.write_text(json.dumps(payload, ensure_ascii=True))
    return job_id


async def run_proactive_engine(tenant_id: str) -> dict[str, Any]:
    try:
        messages = generate_proactive_messages(tenant_id)

        sent = []
        failed = []

        for msg in messages:
            try:
                job_id = enqueue_proactive_message(
                    msg["tenant_id"],
                    msg["guest_id"],
                    msg["message_text"],
                )
                log_proactive_message(
                    msg["tenant_id"],
                    msg["guest_id"],
                    msg["message_type"],
                    msg["message_text"],
                )
                sent.append({
                    "guest_id": msg["guest_id"],
                    "type": msg["message_type"],
                    "job_id": job_id,
                })
            except Exception as e:
                failed.append({
                    "guest_id": msg["guest_id"],
                    "type": msg["message_type"],
                    "error": str(e),
                })

        return {
            "status": "ok",
            "tenant_id": tenant_id,
            "generated": len(messages),
            "sent": len(sent),
            "failed": len(failed),
            "details": {"sent": sent, "failed": failed},
        }
    except Exception as e:
        return {
            "status": "error",
            "tenant_id": tenant_id,
            "error": str(e),
        }


class ProactiveEngine:
    def __init__(self, check_interval_seconds: int = 3600):
        self.check_interval = check_interval_seconds
        self._running = False
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _run(self) -> None:
        while self._running:
            try:
                tenant_dirs = TENANTS_ROOT.iterdir()
                for tenant_path in tenant_dirs:
                    if not tenant_path.is_dir():
                        continue
                    tenant_id = tenant_path.name
                    try:
                        await run_proactive_engine(tenant_id)
                    except Exception:
                        pass
            except Exception:
                pass

            await asyncio.sleep(self.check_interval)
