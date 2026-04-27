from __future__ import annotations

"""
Journey scheduler — the main orchestrator.
Runs every 15 minutes, evaluates guest touchpoints, and dispatches personalized messages.
"""

import asyncio
import json
import logging
import time
from datetime import datetime
from typing import Any

from backend.app.core.tenant import TENANTS_ROOT, validate_tenant_id
from backend.app.services.auth_service import get_tenant_conn
from backend.app.services.booking_client import get_active_guests, sync_guests_to_db, fetch_todays_bookings
from backend.app.services.journey_personalization import select_evening_activity
from backend.app.services.journey_state import JourneyState
from backend.app.services.journey_timing import compute_touchpoints, get_active_checkin_touchpoint, is_in_window, is_quiet_hours, now_ist, ist_date_str
from backend.app.services.journey_weather import get_weather
from backend.app.services.journey_llm_generator import generate_journey_message

logger = logging.getLogger(__name__)

# Limits
MAX_MESSAGES_PER_STAY = 12
MAX_MESSAGES_PER_DAY = 4
RECENT_REPLY_WINDOW_MS = 2 * 60 * 60 * 1000  # 2 hours


def get_mobile_to_jid(mobile: str) -> str:
    """Convert mobile number to WhatsApp JID."""
    if not mobile:
        return ""
    digits = "".join(c for c in mobile if c.isdigit())
    if digits.startswith("0"):
        digits = "92" + digits[1:]
    if not digits.startswith("91") and not digits.startswith("92"):
        if len(digits) == 10:
            digits = "91" + digits
    if digits:
        return f"{digits}@s.whatsapp.net"
    return ""


def enqueue_whatsapp_message(tenant_id: str, jid: str, text: str) -> str:
    """Add message to WhatsApp outbox."""
    safe_tenant = validate_tenant_id(tenant_id)
    tenant_dir = TENANTS_ROOT / safe_tenant
    tenant_dir.mkdir(parents=True, exist_ok=True)
    outbox_path = tenant_dir / "wa-outbox.json"

    payload = {"messages": []}
    if outbox_path.exists():
        try:
            payload = json.loads(outbox_path.read_text(encoding="utf-8"))
        except Exception:
            pass

    messages = payload.get("messages", [])
    job_id = f"journey-{int(time.time() * 1000)}-{len(messages)}"
    messages.append({
        "job_id": job_id,
        "jid": jid,
        "text": text,
        "created_at": int(time.time()),
        "proactive": True,
        "journey": True,
    })
    payload["messages"] = messages
    outbox_path.write_text(json.dumps(payload, ensure_ascii=True), encoding="utf-8")
    return job_id


def sync_bookings_to_db(tenant_id: str) -> int:
    """Sync today's bookings from the external API to the guest_inventory table."""
    result = fetch_todays_bookings()
    if result.get("status") != "ok":
        return 0

    raw_data = result.get("data", {})
    if isinstance(raw_data, dict):
        guests = raw_data.get("data", [])
    else:
        guests = raw_data if isinstance(raw_data, list) else []

    return sync_guests_to_db(tenant_id, guests)


