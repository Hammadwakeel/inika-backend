from __future__ import annotations

"""
Weather module for journey scheduler.
Fetches Coorg/Virajpet weather from OpenWeatherMap with 30-minute cache.
"""

import os
import time
from typing import TypedDict

import urllib.request


COORG_LAT = 12.5464
COORG_LON = 75.7620


class Weather(TypedDict):
    condition: str
    temp: int
    icon: str
    description: str
    humidity: int
    windSpeed: int


_cached_weather: Weather | None = None
_weather_cache_time: float = 0
_WEATHER_CACHE_TTL: int = 30 * 60  # 30 minutes in seconds


def _condition_from_code(code: int) -> str:
    """Map OpenWeatherMap condition codes to Coorg-specific natural language."""
    if 200 <= code < 300:
        return "Thunder rumbles in the hills"
    if 300 <= code < 400:
        return "A light mist"
    if 500 <= code < 520:
        return "Gentle rain"
    if 520 <= code < 600:
        return "Rainy"
    if 600 <= code < 700:
        return "Cool and misty"
    if 700 <= code < 800:
        return "Foggy"
    if code == 800:
        return "Clear skies"
    if code == 801:
        return "Sunny with a few clouds"
    if code == 802:
        return "Partly cloudy"
    if code >= 803:
        return "Overcast"
    return "Pleasant"


def get_weather() -> Weather:
    """Fetch current weather for Coorg. Returns cached value if fresh."""
    global _cached_weather, _weather_cache_time

    now = time.time()
    if _cached_weather and (now - _weather_cache_time) < _WEATHER_CACHE_TTL:
        return _cached_weather

    api_key = os.environ.get("OPENWEATHER_API_KEY", "")
    if not api_key:
        return _default_weather()

    url = f"https://api.openweathermap.org/data/2.5/weather?lat={COORG_LAT}&lon={COORG_LON}&units=metric&appid={api_key}"

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "AxiomBot/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = _parse_json_response(resp.read().decode("utf-8"))

        if not data:
            return _default_weather()

        weather_data = data.get("weather", [{}])[0] if data.get("weather") else {}
        main_data = data.get("main", {})

        _cached_weather = {
            "condition": _condition_from_code(weather_data.get("id", 800)),
            "temp": round(main_data.get("temp", 22)),
            "icon": weather_data.get("icon", "01d"),
            "description": weather_data.get("description", "clear sky"),
            "humidity": main_data.get("humidity", 60),
            "windSpeed": round((data.get("wind", {}).get("speed", 0)) * 3.6),
        }
        _weather_cache_time = now
        return _cached_weather
    except Exception:
        return _default_weather()


def _parse_json_response(raw: str) -> dict:
    import json
    return json.loads(raw)


def _default_weather() -> Weather:
    """Fallback weather when API is unavailable."""
    return {
        "condition": "Pleasant",
        "temp": 24,
        "icon": "01d",
        "description": "pleasant weather in Coorg",
        "humidity": 65,
        "windSpeed": 5,
    }