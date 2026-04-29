from __future__ import annotations

from app.services.journey_personalization import apply_personalization


TEMPLATE = """Good morning, [Name]! Checking out today? 🧳

[WeatherCondition] at [WeatherTemp] — a lovely day to depart from Coorg.

Late checkout available until 1 PM upon request — just let us know.

A few reminders:
• Please settle your bill at the front desk before departure
• Luggage can be stored at the front desk if you have a late departure
• Breakfast is served until 10 AM ☕

[GroupGreeting] Was everything to your satisfaction? We'd love to hear your thoughts — and you can share a review here: [ReviewLink]

It was truly a pleasure hosting you in your [Room]. Safe travels, and we hope to welcome you back! 🏔️

— Inika Resorts, Coorg"""


def render(booking: dict, extras: dict | None = None) -> str:
    return apply_personalization(TEMPLATE, booking, extras).strip()