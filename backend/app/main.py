from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from backend.app.core.config import ALLOWED_ORIGINS
from backend.app.routes.auth import router as auth_router
from backend.app.routes.journey import router as journey_router
from backend.app.routes.booking import router as booking_router
from backend.app.routes.dashboard import router as dashboard_router
from backend.app.routes.rag import router as rag_router

app = FastAPI(title="Axiom Platform API", version="1.0.0-AXIOM")


@app.middleware("http")
async def cors_options_middleware(request: Request, call_next):
    if request.method == "OPTIONS":
        origin = request.headers.get("origin", "")
        allowed_origin = origin if origin.startswith("http://localhost:") else "*"
        return Response(
            status_code=200,
            headers={
                "Access-Control-Allow-Origin": allowed_origin,
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie",
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Max-Age": "600",
            },
        )
    return await call_next(request)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(journey_router)
app.include_router(booking_router)
app.include_router(dashboard_router)
app.include_router(rag_router)

