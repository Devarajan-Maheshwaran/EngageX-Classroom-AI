from fastapi import APIRouter
from pydantic import BaseModel
import random

router = APIRouter()

class SeedRequest(BaseModel):
    session_id: str
    num_students: int = 5
    messages_per_student: int = 3

@router.post('/seed')
def seed_session(body: SeedRequest):
    # This is a mock endpoint for local hackathon demo seeding.
    # We would generate dummy signals and alerts here.
    return {"status": "success", "message": f"Seeded {body.num_students} students for session {body.session_id}"}
