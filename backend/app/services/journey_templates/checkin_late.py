from __future__ import annotations

from app.services.journey_personalization import apply_personalization


TEMPLATE = """Welcome, [Name]! 🌙

Check-in · Day 1 at Inika Resorts

It's a mild [WeatherTemp] outside — a cool, peaceful night in Coorg.

Your [Room] is prepared and turndown service is complete. Rest well — breakfast starts at 7 AM at The Coriander.

We'll be here if you need anything overnight. Sweet dreams! 🌙

— Inika"""


def render(booking: dict, extras: dict | None = None) -> str:
    return apply_personalization(TEMPLATE, booking, extras).strip()