async def run_journey_for_tenant(tenant_id: str, dry_run: bool = False) -> dict[str, Any]:
    """Run the journey scheduler for a single tenant."""
    result = {
        "tenant_id": tenant_id,
        "sent": 0,
        "skipped": 0,
        "errors": 0,
        "reasons": {},
    }

    state = JourneyState(tenant_id)
    now = now_ist()
    today_ist = ist_date_str(now)
    current_utc_hour = datetime.utcnow().hour

    # Sync bookings from API
    synced = sync_bookings_to_db(tenant_id)
    if synced > 0:
        logger.info(f"[journey] Synced {synced} guests for tenant {tenant_id}")

    # Fetch active guests
    guests = get_active_guests(tenant_id)
    if not guests:
        return result

    # Fetch weather once (shared across all guests)
    weather_data = get_weather()

    for guest in guests:
        guest_id = guest.get("id", "")
        mobile = guest.get("mobile", "")
        phone = "".join(c for c in mobile if c.isdigit()) if mobile else ""
        jid = get_mobile_to_jid(mobile)

        if not guest_id or not phone:
            result["skipped"] += 1
            result["reasons"]["missing_phone"] = result["reasons"].get("missing_phone", 0) + 1
            continue

        # Map guest fields to booking schema
        booking = {
            "id": guest_id,
            "check_in": guest.get("cindate", ""),
            "check_out": guest.get("coutdate", ""),
            "guest_name": guest.get("gname", ""),
            "mobile": mobile,
            "room": guest.get("room", ""),
            "booking_source": guest.get("btype", ""),
            "guest_count": int(guest.get("gcount", "1") or "1"),
            "special_requests": guest.get("requests", ""),
            "special_occasion": guest.get("occasion", ""),
            "is_repeat": guest.get("repeat", False),
        }

        # Validate dates
        if not booking["check_in"] or not booking["check_out"]:
            result["skipped"] += 1
            continue

        # Opt-out check
        if state.is_opted_out(phone, guest_id):
            result["skipped"] += 1
            result["reasons"]["opted-out"] = result["reasons"].get("opted-out", 0) + 1
            continue

        # Recent reply check
        if state.has_recent_reply(phone, RECENT_REPLY_WINDOW_MS):
            result["skipped"] += 1
            result["reasons"]["recent-reply"] = result["reasons"].get("recent-reply", 0) + 1
            continue

        # Stay-level limit
        if state.stay_send_count(guest_id) >= MAX_MESSAGES_PER_STAY:
            result["skipped"] += 1
            result["reasons"]["stay-limit"] = result["reasons"].get("stay-limit", 0) + 1
            continue

        # Daily global limit
        if state.today_global_send_count() >= MAX_MESSAGES_PER_DAY:
            result["skipped"] += 1
            result["reasons"]["daily-limit"] = result["reasons"].get("daily-limit", 0) + 1
            continue

        # Compute all possible touchpoints
        all_touchpoints = compute_touchpoints(booking)

        # Determine which day type we're on
        is_checkin_day = booking["check_in"] == today_ist
        is_checkout_day = booking["check_out"] == today_ist
        is_post_stay_day = booking["check_out"] < today_ist and is_tomorrow_checkout(booking["check_out"], today_ist)
        is_during_stay = booking["check_in"] <= today_ist <= booking["check_out"]

        # Filter to today's touchpoints
        todays_touchpoints = [tp for tp in all_touchpoints if tp["date"] == today_ist]

        # For check-in day, only evaluate ONE checkin template
        if is_checkin_day:
            active_checkin = get_active_checkin_touchpoint(all_touchpoints, datetime.utcnow())
            if active_checkin:
                todays_touchpoints = [
                    tp for tp in todays_touchpoints
                    if tp["type"] == active_checkin["type"] or not tp["type"].startswith("checkin-")
                ]

        for tp in todays_touchpoints:
            tp_type = tp["type"]

            # Already sent?
            if state.was_sent(guest_id, tp_type):
                result["skipped"] += 1
                result["reasons"]["already-sent"] = result["reasons"].get("already-sent", 0) + 1
                continue

            # Within time window?
            if not is_in_window(current_utc_hour, tp_type, tp["time"]):
                result["skipped"] += 1
                result["reasons"]["outside-window"] = result["reasons"].get("outside-window", 0) + 1
                continue

            # Quiet hours for non-checkin
            if is_quiet_hours() and not tp_type.startswith("checkin-"):
                result["skipped"] += 1
                result["reasons"]["quiet-hours"] = result["reasons"].get("quiet-hours", 0) + 1
                continue

            # Day-type guards
            if tp_type == "post-stay" and not is_post_stay_day:
                result["skipped"] += 1
                result["reasons"]["not-post-stay-day"] = result["reasons"].get("not-post-stay-day", 0) + 1
                continue
            if tp_type == "checkout-morning" and not is_checkout_day:
                result["skipped"] += 1
                result["reasons"]["not-checkout-day"] = result["reasons"].get("not-checkout-day", 0) + 1
                continue
            if tp_type in ("daily-morning", "daily-lunch", "daily-evening") and not is_during_stay:
                result["skipped"] += 1
                result["reasons"]["not-during-stay"] = result["reasons"].get("not-during-stay", 0) + 1
                continue

            # Build extras
            extras = {"weather": weather_data}

            if tp_type == "daily-evening":
                last_evening = state.get_last_evening_activity(guest_id)
                extras["evening_activity"] = select_evening_activity(guest_id, last_evening)
                extras["current_day"] = day_number(booking["check_in"], today_ist) + 1

            if tp_type in ("checkout-morning",):
                extras["current_day"] = day_number(booking["check_in"], today_ist)

            if tp_type in ("daily-morning", "daily-lunch"):
                extras["current_day"] = day_number(booking["check_in"], today_ist) + 1

            # Generate message using LLM
            try:
                body = generate_journey_message(booking, tp_type, extras)
                if not body:
                    logger.warning(f"[journey] LLM returned empty for {guest_id}/{tp_type}")
                    result["errors"] += 1
                    continue
            except Exception as e:
                logger.error(f"[journey] LLM generation failed for {guest_id}/{tp_type}: {e}")
                result["errors"] += 1
                continue

            # Send or dry-run
            if dry_run:
                logger.info(f"[journey] [DRY RUN] Would send to {booking['guest_name']} ({phone}): {body[:80]}...")
                result["sent"] += 1
            else:
                try:
                    job_id = enqueue_whatsapp_message(tenant_id, jid, body)
                    state.mark_sent(guest_id, tp_type)

                    # Track evening activity rotation
                    if tp_type == "daily-evening" and extras.get("evening_activity"):
                        state.set_evening_activity(guest_id, extras["evening_activity"]["type"])

                    # Log to database
                    log_message(tenant_id, guest_id, jid, tp_type, body, job_id)
                    result["sent"] += 1

                except Exception as e:
                    logger.error(f"[journey] Send failed for {guest_id}/{tp_type}: {e}")
                    result["errors"] += 1

            await asyncio.sleep(0.3)

    return result


