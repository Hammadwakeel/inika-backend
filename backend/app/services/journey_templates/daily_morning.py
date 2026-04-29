from __future__ import annotations

from app.services.journey_personalization import apply_personalization


TEMPLATE = """Good morning, [Name]! ☀️

[DayLabel] at Inika Resorts 🌿

[WeatherCondition] and [WeatherTemp] in Coorg — a beautiful day ahead!

Here's what's on today:
• Complimentary yoga at 8 AM — join us if you like!
• Breakfast at The Coriander, 7:30 – 10 AM
• Pool and grounds open all day 🏊

Our team is on hand for anything you need. Reply here or call [ResortPhone].

Enjoy every moment! 🌿

— Inika"""


def render(booking: dict, extras: dict | None = None) -> str:
    return apply_personalization(TEMPLATE, booking, extras).strip()