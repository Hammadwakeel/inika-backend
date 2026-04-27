from __future__ import annotations

"""
LLM-based message generator for journey scheduler.
Builds dynamic prompts with full guest context and generates personalized messages via LLM.
"""

import os
from typing import Any

from backend.app.services.llm_service import chat_completion


JOURNEY_SYSTEM_PROMPT = """You are Axiom, an AI concierge for Inika Resorts in Coorg, Karnataka, India.

Your role is to craft warm, personalized WhatsApp messages for guests at various stages of their stay.

Guidelines:
1. Keep messages under 100 words (WhatsApp friendly)
2. Use guest name naturally in the greeting
3. Reference their specific context (room, dates, weather, occasion)
4. Be helpful, warm, and professional
5. Include relevant time-of-day greeting (morning/afternoon/evening/night)
6. Mention specific amenities or activities relevant to their stay
7. Always sign with "— Inika" or "— Axiom"
8. Use emoji sparingly but meaningfully
9. Don't make up facts about the hotel — stay general

Message types you generate:
- checkin-morning: Guest arriving in morning/midday, welcome them warmly, mention breakfast
- checkin-afternoon: Guest arriving afternoon, mention pool/relaxation options
- checkin-evening: Guest arriving evening, mention dinner options and sunset
- checkin-late: Guest arriving late night, calm/minimal welcome, mention turndown done
- daily-morning: Good morning, mention breakfast and daily activities
- daily-lunch: Lunch reminder with dining options
- daily-evening: Evening recommendation with specific activity (varies by rotation)
- checkout-morning: Checkout reminder with logistics and review request
- post-stay: Thank you message, review request, rebooking incentive

Output ONLY the message text, no explanations, no quotes."""


def build_guest_context(booking: dict, extras: dict | None = None) -> str:
    """Build comprehensive guest context for the LLM prompt."""
    extras = extras or {}

    # Basic info
    guest_name = booking.get("guest_name", "") or booking.get("gname", "Guest")
    first_name = guest_name.split()[0] if guest_name else "Guest"
    room = booking.get("room", "") or booking.get("room_name", "your cottage")
    check_in = booking.get("check_in", "") or booking.get("cindate", "")
    check_out = booking.get("check_out", "") or booking.get("coutdate", "")

    # Stay details
    from backend.app.services.journey_timing import night_count
    nights = night_count(check_in, check_out)
    guest_count = int(booking.get("guest_count", booking.get("gcount", "1") or "1"))

    # Source
    source = booking.get("booking_source", "") or booking.get("btype", "")
    source_text = ""
    if source == "booking.com":
        source_text = " via Booking.com"
    elif source == "airbnb":
        source_text = " via Airbnb"
    elif source == "makemytrip":
        source_text = " through MakeMyTrip"

    # Special occasion
    occasion = booking.get("special_occasion", "") or ""
    occasion_text = ""
    if occasion == "anniversary":
        occasion_text = " (Upcoming Anniversary)"
    elif occasion == "birthday":
        occasion_text = " (Birthday Celebration)"
    elif occasion == "honeymoon":
        occasion_text = " (Honeymoon)"

    # Repeat guest
    is_repeat = booking.get("is_repeat", False) or booking.get("repeat_guest", False)
    repeat_text = " (Repeat guest)" if is_repeat else ""

    # Special requests
    requests = booking.get("special_requests", "") or ""
    requests_text = f"\nSpecial requests: {requests}" if requests else ""

    # Weather
    weather = extras.get("weather", {})
    weather_condition = weather.get("condition", "")
    weather_temp = weather.get("temp", 24)
    weather_text = f"\nCurrent weather: {weather_condition}, {weather_temp}°C" if weather else ""

    # Evening activity
    evening_activity = extras.get("evening_activity", {})
    evening_text = ""
    if evening_activity:
        evening_text = f"\nToday's activity: {evening_activity.get('headline', '')} - {evening_activity.get('description', '')}"

    # Day info
    current_day = extras.get("current_day", 1)
    day_text = f" (Day {current_day} of {nights})" if current_day > 1 else " (Check-in Day)"

    return f"""Guest Profile:
- Name: {guest_name} (first name: {first_name}){occasion_text}{repeat_text}
- Room: {room}
- Check-in: {check_in} at 12:00 PM IST
- Check-out: {check_out} at 11:00 AM IST
- Nights: {nights}
- Guests: {guest_count}
- Booking source: {source or 'direct'}{source_text}
- Today's message: This is message #{current_day} of their {nights}-night stay{day_text}{requests_text}{weather_text}{evening_text}"""


