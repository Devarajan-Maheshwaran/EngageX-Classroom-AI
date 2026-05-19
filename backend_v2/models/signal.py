"""
signal.py — Pydantic models for all signal types.
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class TextSignalPayload(BaseModel):
    session_id: str
    student_id: str
    text: str = Field(max_length=1000)
    is_deleted: bool = False
    edit_count: int = 0
    sentiment: Optional[str] = None          # computed in browser
    sentiment_score: Optional[float] = None
    intent: Optional[str] = None
    intent_scores: Optional[dict] = None
    engagement_score: Optional[float] = None


class VisionSignalPayload(BaseModel):
    session_id: str
    student_id: str
    face_present_ratio: float = Field(ge=0, le=1)
    dominant_expression: Optional[str] = None
    looking_away_ratio: float = Field(ge=0, le=1, default=0)
    eye_open_ratio: float = Field(ge=0, le=1, default=1)
    engagement_score: Optional[float] = None


class ReactionPayload(BaseModel):
    session_id: str
    student_id: str
    reaction_type: Literal["got_it", "confused", "question"]
