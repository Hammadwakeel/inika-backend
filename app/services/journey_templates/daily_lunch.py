from __future__ import annotations

from backend.app.services.journey_personalization import apply_personalization


TEMPLATE = """Happy lunch hour, [Name]! 🍽️

[WeatherCondition] at [WeatherTemp] — stay hydrated and beat the heat!

Your dining options today:
📍 The Coriander — multi-cuisine with local Kodava specialties
📍 The Cabana — poolside platters and fresh juices by the water

Reservations welcome — just reply here or call [ResortPhone].

Enjoy your afternoon! ☀️

— Inika"""


def render(booking: dict, extras: dict | None = None) -> str:
    return apply_personalization(TEMPLATE, booking, extras).strip()