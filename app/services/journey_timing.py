from __future__ import annotations

"""
Timing module for journey scheduler.
Handles IST timezone math, touchpoint computation, quiet hours, and time windows.
"""

from datetime import datetime, timedelta
from typing import TypedDict


IST_OFFSET_HOURS = 5.5


class Touchpoint(TypedDict):
    type: str
    date: str  # YYYY-MM-DD in IST
    time: int  # UTC hour (0-23)
    label: str


def now_ist() -> datetime:
    """Get current time in IST."""
    now = datetime.utcnow()
    return now + timedelta(hours=IST_OFFSET_HOURS)


def ist_date_str(date: datetime) -> str:
    """Format a Date as YYYY-MM-DD in IST."""
    return (date - timedelta(hours=IST_OFFSET_HOURS)).strftime("%Y-%m-%d")


def get_ist_mode(date: datetime | None = None) -> str:
    """Get time-of-day label in IST: morning (5-12), afternoon (12-17), evening (17-22), night."""
    d = date or now_ist()
    hours = (d.hour - IST_OFFSET_HOURS) % 24
    if 5 <= hours < 12:
        return "morning"
    if 12 <= hours < 17:
        return "afternoon"
    if 17 <= hours < 22:
        return "evening"
    return "night"


def is_quiet_hours() -> bool:
    """Returns True if current IST time is within quiet hours (10 PM - 8 AM)."""
    hours = (now_ist().hour - IST_OFFSET_HOURS) % 24
    return hours >= 22 or hours < 8


def parse_ist_date(date_str: str) -> datetime:
    """Parse YYYY-MM-DD string as midnight IST (returns UTC time)."""
    y, m, d = date_str.split("-")
    return datetime(int(y), int(m), int(d), 0, 0, 0) - timedelta(hours=IST_OFFSET_HOURS)


def add_days(date_str: str, days: int) -> str:
    """Add days to a YYYY-MM-DD IST date string."""
    d = datetime.strptime(date_str, "%Y-%m-%d")
    d += timedelta(days=days)
    return d.strftime("%Y-%m-%d")


def same_date(a: str, b: str) -> bool:
    """Check if two YYYY-MM-DD strings refer to the same IST date."""
    return a == b


def night_count(check_in: str, check_out: str) -> int:
    """Number of nights between two YYYY-MM-DD strings."""
    a = parse_ist_date(check_in)
    b = parse_ist_date(check_out)
    return round((b - a).total_seconds() / 86400)


def compute_touchpoints(booking: dict) -> list[Touchpoint]:
    """Compute all possible touchpoints for a booking."""
    check_in = booking.get("check_in", "") or booking.get("cindate", "")
    check_out = booking.get("check_out", "") or booking.get("coutdate", "")

    if not check_in or not check_out:
        return []

    try:
        nights = night_count(check_in, check_out)
    except Exception:
        nights = 1

    points: list[Touchpoint] = []

    # Check-in messages on check-in day — scheduler picks ONE based on current time
    for tp_type, time, label in [
        ("checkin-morning", 2, "Check-in morning"),       # 8 AM IST
        ("checkin-afternoon", 6, "Check-in afternoon"),   # 12 PM IST
        ("checkin-evening", 11, "Check-in evening"),     # 5 PM IST
        ("checkin-late", 16, "Check-in late night"),     # 10 PM IST
    ]:
        points.append({"type": tp_type, "date": check_in, "time": time, "label": label})

    # Daily morning (Day 2..N), 8:30 AM IST
    for day in range(2, nights + 1):
        points.append({
            "type": "daily-morning",
            "date": add_days(check_in, day - 1),
            "time": 3,
            "label": f"Daily morning — day {day}",
        })

    # Daily lunch, 12:00 PM IST
    for day in range(1, nights + 1):
        points.append({
            "type": "daily-lunch",
            "date": add_days(check_in, day - 1),
            "time": 6,
            "label": f"Daily lunch — day {day}",
        })

    # Daily evening, 5:30 PM IST
    for day in range(1, nights + 1):
        points.append({
            "type": "daily-evening",
            "date": add_days(check_in, day - 1),
            "time": 12,
            "label": f"Daily evening — day {day}",
        })

    # Checkout morning
    points.append({"type": "checkout-morning", "date": check_out, "time": 2, "label": "Checkout morning"})

    # Post-stay: day after checkout, 10 AM IST
    points.append({"type": "post-stay", "date": add_days(check_out, 1), "time": 4, "label": "Post-stay thank you"})

    return points


def is_in_window(current_utc_hour: int, touchpoint_type: str, touchpoint_time: int) -> bool:
    """Check if the current UTC hour is within the active window for a touchpoint.

    Checkin windows: ±2 hours
    Other windows: ±1 hour
    """
    if touchpoint_type.startswith("checkin-"):
        return abs(current_utc_hour - touchpoint_time) <= 2
    return abs(current_utc_hour - touchpoint_time) <= 1


def get_active_checkin_touchpoint(touchpoints: list[Touchpoint], now_utc: datetime) -> Touchpoint | None:
    """For check-in day, determine which checkin template to use based on current UTC hour.

    Returns the most appropriate touchpoint type, or None if not check-in day.
    """
    today = ist_date_str(now_ist())
    checkin_tps = [tp for tp in touchpoints if tp["type"].startswith("checkin-") and tp["date"] == today]

    if not checkin_tps:
        return None

    checkin_tps.sort(key=lambda x: x["time"])
    current_utc_hour = now_utc.hour

    active = None
    for tp in checkin_tps:
        if current_utc_hour >= tp["time"]:
            active = tp

    # If we're before the first window, check if within first window ±2h
    if not active and checkin_tps:
        first = checkin_tps[0]
        if abs(current_utc_hour - first["time"]) <= 2:
            return first

    return active or checkin_tps[0]