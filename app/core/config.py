from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
TENANTS_ROOT = BASE_DIR / "data" / "tenants"
DB_FILENAME = "axiom.db"
BRIDGE_SCRIPT = BASE_DIR / "whatsapp_bridge.js"

ALGORITHM = "HS256"
JWT_SECRET = os.getenv("AXIOM_JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError(
        "AXIOM_JWT_SECRET environment variable is required. "
        "Set it to a secure random string (min 32 characters)."
    )
JWT_EXPIRE_MINUTES = int(os.getenv("AXIOM_JWT_EXPIRE_MINUTES", "60"))
COOKIE_NAME = "axiom_session"
COOKIE_SECURE = os.getenv("AXIOM_COOKIE_SECURE", "true").lower() == "true"

# CORS configuration - comma-separated list of allowed origins
_ALLOWED_ORIGINS_RAW = os.getenv("AXIOM_ALLOWED_ORIGINS", "https://inika-resort.vercel.app,http://localhost:3000,http://localhost:3001")
ALLOWED_ORIGINS = [origin.strip() for origin in _ALLOWED_ORIGINS_RAW.split(",") if origin.strip()]

