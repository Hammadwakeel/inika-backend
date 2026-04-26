from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.config import ALLOWED_ORIGINS
from backend.app.routes.auth import router as auth_router

app = FastAPI(title="Axiom Platform API", version="1.0.0-AXIOM")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)

