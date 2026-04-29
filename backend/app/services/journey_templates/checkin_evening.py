from __future__ import annotations

from app.services.journey_personalization import apply_personalization


TEMPLATE = """Good evening, [Name]! 🌅

Check-in · Day 1 at Inika Resorts

[WeatherCondition] at [WeatherTemp] as the sun sets over Coorg — a beautiful start to your evening.

We invite you to join us for sunset cocktails at our rooftop bar. Tonight's special: fresh local cuisine under the stars at The Coriander.

Your [Room] is all ready for you.

[WelcomeBack][Acknowledgment][OccasionMention]
[GroupGreeting][RequestsNote]

Need anything to make your evening more comfortable? Just reply here — we're always here to help.

Enjoy your first evening! 🌿

— Inika"""


def render(booking: dict, extras: dict | None = None) -> str:
    booking = dict(booking)
    source = booking.get("booking_source", "") or booking.get("btype", "")
    if source and source != "direct":
        booking["acknowledgment"] = f"All confirmed from {source} — you're all set! "
    else:
        booking["acknowledgment"] = booking.get("acknowledgment", "")
    return apply_personalization(TEMPLATE, booking, extras).strip()