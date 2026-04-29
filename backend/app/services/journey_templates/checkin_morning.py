from __future__ import annotations

from app.services.journey_personalization import apply_personalization


TEMPLATE = """Good morning, [Name]! 🌴

Check-in · Day 1 at Inika Resorts

[WeatherCondition] at [WeatherTemp] — perfect weather to explore our grounds in Coorg.

Your [Room] is ready and waiting for you. We'd love to have you settle in and make yourself at home.

[WelcomeBack][Acknowledgment][OccasionMention]
[GroupGreeting][RequestsNote]

Breakfast is served at The Coriander until 10 AM. Our team is on hand — reply here or call [ResortPhone].

Enjoy your stay! 🌿

— Inika"""


def render(booking: dict, extras: dict | None = None) -> str:
    return apply_personalization(TEMPLATE, booking, extras).strip()