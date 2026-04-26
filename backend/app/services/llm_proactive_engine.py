from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from backend.app.core.tenant import TENANTS_ROOT, validate_tenant_id
from backend.app.services.auth_service import get_tenant_conn
from backend.app.services.booking_client import get_active_guests, get_guest_by_mobile, get_guest_journey_status
from backend.app.services.llm_service import chat_completion
from backend.app.services.memory_manager import get_session_summary
from backend.app.services.search_tool import is_live_information_query, rag_search, web_search
from backend.knowledge_engine import get_identity_prompts


PROACTIVE_SYSTEM_PROMPT = """You are Axiom, an AI concierge for a hotel. Your role is to:
1. Personalize messages based on guest journey context
2. Provide helpful, warm, and professional communication
3. Answer questions about the hotel using the provided context
4. Suggest relevant services and amenities based on timing
5. Be proactive but not intrusive

Keep messages concise (under 100 words) and actionable."""


def build_guest_context_for_llm(tenant_id: str, guest: dict[str, Any]) -> str:
    journey = get_guest_journey_status(tenant_id, guest.get("id", ""))

    checkin = guest.get("cindate", "N/A")
    checkout = guest.get("coutdate", "N/A")
    room = guest.get("room", "N/A")
    guest_name = guest.get("gname", "Guest")
    status = guest.get("gstatus", "Unknown")
    guests_count = guest.get("gcount", "1")

    today = datetime.now().strftime("%Y-%m-%d")

    checkin_date = None
    try:
        checkin_date = datetime.strptime(checkin, "%Y-%m-%d")
    except Exception:
        pass

    checkout_date = None
    try:
        checkout_date = datetime.strptime(checkout, "%Y-%m-%d")
    except Exception:
        pass

    stay_nights = 0
    if checkin_date and checkout_date:
        stay_nights = (checkout_date - checkin_date).days

    days_stayed = 0
    if checkin_date:
        days_stayed = (datetime.now() - checkin_date).days

    journey_stage = "pre_arrival"
    if status in ("Arrived", "StayOver"):
        journey_stage = "during_stay"
        if checkout_date and datetime.now() >= checkout_date - timedelta(days=1):
            journey_stage = "checkout_reminder"

    return f"""
Guest Profile:
- Name: {guest_name}
- Room: {room}
- Check-in: {checkin}
- Check-out: {checkout}
- Status: {status}
- Guests: {guests_count}
- Nights: {stay_nights}
- Days stayed: {days_stayed}
- Journey stage: {journey_stage}
- Today: {today}
"""


def get_or_create_guest_session(tenant_id: str, guest_id: str, mobile: str) -> str:
    session_key = f"guest_{guest_id}"
    with get_tenant_conn(tenant_id) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS guest_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guest_id TEXT NOT NULL,
                mobile TEXT NOT NULL,
                session_id TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
            """
        )
        row = conn.execute(
            "SELECT session_id FROM guest_sessions WHERE guest_id = ? ORDER BY updated_at DESC LIMIT 1",
            (guest_id,),
        ).fetchone()

        if row:
            now = int(time.time())
            conn.execute(
                "UPDATE guest_sessions SET updated_at = ? WHERE session_id = ?",
                (now, row["session_id"]),
            )
            conn.commit()
            return row["session_id"]

        import uuid
        now = int(time.time())
        session_id = f"gsess-{uuid.uuid4().hex[:16]}"
        conn.execute(
            "INSERT INTO guest_sessions (guest_id, mobile, session_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (guest_id, mobile, session_id, now, now),
        )
        conn.commit()
        return session_id


def generate_llm_message(
    tenant_id: str,
    guest: dict[str, Any],
    trigger_type: str,
    trigger_reason: str,
) -> str | None:
    guest_context = build_guest_context_for_llm(tenant_id, guest)
    identity = get_identity_prompts(tenant_id)

    try:
        rag_results, rag_score = rag_search(tenant_id, f"hotel amenities services {trigger_type}", top_k=3)
    except Exception:
        rag_results = []
        rag_score = 0.0

    context_block = "\n\n".join([
        f"[{r.get('source', 'knowledge')}]: {r.get('text', '')}"
        for r in rag_results
    ]) if rag_results else "No specific hotel context available."

    system_prompt = f"""You are Axiom, the hotel AI concierge.

{identity.get('base_identity', PROACTIVE_SYSTEM_PROMPT)}

{identity.get('behavioral_rules', '')}

Guest Context:
{guest_context}

Hotel Knowledge:
{context_block}

Generate a single proactive message for this guest. The message should:
1. Be warm and personalized (use guest name naturally)
2. Reference their stay context (check-in date, room, current time)
3. Be relevant to their journey stage
4. Offer helpful assistance or information

Trigger: {trigger_reason}

