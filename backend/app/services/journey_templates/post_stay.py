from __future__ import annotations

from backend.app.services.journey_personalization import apply_personalization


TEMPLATE = """Hi [Name]! 🌿

The whole team at Inika Resorts in Coorg wanted to say a heartfelt thank you for choosing us.

We hope your time in your [Room] was peaceful, restorative, and full of beautiful moments. 🌄

If you have a moment, we'd be so grateful for your feedback:
👉 [ReviewLink]

Your words help other travelers discover Coorg — and mean the world to us.

And when you're ready for your next escape, we'll be right here waiting. Use code RETURN10 for a 10% discount on your next booking! 🌿

Until the mountains call again,

— Veema & the Inika Resorts team 🌺
+91 90357 40031 | veema@inikaresorts.com"""


def render(booking: dict, extras: dict | None = None) -> str:
    return apply_personalization(TEMPLATE, booking, extras).strip()