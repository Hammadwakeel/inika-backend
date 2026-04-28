from __future__ import annotations

import os
from typing import Callable

from fastapi import Request, Response
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

# Rate limiter instance
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])


def get_rate_limit_string() -> str:
    """Get rate limit from environment variable or use default."""
    return os.getenv("AXIOM_RATE_LIMIT", "10/minute")


# Per-IP rate limit for auth endpoints (stricter)
AUTH_RATE_LIMIT = os.getenv("AXIOM_AUTH_RATE_LIMIT", "5/minute")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Only add security headers for browser requests
        user_agent = request.headers.get("user-agent", "").lower()
        is_browser = any(
            browser in user_agent
            for browser in ["mozilla", "chrome", "firefox", "safari", "edge"]
        )

        if is_browser or not user_agent:
            # Strict-Transport-Security (HSTS)
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )

            # Content-Security-Policy
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: blob:; "
                "font-src 'self'; "
                "connect-src 'self'; "
                "frame-ancestors 'none';"
            )

            # X-Frame-Options
            response.headers["X-Frame-Options"] = "DENY"

            # X-Content-Type-Options
            response.headers["X-Content-Type-Options"] = "nosniff"

            # X-XSS-Protection (legacy but still useful for older browsers)
            response.headers["X-XSS-Protection"] = "1; mode=block"

            # Referrer-Policy
            response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

            # Permissions-Policy
            response.headers["Permissions-Policy"] = (
                "geolocation=(), "
                "microphone=(), "
                "camera=()"
            )

        return response


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Handle rate limit exceeded errors."""
    return JSONResponse(
        status_code=429,
        content={
            "error": "rate_limit_exceeded",
            "detail": f"Rate limit exceeded. Try again in a moment.",
            "retry_after": getattr(exc, "retry_after", 60),
        },
    )
