from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

STAGE_VALUES = Literal[
    "Not contacted", "Reached out", "Meeting", "Sampling", "Stocked", "Lost"
]


class ActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: str
    body: str
    created_at: datetime


class ProspectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: str
    address: str
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


class ProspectDetail(ProspectOut):
    activities: list[ActivityOut] = []


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
    subject: str
    body: str
    source: str


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