def build_llm_prompt(touchpoint_type: str, guest_context: str, time_of_day: str) -> str:
    """Build the LLM prompt for a specific touchpoint type."""

    prompt_templates = {
        "checkin-morning": f"""{guest_context}

Generate a warm welcome message for a guest arriving in the morning. Include:
- Time-of-day greeting
- Welcome to Inika Resorts
- Room readiness confirmation
- Breakfast timing (7:30-10 AM at The Coriander)
- Weather mention
- Offer help via WhatsApp or phone
- Sign warmly""",

        "checkin-afternoon": f"""{guest_context}

Generate a welcome message for a guest arriving in the afternoon. Include:
- Time-of-day greeting
- Welcome to Inika Resorts
- Room ready and waiting
- Weather mention
- Suggest afternoon activities (pool, veranda)
- Offer help via WhatsApp or phone
- Sign warmly""",

        "checkin-evening": f"""{guest_context}

Generate a welcome message for a guest arriving in the evening. Include:
- Time-of-day greeting
- Welcome to Inika Resorts
- Room ready with turndown done
- Weather as sun sets
- Mention sunset cocktails and dinner at The Coriander
- Offer help via WhatsApp or phone
- Sign warmly""",

        "checkin-late": f"""{guest_context}

Generate a calm, minimal welcome message for a guest arriving late at night. Include:
- Night greeting
- Welcome to Inika Resorts
- Room prepared and turndown complete
- Brief mention of mild weather
- Breakfast timing for morning
- Let them rest, minimal text
- Sign warmly""",

        "daily-morning": f"""{guest_context}

Generate a good morning message for a guest on day {guest_context.split('message #')[1].split(' ')[0] if 'message #' in guest_context else '2'} of their stay. Include:
- Morning greeting
- Day label
- Weather for the day
- Daily schedule (yoga at 8 AM, breakfast 7:30-10 AM, pool all day)
- Offer assistance
- Sign warmly""",

        "daily-lunch": f"""{guest_context}

Generate a lunch reminder message. Include:
- Lunch hour greeting
- Current weather
- Dining options: The Coriander (multi-cuisine Kodava specialties) and The Cabana (poolside)
- Reservation offer
- Sign warmly""",

        "daily-evening": f"""{guest_context}

Generate an evening message with the rotating activity. Include:
- Evening greeting
- Current weather
- [Use the evening activity from context]
- Next day planning offer
- Sign warmly""",

        "checkout-morning": f"""{guest_context}

Generate a checkout morning message. Include:
- Morning greeting
- Checkout reminder (11 AM)
- Late checkout option (1 PM available)
- Bill settlement reminder
- Luggage storage offer
- Breakfast timing
- Review request link
- Sign warmly""",

        "post-stay": f"""{guest_context}

Generate a post-stay thank you message. Include:
- Warm greeting
- Thank you for staying
- Room memories
- Review request
- Rebooking incentive (code RETURN10 for 10% off)
- Sign from Veema & team""",
    }

    return prompt_templates.get(touchpoint_type, f"""{guest_context}

Generate a friendly check-in message. Include:
- Warm greeting
- Welcome to Inika Resorts
- Room ready
- Offer help
- Sign warmly""")