def is_tomorrow_checkout(checkout: str, today: str) -> bool:
    """Check if today is the day after checkout."""
    from backend.app.services.journey_timing import add_days, parse_ist_date
    next_day = add_days(checkout, 1)
    return next_day == today


def day_number(check_in: str, today: str) -> int:
    """Compute which day of stay today is (0-indexed from check-in)."""
    from backend.app.services.journey_timing import parse_ist_date, ist_date_str
    a = parse_ist_date(check_in)
    b = parse_ist_date(today)
    days = (b - a).days if b >= a else 0
    return max(0, days)


def log_message(tenant_id: str, guest_id: str, jid: str, message_type: str, text: str, job_id: str) -> None:
    """Log sent message to database."""
    try:
        with get_tenant_conn(tenant_id) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS journey_messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    guest_id TEXT NOT NULL,
                    jid TEXT,
                    message_type TEXT NOT NULL,
                    message_text TEXT NOT NULL,
                    job_id TEXT,
                    created_at INTEGER NOT NULL,
                    delivered INTEGER DEFAULT 0
                )
            """)
            conn.execute(
                "INSERT INTO journey_messages (guest_id, jid, message_type, message_text, job_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (guest_id, jid, message_type, text, job_id, int(time.time())),
            )
            conn.commit()
    except Exception:
        pass


async def run_all_tenants(dry_run: bool = False) -> dict[str, Any]:
    """Run journey scheduler for all tenants."""
    results = []
    try:
        for tenant_path in TENANTS_ROOT.iterdir():
            if not tenant_path.is_dir():
                continue
            tenant_id = tenant_path.name
            if tenant_id.startswith("."):
                continue
            try:
                result = await run_journey_for_tenant(tenant_id, dry_run=dry_run)
                results.append(result)
            except Exception as e:
                logger.error(f"[journey] Error processing tenant {tenant_id}: {e}")

        total_sent = sum(r["sent"] for r in results)
        total_skipped = sum(r["skipped"] for r in results)
        total_errors = sum(r["errors"] for r in results)

        logger.info(f"[journey] Completed: sent={total_sent}, skipped={total_skipped}, errors={total_errors}")

        return {
            "status": "ok",
            "tenants_processed": len(results),
            "total_sent": total_sent,
            "total_skipped": total_skipped,
            "total_errors": total_errors,
            "results": results,
        }

    except Exception as e:
        logger.error(f"[journey] Fatal error in run_all_tenants: {e}")
        return {"status": "error", "error": str(e)}


class JourneyScheduler:
    """Background journey scheduler that runs every 15 minutes."""

    def __init__(self, check_interval_seconds: int = 900):
        self.check_interval = check_interval_seconds
        self._running = False
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        logger.info("[journey] Journey scheduler starting...")
        self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("[journey] Journey scheduler stopped.")

    async def _run(self) -> None:
        while self._running:
            try:
                await run_all_tenants()
            except Exception as e:
                logger.error(f"[journey] Scheduler error: {e}")

            await asyncio.sleep(self.check_interval)