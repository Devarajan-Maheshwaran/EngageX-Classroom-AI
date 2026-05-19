"""
test_supabase.py — Phase 2 smoke test

Verifies:
  1. Can create a session.
  2. Can look it up by join_code.
  3. Can add two students.
  4. Can read active students back.
  5. Can save a signal.
  6. Can read recent signals.
  7. Can mark a student as left.
  8. Can update session status to ended.

Run from repo root:
    cd backend_v2
    pip install -r requirements.txt
    cd ..
    python scripts/test_supabase.py
"""

import sys
import os

# Allow import from backend_v2/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend_v2"))

from services.supabase_service import SupabaseService

PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"


def test(label: str, condition: bool):
    print(f"  {PASS if condition else FAIL}  {label}")
    if not condition:
        print("    ↳ FAILED — check Supabase dashboard and .env values")
        sys.exit(1)


def main():
    print("\n=== EngageX Phase 2 — Supabase Smoke Test ===\n")
    svc = SupabaseService()

    # 1. Create session
    print("[1] Creating session...")
    session = svc.create_session(title="Phase 2 Test Session")
    test("Session created", bool(session.get("id")))
    test("Has join_code", len(session.get("join_code", "")) == 6)
    test("Status is waiting", session["status"] == "waiting")
    session_id = session["id"]
    join_code  = session["join_code"]
    print(f"    session_id: {session_id}")
    print(f"    join_code:  {join_code}")

    # 2. Lookup by join_code
    print("\n[2] Looking up by join_code...")
    found = svc.get_session_by_join_code(join_code)
    test("Session found by join_code", found is not None)
    test("IDs match", found["id"] == session_id)

    # 3. Add students
    print("\n[3] Adding students...")
    s1 = svc.add_session_student(session_id, "Devarajan", socket_id="socket-001")
    s2 = svc.add_session_student(session_id, "Priya",     socket_id="socket-002")
    test("Student 1 added", bool(s1.get("id")))
    test("Student 2 added", bool(s2.get("id")))
    student1_id = s1["id"]
    student2_id = s2["id"]

    # 4. Active students
    print("\n[4] Fetching active students...")
    students = svc.get_active_students(session_id)
    test("Two active students", len(students) == 2)

    # 5. Save a text signal
    print("\n[5] Saving a text signal...")
    sig = svc.save_signal(
        session_id=session_id,
        student_id=student1_id,
        signal_type="text",
        signal_data={
            "text": "I don't understand this concept",
            "sentiment": "NEGATIVE",
            "sentimentScore": 0.87,
            "intent": "confused",
            "intentScores": {"confused": 0.87, "engaged": 0.08},
            "editCount": 1,
        },
        engagement_score=42.0,
    )
    test("Signal saved", bool(sig.get("id")))

    # 6. Read recent signals
    print("\n[6] Reading recent signals...")
    recent = svc.get_recent_signals(student1_id, limit=5)
    test("At least 1 signal returned", len(recent) >= 1)
    test("Signal type is text", recent[0]["signal_type"] == "text")

    # 7. Mark student 2 as left
    print("\n[7] Marking student 2 as left...")
    svc.mark_student_left(student2_id)
    active_after = svc.get_active_students(session_id)
    test("Only 1 student active after leave", len(active_after) == 1)
    test("Remaining is student 1", active_after[0]["id"] == student1_id)

    # 8. End session
    print("\n[8] Ending session...")
    ended = svc.update_session_status(session_id, "ended")
    test("Status updated to ended", ended["status"] == "ended")
    test("ended_at populated",     ended.get("ended_at") is not None)

    print("\n=== All tests passed ✓ ===\n")


if __name__ == "__main__":
    main()
