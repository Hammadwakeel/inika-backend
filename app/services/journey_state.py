from __future__ import annotations

"""
State management for journey scheduler.
Manages per-tenant state.json with sent messages, opt-outs, recent replies, and evening rotation.
"""

import json
import threading
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, TypedDict

from backend.app.core.tenant import TENANTS_ROOT, validate_tenant_id


class OptOutEntry(TypedDict):
    stay_id: str
    reason: str
    until: str | None


class JourneyState:
    """Per-tenant journey state with thread-safe JSON file access."""

    def __init__(self, tenant_id: str):
        self.tenant_id = validate_tenant_id(tenant_id)
        self._lock = threading.Lock()
        self._ensure_dir()
        self._state_file = TENANTS_ROOT / self.tenant_id / "journey_state.json"

    def _ensure_dir(self) -> None:
        path = TENANTS_ROOT / self.tenant_id
        path.mkdir(parents=True, exist_ok=True)

    def _load(self) -> dict[str, Any]:
        try:
            if self._state_file.exists():
                return json.loads(self._state_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, IOError):
            pass
        return {"sent": {}, "opt_outs": {}, "recent_replies": {}, "evening_rotation": {}}

    def _save(self, state: dict[str, Any]) -> None:
        self._state_file.write_text(json.dumps(state, ensure_ascii=True, indent=2), encoding="utf-8")

    def with_lock(self, op: callable) -> Any:
        with self._lock:
            return op(self._load(), self._save)

    # --- Deduplication ---

    def was_sent(self, booking_id: str, touchpoint_type: str) -> bool:
        """Check if a touchpoint was already sent for this booking."""
        def op(state: dict, save: callable) -> bool:
            return bool(state.get("sent", {}).get(booking_id, {}).get(touchpoint_type))
        return self.with_lock(op)

    def mark_sent(self, booking_id: str, touchpoint_type: str) -> None:
        """Mark a touchpoint as sent."""
        def op(state: dict, save: callable) -> None:
            if "sent" not in state:
                state["sent"] = {}
            if booking_id not in state["sent"]:
                state["sent"][booking_id] = {}
            state["sent"][booking_id][touchpoint_type] = datetime.utcnow().isoformat()
            save(state)
        self.with_lock(op)

    def stay_send_count(self, booking_id: str) -> int:
        """Count messages sent for this booking."""
        def op(state: dict, save: callable) -> int:
            touchpoints = state.get("sent", {}).get(booking_id, {})
            return len(touchpoints)
        return self.with_lock(op)

    def today_global_send_count(self) -> int:
        """Count today's sends across all bookings."""
        def op(state: dict, save: callable) -> int:
            today = datetime.utcnow().strftime("%Y-%m-%d")
            count = 0
            for touchpoints in state.get("sent", {}).values():
                for ts in touchpoints.values():
                    if ts and ts.startswith(today):
                        count += 1
            return count
        return self.with_lock(op)

    def has_recent_reply(self, phone: str, window_ms: int = 7200000) -> bool:
        """Check if guest replied within the window (default 2 hours)."""
        def op(state: dict, save: callable) -> bool:
            last_reply = state.get("recent_replies", {}).get(phone)
            if not last_reply:
                return False
            elapsed = datetime.utcnow().timestamp() * 1000 - datetime.fromisoformat(last_reply).timestamp() * 1000
            return elapsed < window_ms
        return self.with_lock(op)

    def mark_guest_replied(self, phone: str) -> None:
        """Record that the guest replied."""
        def op(state: dict, save: callable) -> None:
            if "recent_replies" not in state:
                state["recent_replies"] = {}
            state["recent_replies"][phone] = datetime.utcnow().isoformat()
            save(state)
        self.with_lock(op)

    # --- Evening activity rotation ---

    def get_last_evening_activity(self, booking_id: str) -> str | None:
        """Get the last evening activity type sent to a booking."""
        def op(state: dict, save: callable) -> str | None:
            return state.get("evening_rotation", {}).get(booking_id)
        return self.with_lock(op)

    def set_evening_activity(self, booking_id: str, activity_type: str) -> None:
        """Record which evening activity type was sent."""
        def op(state: dict, save: callable) -> None:
            if "evening_rotation" not in state:
                state["evening_rotation"] = {}
            state["evening_rotation"][booking_id] = activity_type
            save(state)
        self.with_lock(op)

    # --- Opt-out management ---

    def is_opted_out(self, phone: str, stay_id: str) -> bool:
        """Check if guest has opted out for this stay."""
        def op(state: dict, save: callable) -> bool:
            entry = state.get("opt_outs", {}).get(phone)
            if not entry:
                return False

            if entry.get("stay_id") and entry["stay_id"] != stay_id:
                return False

            if entry.get("until"):
                today = datetime.utcnow().strftime("%Y-%m-%d")
                if entry["until"] > today:
                    return True
                # Expired — clean up
                del state["opt_outs"][phone]
                save(state)
                return False

            return True
        return self.with_lock(op)

    def opt_out(self, phone: str, stay_id: str, reason: str = "STOP", until: str | None = None) -> None:
        """Opt a guest out for a specific stay."""
        def op(state: dict, save: callable) -> None:
            if "opt_outs" not in state:
                state["opt_outs"] = {}
            state["opt_outs"][phone] = {"stay_id": stay_id, "reason": reason, "until": until}
            save(state)
        self.with_lock(op)

    def opt_in(self, phone: str) -> None:
        """Opt a guest back in."""
        def op(state: dict, save: callable) -> None:
            if "opt_outs" in state and phone in state["opt_outs"]:
                del state["opt_outs"][phone]
                save(state)
        self.with_lock(op)

    def handle_keyword(self, message: str, phone: str, stay_id: str) -> str | None:
        """Handle STOP/MUTE/RESUME keywords. Returns auto-reply or None."""
        text = (message or "").strip().upper()

        if text in ("STOP", "UNSUBSCRIBE"):
            self.opt_out(phone, stay_id, "STOP")
            return "You will no longer receive messages from Inika Resorts. To re-subscribe, reply RESUME."

        if text == "MUTE":
            until = (datetime.utcnow() + timedelta(days=7)).strftime("%Y-%m-%d")
            self.opt_out(phone, stay_id, "MUTE", until)
            return "Messages muted for 7 days. Reply RESUME to receive updates again."

        if text in ("RESUME", "START"):
            self.opt_in(phone)
            return "Welcome back! You will receive updates from Inika Resorts again."

        return None