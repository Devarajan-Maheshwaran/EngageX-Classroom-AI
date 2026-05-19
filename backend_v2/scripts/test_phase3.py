"""
test_phase3.py — Phase 3 smoke test
Tests FastAPI REST endpoints and basic Socket.IO room join flow.

Run (with backend running on :8000):
    python backend_v2/scripts/test_phase3.py

Requires:
    pip install httpx python-socketio[client] aiohttp
"""

import asyncio
import sys
import httpx
import socketio

BASE = "http://localhost:8000"
PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"


def check(label: str, cond: bool):
    print(f"  {PASS if cond else FAIL}  {label}")
    if not cond:
        sys.exit(1)


def test_rest():
    print("\n[REST] Testing session endpoints...")
    with httpx.Client(base_url=BASE, timeout=10) as client:
        # Health
        r = client.get("/health")
        check("GET /health returns 200", r.status_code == 200)
        check("Status is ok", r.json()["status"] == "ok")

        # Create session
        r = client.post("/api/sessions/create", json={"title": "Phase 3 Test"})
        check("POST /api/sessions/create returns 201", r.status_code == 201)
        session = r.json()
        check("Has session id",    bool(session.get("id")))
        check("Has join_code",     len(session.get("join_code", "")) == 6)
        check("Status is waiting", session["status"] == "waiting")
        session_id = session["id"]
        join_code  = session["join_code"]
        print(f"    session_id: {session_id}")
        print(f"    join_code:  {join_code}")

        # Join session
        r = client.post("/api/sessions/join", json={
            "join_code":    join_code,
            "student_name": "Devarajan",
        })
        check("POST /api/sessions/join returns 200", r.status_code == 200)
        joined = r.json()
        check("Has student_id",  bool(joined.get("student_id")))
        check("Name matches",    joined["student_name"] == "Devarajan")
        check("Code matches",    joined["join_code"] == join_code)
        student_id = joined["student_id"]
        print(f"    student_id: {student_id}")

        # Get state
        r = client.get(f"/api/sessions/{session_id}/state")
        check("GET /state returns 200", r.status_code == 200)
        state = r.json()
        check("State has students list", "students" in state)
        check("One student in session",  len(state["students"]) == 1)

        # Start session
        r = client.post(f"/api/sessions/{session_id}/start")
        check("POST /start returns 200", r.status_code == 200)
        check("Status is active", r.json()["status"] == "active")

        # End session
        r = client.post(f"/api/sessions/{session_id}/end")
        check("POST /end returns 200", r.status_code == 200)
        check("Status is ended", r.json()["status"] == "ended")

    return session_id, join_code, student_id


async def test_socketio(session_id: str, student_id: str):
    print("\n[Socket.IO] Testing room join...")
    received: list[str] = []

    student_sio = socketio.AsyncClient()
    teacher_sio = socketio.AsyncClient()

    @teacher_sio.on("session:student_joined")
    async def on_student_joined(data):
        received.append("student_joined")
        print(f"    Teacher received student_joined: {data}")

    @student_sio.on("session:joined")
    async def on_joined(data):
        received.append("joined")
        print(f"    Student received session:joined: {data}")

    @student_sio.on("session:pong")
    async def on_pong(data):
        received.append("pong")
        print(f"    Student received session:pong: {data}")

    try:
        # Create a fresh waiting session for socket test
        async with httpx.AsyncClient(base_url=BASE) as c:
            r = await c.post("/api/sessions/create", json={"title": "Socket Test"})
            sock_session_id = r.json()["id"]
            r = await c.post("/api/sessions/join", json={
                "join_code": r.json()["join_code"],
                "student_name": "SocketTestStudent",
            })
            sock_student_id = r.json()["student_id"]

        await teacher_sio.connect(BASE, socketio_path="/socket.io")
        await student_sio.connect(BASE, socketio_path="/socket.io")

        # Teacher joins
        await teacher_sio.emit("session:join", {
            "session_id": sock_session_id,
            "student_id": None,
            "role":       "teacher",
            "name":       "Teacher",
        })
        await asyncio.sleep(0.3)

        # Student joins
        await student_sio.emit("session:join", {
            "session_id": sock_session_id,
            "student_id": sock_student_id,
            "role":       "student",
            "name":       "SocketTestStudent",
        })
        await asyncio.sleep(0.5)

        # Ping
        await student_sio.emit("session:ping", {"session_id": sock_session_id})
        await asyncio.sleep(0.3)

    finally:
        await student_sio.disconnect()
        await teacher_sio.disconnect()

    check("Student received session:joined",         "joined"         in received)
    check("Teacher received session:student_joined", "student_joined" in received)
    check("Student received session:pong",           "pong"           in received)


async def main():
    print("\n=== EngageX Phase 3 — API + Socket.IO Smoke Test ===\n")
    session_id, join_code, student_id = test_rest()
    await test_socketio(session_id, student_id)
    print("\n=== All Phase 3 tests passed ✓ ===\n")


if __name__ == "__main__":
    asyncio.run(main())
