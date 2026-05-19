"""
session.py — Pydantic request/response models for session endpoints.
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class CreateSessionRequest(BaseModel):
    title: str = Field(default="Untitled Session", min_length=1, max_length=120)
    teacher_id: Optional[str] = None


class JoinSessionRequest(BaseModel):
    join_code: str = Field(min_length=4, max_length=8)
    student_name: str = Field(min_length=1, max_length=60)


class SessionResponse(BaseModel):
    id: str
    join_code: str
    title: str
    status: str
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None


class JoinSessionResponse(BaseModel):
    session_id: str
    student_id: str
    student_name: str
    join_code: str
    title: str
    reconnected: bool = False
