"""
main.py — EngageX v2 Backend Entry Point
FastAPI + python-socketio ASGI app.

Run from inside backend_v2/:
    uvicorn main:app --reload --port 8000
"""

import os
import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from routers import sessions, signals
from socket_manager import sio

load_dotenv()

fastapi_app = FastAPI(
    title="EngageX API v2",
    description="Agentic AI backend for real-time classroom engagement",
    version="2.0.0",
)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("FRONTEND_URL", "http://localhost:3000"),
        "https://*.vercel.app",
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

fastapi_app.include_router(sessions.router, prefix="/api/sessions", tags=["Sessions"])
fastapi_app.include_router(signals.router,  prefix="/api/signals",  tags=["Signals"])

@fastapi_app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "version": "2.0.0"}

app = socketio.ASGIApp(
    socketio_server=sio,
    other_asgi_app=fastapi_app,
    socketio_path="/socket.io",
)
