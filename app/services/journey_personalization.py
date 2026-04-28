from __future__ import annotations

"""
Personalization module for journey templates.
Handles token substitution and evening activity rotation.
"""

import re
from typing import Any

from backend.app.services.journey_timing import night_count


EVENING_ACTIVITIES = [
    {"type": "campfire", "headline": "Evening Campfire", "description": "Join us at the outdoor cafe for a cozy campfire under the stars tonight. S'mores, stories, and warm conversations await.", "icon": "🔥"},
    {"type": "coriander", "headline": "Dinner at The Coriander", "description": "Our multi-cuisine restaurant is serving its signature Kodava specialties tonight. We'd love to reserve a table for you!", "icon": "🍽️"},
    {"type": "poolside", "headline": "Poolside Evening", "description": "The Cabana pool is open until late. Enjoy handcrafted mocktails and gourmet snacks by the water — a perfect way to end the day.", "icon": "🏊"},
    {"type": "stargazing", "headline": "Stargazing Walk", "description": "Tonight's clear skies make for perfect stargazing. Our guides can take you on a short walk to the best viewing spot on the property.", "icon": "🌌"},
    {"type": "coffee", "headline": "Coffee Estate Evening", "description": "End your day with a cup of our freshly roasted Coorg coffee at the outdoor cafe. There's nothing quite like it.", "icon": "☕"},
]


def select_evening_activity(booking_id: str, last_activity: str | None) -> dict:
    """Select the next evening activity, rotating from the last one."""
    last_idx = -1
    if last_activity:
        for i, act in enumerate(EVENING_ACTIVITIES):
            if act["type"] == last_activity:
                last_idx = i
                break
    next_idx = (last_idx + 1) % len(EVENING_ACTIVITIES)
    return EVENING_ACTIVITIES[next_idx]


def first_name(full_name: str) -> str:
    """Extract first name from full name."""
    if not full_name:
        return "Guest"
    return full_name.strip().split()[0]


def replace_tokens(text: str, vars: dict) -> str:
    """Replace template tokens in text.

    Supports:
      [Field]           — simple variable substitution
      [s/Field]         — pluralization: outputs "s" if Field > 1, else ""
      [word/Field/alt]  — conditional: outputs "word" if Field > 1, else "alt"
    """
    # Handle plural patterns: [s/Field] → "s" if Field > 1
    text = re.sub(r"\[s/(\w+)\]", lambda m: str(int(vars.get(m.group(1), 0)) > 1), text)

    # Handle conditional: [word/Field/alt] → "word" if Field > 1, else "alt"
    text = re.sub(r"\[(\w+)/(\w+)/([^\]]+)\]", lambda m: m.group(1) if int(vars.get(m.group(2), 0)) > 1 else m.group(3), text)

    # Simple variable substitution
    def repl(m):
        key = m.group(1)
        val = vars.get(key)
        return str(val) if val is not None else f"[{key}]"

    return re.sub(r"\[(\w+)\]", repl, text)


def build_vars(booking: dict, extras: dict | None = None) -> dict[str, str]:
    """Build the variable map for a booking."""
    extras = extras or {}
    nights = night_count(booking.get("check_in", "") or booking.get("cindate", ""),
                          booking.get("check_out", "") or booking.get("coutdate", ""))

    guest_name = first_name(booking.get("guest_name", "") or booking.get("gname", ""))

    # Source-specific messaging
    source = booking.get("booking_source", "") or booking.get("btype", "")
    source_mention = ""
    if source == "booking.com":
        source_mention = " through Booking.com"
    elif source == "airbnb":
        source_mention = " via Airbnb"
    elif source == "makemytrip":
        source_mention = " through MakeMyTrip"

    # Occasion mention
    occasion = booking.get("special_occasion", "") or ""
    occasion_mention = ""
    if occasion == "anniversary":
        occasion_mention = " Happy upcoming anniversary! We'd love to make it extra special — just let us know how we can help. "
    elif occasion == "birthday":
        occasion_mention = " A birthday celebration is in order! Our team would be honored to make it memorable. "
    elif occasion == "honeymoon":
        occasion_mention = " What an exciting time — congratulations on your honeymoon! We're here to make every moment magical. "

    # Repeat guest
    is_repeat = booking.get("is_repeat", False) or booking.get("repeat_guest", False)
    welcome_back = "Welcome back to Inika! It’s wonderful to have you with us again. " if is_repeat else f"Welcome to Inika Resorts{source_mention}! We're thrilled to host you. "

    # Couple vs group
    guest_count = int(booking.get("guest_count", booking.get("gcount", "1") or "1"))
    is_couple = booking.get("is_couple", False) or booking.get("couple", False)
    group_greeting = ""
    if is_couple:
        group_greeting = "We can't wait to share the beauty of Coorg with the both of you. "
    elif guest_count > 2:
        group_greeting = f"We can't wait to welcome your group of {guest_count}! "

    # Special requests
    requests = booking.get("special_requests", "") or booking.get("requests", "") or ""
    requests_note = f"\n\nWe've noted your request: \"{requests.strip()}\" — we'll take good care of it." if requests.strip() else ""

    # Weather vars
    weather = extras.get("weather", {})
    weather_temp = f"{weather.get('temp', 24)}°C"
    weather_condition = weather.get("condition", "Pleasant")
    weather_note = f"Current conditions: {weather_condition}, {weather_temp}." if weather else ""

    # Evening activity
    evening_note = ""
    if extras.get("evening_activity"):
        act = extras["evening_activity"]
        evening_note = f"\n\n{act['icon']} {act['headline']}\n{act['description']}"

    # Day label
    day_label = ""
    if extras.get("current_day"):
        day_label = f"Check-in · Day 1" if extras["current_day"] == 1 else f"Day {extras['current_day']} of {nights}"

    return {
        "Name": guest_name,
        "FullName": booking.get("guest_name", "") or booking.get("gname", "Guest"),
        "Room": booking.get("room_name", "") or booking.get("room", "your cottage"),
        "RoomType": booking.get("room_type", "") or "",
        "GuestCount": str(guest_count),
        "Nights": str(nights),
        "CheckIn": booking.get("check_in", "") or booking.get("cindate", ""),
        "CheckOut": booking.get("check_out", "") or booking.get("coutdate", ""),
        "Source": source or "direct",
        "Requests": requests,
        "WelcomeBack": welcome_back,
        "GroupGreeting": group_greeting,
        "OccasionMention": occasion_mention,
        "RequestsNote": requests_note,
        "WeatherNote": weather_note,
        "WeatherTemp": weather_temp,
        "WeatherCondition": weather_condition,
        "EveningNote": evening_note,
        "DayLabel": day_label,
        "Acknowledgment": booking.get("acknowledgment", ""),
        "ResortPhone": "+91 90357 40031",
        "ResortName": "Inika Resorts",
        "ResortLocation": "Coorg",
        "CheckInTime": "12:00 PM",
        "CheckOutTime": "11:00 AM",
        "ReviewLink": "https://g.page/inika-resorts/review",
    }


def apply_personalization(template: str, booking: dict, extras: dict | None = None) -> str:
    """Apply all personalization to a template string."""
    vars = build_vars(booking, extras)
    return replace_tokens(template, vars)