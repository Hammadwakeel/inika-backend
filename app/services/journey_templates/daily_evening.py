from __future__ import annotations

from backend.app.services.journey_personalization import apply_personalization


TEMPLATE = """Good evening, [Name]! 🌴

[WeatherCondition] at [WeatherTemp] — perfect for an outdoor dinner or stargazing by the pool.

[EveningNote]

[DayLabel] at Inika Resorts 🌿

What's on your agenda for tomorrow? We can arrange it — just reply here or call [ResortPhone].

Enjoy your evening! 🏔️

— Inika"""


def render(booking: dict, extras: dict | None = None) -> str:
    return apply_personalization(TEMPLATE, booking, extras).strip()