Respond with ONLY the message text (no explanations, no quotes)."""

    try:
        response = chat_completion(
            system_prompt=system_prompt,
            user_prompt=f"Generate a proactive message for a guest at stage: {trigger_type}. Keep it under 80 words, warm and helpful.",
        )
        return response.strip() if response else None
    except Exception:
        return None


def decide_proactive_triggers(tenant_id: str, guest: dict[str, Any]) -> list[dict[str, Any]]:
    triggers = []

    checkin = guest.get("cindate", "")
    checkout = guest.get("coutdate", "")
    status = guest.get("gstatus", "")
    room = guest.get("room", "")

    today = datetime.now().strftime("%Y-%m-%d")
    current_hour = datetime.now().hour

    if status == "StayOver" or status == "Arrived":
        triggers.append({
            "type": "stay_check",
            "reason": f"Guest {guest.get('gname', '')} is staying at {room}",
            "priority": 1,
        })

        if current_hour == 8 and 7 <= current_hour <= 9:
            triggers.append({
                "type": "breakfast_reminder",
                "reason": "Morning breakfast hours",
                "priority": 2,
            })
        elif current_hour == 12 and 11 <= current_hour <= 13:
            triggers.append({
                "type": "lunch_reminder",
                "reason": "Lunch time",
                "priority": 2,
            })
        elif current_hour == 19 and 18 <= current_hour <= 20:
            triggers.append({
                "type": "dinner_reminder",
                "reason": "Dinner time",
                "priority": 2,
            })

        if checkout:
            try:
                checkout_date = datetime.strptime(checkout, "%Y-%m-%d")
                days_until_checkout = (checkout_date - datetime.now()).days
                if days_until_checkout == 1:
                    triggers.append({
                        "type": "checkout_reminder",
                        "reason": f"Checkout tomorrow ({checkout})",
                        "priority": 3,
                    })
                elif days_until_checkout == 0:
                    triggers.append({
                        "type": "checkout_today",
                        "reason": f"Checkout today ({checkout})",
                        "priority": 3,
                    })
            except Exception:
                pass

    return sorted(triggers, key=lambda x: x["priority"])


def enqueue_outbound_message(tenant_id: str, jid: str, text: str, proactive: bool = True) -> str:
    tenant_dir = TENANTS_ROOT / validate_tenant_id(tenant_id)
    tenant_dir.mkdir(parents=True, exist_ok=True)
    outbox_path = tenant_dir / "wa-outbox.json"

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
        "proactive": proactive,
    })

    outbox_path.write_text(json.dumps(payload, ensure_ascii=True))
    return job_id


async def run_llm_proactive_for_guest(
    tenant_id: str,
    guest: dict[str, Any],
    jid: str,
) -> dict[str, Any]:
    result = {
        "guest_id": guest.get("id", ""),
        "guest_name": guest.get("gname", ""),
        "room": guest.get("room", ""),
        "triggered": 0,
        "sent": 0,
        "failed": 0,
        "messages": [],
    }

    triggers = decide_proactive_triggers(tenant_id, guest)

    for trigger in triggers:
        try:
            message = generate_llm_message(
                tenant_id,
                guest,
                trigger["type"],
                trigger["reason"],
            )

            if not message:
                result["failed"] += 1
                continue

            job_id = enqueue_outbound_message(tenant_id, jid, message, proactive=True)

            with get_tenant_conn(tenant_id) as conn:
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS proactive_messages (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        guest_id TEXT NOT NULL,
                        message_type TEXT NOT NULL,
                        message_text TEXT NOT NULL,
                        job_id TEXT,
                        created_at INTEGER NOT NULL
                    )
                    """
                )
                conn.execute(
                    "INSERT INTO proactive_messages (guest_id, message_type, message_text, job_id, created_at) VALUES (?, ?, ?, ?, ?)",
                    (guest.get("id", ""), trigger["type"], message, job_id, int(time.time())),
                )
                conn.commit()

            result["triggered"] += 1
            result["sent"] += 1
            result["messages"].append({
                "type": trigger["type"],
                "text": message[:100] + "..." if len(message) > 100 else message,
            })

        except Exception as e:
            result["failed"] += 1

        await asyncio.sleep(0.5)

    return result


async def run_llm_proactive_engine(tenant_id: str) -> dict[str, Any]:
    guests = get_active_guests(tenant_id)

    results = {
        "tenant_id": tenant_id,
        "total_guests": len(guests),
        "processed": 0,
        "total_sent": 0,
        "total_failed": 0,
        "guests_processed": [],
    }

    for guest in guests:
        mobile = guest.get("mobile", "")
        if not mobile:
            continue

        jid = f"{mobile}@s.whatsapp.net"

        try:
            guest_result = await run_llm_proactive_for_guest(tenant_id, guest, jid)
            results["processed"] += 1
            results["total_sent"] += guest_result["sent"]
            results["total_failed"] += guest_result["failed"]
            results["guests_processed"].append(guest_result)
        except Exception as e:
            pass

    return results


class LLMProactiveEngine:
    def __init__(self, check_interval_seconds: int = 1800):
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
                        await run_llm_proactive_engine(tenant_id)
                    except Exception:
                        pass
            except Exception:
                pass

            await asyncio.sleep(self.check_interval)
