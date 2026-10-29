from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

STAGE_VALUES = Literal[
    "Not contacted", "Reached out", "Meeting", "Sampling", "Stocked", "Lost"
]

EmailStatus = Literal["verified", "listed_publicly", "guessed", "none"]
Confidence = Literal["high", "medium", "low"]
TouchKind = Literal["sent", "reply", "call", "note"]

EMAIL_STATUSES: tuple[str, ...] = ("verified", "listed_publicly", "guessed", "none")
CONFIDENCES: tuple[str, ...] = ("high", "medium", "low")


class ActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: str
    body: str
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
    touch_count: int = 0
    last_touch_at: Optional[datetime] = None
    last_touch_kind: Optional[str] = None


class PersonOut(ContactOut):
    """A contact with enough of its gym to list everyone in one table."""

    prospect_name: str
    prospect_type: str
    prospect_stage: str


class TouchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    prospect_id: int
    contact_id: Optional[int] = None
    kind: str
    body: str
    created_at: datetime


class TouchIn(BaseModel):
    kind: TouchKind
    contact_id: Optional[int] = None
    body: str = ""
    # For "sent": schedule the follow-up this many days out.
    follow_up_days: int = Field(default=4, ge=0, le=60)


class ProspectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: str
    address: str
    website: Optional[str] = None
    instagram: Optional[str] = None
    distance_miles: float
    members: int
    pct_18_34: float
    pct_women: float
    athlete_focus: str
    has_drink_fridge: bool
    sells_supplements: bool
    warm_intro: str
    stage: str
    next_action: str
    next_action_date: date | None
    notes: str
    lat: float
    lng: float
    primary_contact: Optional[ContactOut] = None
    contact_count: int = 0
    last_touch_at: Optional[datetime] = None
    last_touch_kind: Optional[str] = None


class ProspectDetail(ProspectOut):
    activities: list[ActivityOut] = []
    contacts: list[ContactOut] = []
    touches: list[TouchOut] = []


class ProspectUpdate(BaseModel):
    stage: STAGE_VALUES | None = None
    next_action: str | None = Field(default=None, max_length=200)
    next_action_date: date | None = None
    notes: str | None = None


class ActivityCreate(BaseModel):
    kind: str = Field(default="note", max_length=30)
    body: str = Field(min_length=1)


class FollowUpIn(BaseModel):
    next_action: str = Field(min_length=1, max_length=200)
    next_action_date: date
    note: str = ""


class DraftOut(BaseModel):
    to: str = ""
    subject: str
    body: str
    source: str
    contact_id: Optional[int] = None


class SettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    weight_fit: float
    weight_size: float
    weight_demo: float
    weight_location: float
    weight_ease: float
    adoption_pct: float
    bottles_per_week: float
    margin_per_bottle: float


class SettingsUpdate(BaseModel):
    weight_fit: float | None = Field(default=None, ge=0, le=100)
    weight_size: float | None = Field(default=None, ge=0, le=100)
    weight_demo: float | None = Field(default=None, ge=0, le=100)
    weight_location: float | None = Field(default=None, ge=0, le=100)
    weight_ease: float | None = Field(default=None, ge=0, le=100)
    adoption_pct: float | None = Field(default=None, ge=0, le=100)
    bottles_per_week: float | None = Field(default=None, ge=0, le=100)
    margin_per_bottle: float | None = Field(default=None, ge=0, le=100)


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


class ContactUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    role: Optional[str] = Field(default=None, max_length=200)
    email: Optional[str] = Field(default=None, max_length=320)
    email_status: Optional[EmailStatus] = None
    phone: Optional[str] = Field(default=None, max_length=60)
    instagram: Optional[str] = Field(default=None, max_length=200)
    linkedin_url: Optional[str] = Field(default=None, max_length=400)
    is_primary: Optional[bool] = None
