from __future__ import annotations

from backend.app.services.journey_personalization import apply_personalization


TEMPLATE = """Good afternoon, [Name]! ☀️

Check-in · Day 1 at Inika Resorts

[WeatherCondition] and [WeatherTemp] — ideal conditions to cool off at our infinity pool or enjoy a lazy afternoon on the veranda.

Your [Room] is all set for you. We hope you find it comfortable and cozy.

[WelcomeBack][Acknowledgment][OccasionMention]
[GroupGreeting][RequestsNote]

Any questions? Our concierge team is just a message away — reply here or call [ResortPhone].

Enjoy your afternoon! 🌿

— Inika"""


def render(booking: dict, extras: dict | None = None) -> str:
    return apply_personalization(TEMPLATE, booking, extras).strip()