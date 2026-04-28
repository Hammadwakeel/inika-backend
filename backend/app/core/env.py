"""Load backend/.env before modules snapshot OPENROUTER_* and other secrets."""

from __future__ import annotations

from pathlib import Path


def load_backend_env() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    # backend/app/core/env.py -> backend/
    backend_root = Path(__file__).resolve().parent.parent.parent
    env_path = backend_root / ".env"
    if env_path.is_file():
        load_dotenv(env_path)