def generate_journey_message(
    booking: dict,
    touchpoint_type: str,
    extras: dict | None = None,
) -> str | None:
    """Generate a personalized journey message using LLM."""

    # Build context
    guest_context = build_guest_context(booking, extras)

    # Get time of day
    from backend.app.services.journey_timing import get_ist_mode, now_ist
    time_of_day = get_ist_mode(now_ist())

    # Build prompt
    user_prompt = build_llm_prompt(touchpoint_type, guest_context, time_of_day)

    try:
        message = chat_completion(
            system_prompt=JOURNEY_SYSTEM_PROMPT,
            user_prompt=user_prompt,
        )
        return message.strip() if message else None
    except Exception as e:
        print(f"[journey-llm] Generation failed: {e}")
        return None


def generate_journey_message_simple(
    guest_name: str,
    room: str,
    touchpoint_type: str,
    context: dict | None = None,
) -> str:
    """Simple interface for generating journey messages.

    Args:
        guest_name: Guest's first name
        room: Room name
        touchpoint_type: Type of touchpoint (checkin-morning, daily-evening, etc.)
        context: Additional context (nights, weather, occasion, etc.)

    Returns:
        Generated message or fallback template
    """

    context = context or {}

    guest_context = f"""Guest Profile:
- Name: {guest_name}
- Room: {room}
- Nights: {context.get('nights', 1)}
- Weather: {context.get('weather', 'Pleasant')}
- Occasion: {context.get('occasion', 'None')}
- Evening Activity: {context.get('evening_activity', 'None')}
- Day: {context.get('day', 1)} of {context.get('nights', 1)}"""

    user_prompt = build_llm_prompt(touchpoint_type, guest_context, context.get('time_of_day', 'morning'))

    try:
        message = chat_completion(
            system_prompt=JOURNEY_SYSTEM_PROMPT,
            user_prompt=user_prompt,
        )
        return message.strip() if message else _fallback_message(guest_name, room, touchpoint_type, context)
    except Exception as e:
        print(f"[journey-llm] Generation failed: {e}")
        return _fallback_message(guest_name, room, touchpoint_type, context)


def _fallback_message(guest_name: str, room: str, touchpoint_type: str, context: dict) -> str:
    """Fallback template when LLM fails."""
    fallbacks = {
        "checkin-morning": f"Good morning, {guest_name}! Welcome to Inika Resorts! Your {room} is ready. Breakfast at The Coriander until 10 AM. Call +91 90357 40031 for anything. — Inika",
        "checkin-afternoon": f"Good afternoon, {guest_name}! Welcome! Your {room} is all set. Enjoy the pool or your veranda. Any questions? Just reply! — Inika",
        "checkin-evening": f"Good evening, {guest_name}! Welcome to Inika Resorts! Your {room} is ready for you. Dinner at The Coriander tonight. Rest well! — Inika",
        "checkin-late": f"Welcome, {guest_name}! Your {room} is prepared with turndown done. Rest well — breakfast starts at 7 AM. Sweet dreams! — Inika",
        "daily-morning": f"Good morning, {guest_name}! Day {context.get('day', 1)} at Inika Resorts. Yoga at 8 AM, breakfast until 10 AM. Enjoy! — Inika",
        "daily-lunch": f"Happy lunch hour, {guest_name}! The Coriander and The Cabana are open. Reserve a table if you'd like! — Inika",
        "daily-evening": f"Good evening, {guest_name}! {context.get('evening_activity', 'Enjoy your evening at the resort')}. What's on your agenda tomorrow? — Inika",
        "checkout-morning": f"Good morning, {guest_name}! Checking out today? Please settle your bill, luggage storage available. Review us: https://g.page/inika-resorts/review — Inika",
        "post-stay": f"Thank you for staying with us, {guest_name}! We hope your time in {room} was wonderful. Use code RETURN10 for 10% off your next booking! — Veema & Inika team",
    }
    return fallbacks.get(touchpoint_type, f"Hi {guest_name}! Thinking of you from Inika Resorts. — Inika")