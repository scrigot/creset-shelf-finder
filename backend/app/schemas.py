from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

EmailStatus = Literal["verified", "listed_publicly", "guessed", "none"]
Confidence = Literal["high", "medium", "low"]
GymType = Literal[
    "independent_strength",
    "crossfit",
    "boutique_franchise",
    "campus_rec",
    "run_club",
]

EMAIL_STATUSES: tuple[str, ...] = ("verified", "listed_publicly", "guessed", "none")
CONFIDENCES: tuple[str, ...] = ("high", "medium", "low")


class ProspectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    gym_type: str
    address: Optional[str] = None
    website: Optional[str] = None
    instagram: Optional[str] = None
    score: int
    notes: Optional[str] = None
    created_at: datetime


class ContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    prospect_id: int
    name: str
    role: Optional[str] = None
    email: Optional[str] = None
    email_status: str
    phone: Optional[str] = None
    instagram: Optional[str] = None
    linkedin_url: Optional[str] = None
    source_url: Optional[str] = None
    confidence: str
    reasoning: Optional[str] = None
    is_primary: bool
    found_at: datetime


class ProspectDetail(ProspectOut):
    contacts: list[ContactOut] = []


class ProspectListItem(ProspectOut):
    rank: int = 0
    primary_contact: Optional[ContactOut] = None


class ContactIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    role: Optional[str] = Field(default=None, max_length=200)
    email: Optional[str] = Field(default=None, max_length=320)
    email_status: EmailStatus = "none"
    phone: Optional[str] = Field(default=None, max_length=60)
    instagram: Optional[str] = Field(default=None, max_length=200)
    linkedin_url: Optional[str] = Field(default=None, max_length=400)
    source_url: Optional[str] = Field(default=None, max_length=600)
    confidence: Confidence = "low"
    reasoning: Optional[str] = None
    is_primary: bool = True


class FindContactResponse(BaseModel):
    candidates: list[ContactIn]
    searched_at: datetime
    model: Optional[str] = None


class OutreachDraft(BaseModel):
    to: str
    subject: str
    body: str
    contact_id: Optional[int] = None
