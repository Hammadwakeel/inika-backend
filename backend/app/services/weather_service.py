from __future__ import annotations

import json
from typing import Any
from urllib import request

# Open-Meteo is free, no API key required
OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast"

# WeatherAPI.com is optional fallback (requires key)
WEATHER_API_KEY = ""  # Optional: set WEATHER_API_KEY env var for weatherapi.com fallback


def get_current_weather(latitude: float = 12.34, longitude: float = 75.74) -> dict[str, Any]:
    """
    Get current weather for Coorg region (default coordinates).
    Uses Open-Meteo API (free, no key required).
    """
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m",
        "timezone": "auto",
    }

    query = "&".join(f"{k}={v}" for k, v in params.items())
    url = f"{OPEN_METEO_BASE}?{query}"

    try:
        req = request.Request(url, headers={"Accept": "application/json"})
        with request.urlopen(req, timeout=15) as response:
            data = json.loads(response.read().decode("utf-8"))

        current = data.get("current", {})
        weather_code = current.get("weather_code", 0)

        return {
            "status": "ok",
            "location": {
                "latitude": latitude,
                "longitude": longitude,
                "timezone": data.get("timezone", "UTC"),
            },
            "current": {
                "temperature": current.get("temperature_2m"),
                "feels_like": current.get("apparent_temperature"),
                "humidity": current.get("relative_humidity_2m"),
                "precipitation": current.get("precipitation"),
                "wind_speed": current.get("wind_speed_10m"),
                "wind_direction": current.get("wind_direction_10m"),
                "condition": _wmo_code_to_condition(weather_code),
                "condition_code": weather_code,
            },
            "source": "open-meteo",
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


def get_weather_description(weather_code: int) -> str:
    """Convert WMO weather code to human-readable description."""
    return _wmo_code_to_condition(weather_code)


def _wmo_code_to_condition(code: int) -> str:
    """Convert WMO weather code to condition string."""
    conditions = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Fog",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        56: "Light freezing drizzle",
        57: "Dense freezing drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        66: "Light freezing rain",
        67: "Heavy freezing rain",
        71: "Slight snow",
        73: "Moderate snow",
        75: "Heavy snow",
        77: "Snow grains",
        80: "Slight rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",
        85: "Slight snow showers",
        86: "Heavy snow showers",
        95: "Thunderstorm",
        96: "Thunderstorm with slight hail",
        99: "Thunderstorm with heavy hail",
    }
    return conditions.get(code, "Unknown")


def format_weather_message(weather_data: dict[str, Any]) -> str:
    """Format weather data into a natural language message."""
    if weather_data.get("status") != "ok":
        return "I couldn't fetch the weather information right now."

    current = weather_data.get("current", {})
    temp = current.get("temperature")
    condition = current.get("condition", "Unknown")
    humidity = current.get("humidity")
    wind = current.get("wind_speed")
    feels = current.get("feels_like")

    parts = []
    if temp is not None:
        parts.append(f"{temp}°C")
    if condition:
        parts.append(condition)
    if feels is not None and feels != temp:
        parts.append(f"(feels like {feels}°C)")

    msg = f"Current weather: {', '.join(parts)}"

    if humidity is not None:
        msg += f", humidity {humidity}%"
    if wind is not None:
        msg += f", wind {wind} km/h"

    return msg


# Coorg location
COORG_LAT = 12.3374
COORG_LON = 75.7169


def get_coorg_weather() -> dict[str, Any]:
    """Get weather for Coorg, Karnataka."""
    return get_current_weather(COORG_LAT, COORG_LON)


def get_coorg_weather_message() -> str:
    """Get formatted weather message for Coorg."""
    return format_weather_message(get_coorg_weather())
