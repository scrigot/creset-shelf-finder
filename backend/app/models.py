from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base

STAGES = (
    "Not contacted",
    "Reached out",
    "Meeting",
    "Sampling",
    "Stocked",
    "Lost",
)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Prospect(Base):
    __tablename__ = "prospects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    type: Mapped[str] = mapped_column(String(40))
    address: Mapped[str] = mapped_column(String(200))
    # Optional public profile, used by the contact search.
    website: Mapped[Optional[str]] = mapped_column(String(400), nullable=True)
    instagram: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    distance_miles: Mapped[float] = mapped_column(Float)
    members: Mapped[int] = mapped_column(Integer)
    pct_18_34: Mapped[float] = mapped_column(Float)
    pct_women: Mapped[float] = mapped_column(Float)
    athlete_focus: Mapped[str] = mapped_column(String(10), default="med")
    has_drink_fridge: Mapped[bool] = mapped_column(Boolean, default=False)
    sells_supplements: Mapped[bool] = mapped_column(Boolean, default=False)
    warm_intro: Mapped[str] = mapped_column(Text, default="")
    stage: Mapped[str] = mapped_column(String(30), default="Not contacted")
    next_action: Mapped[str] = mapped_column(String(200), default="")
    next_action_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)

    activities: Mapped[list["Activity"]] = relationship(
        back_populates="prospect",
        cascade="all, delete-orphan",
        order_by="Activity.created_at.desc()",
    )

    contacts: Mapped[list["Contact"]] = relationship(
        back_populates="prospect", cascade="all, delete-orphan"
    )

    touches: Mapped[list["Touch"]] = relationship(
        back_populates="prospect",
        cascade="all, delete-orphan",
        order_by="Touch.created_at.desc()",
    )


class Contact(Base):
    """A person found through the contact search, or saved by hand."""

    __tablename__ = "contacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    prospect_id: Mapped[int] = mapped_column(
        ForeignKey("prospects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[Optional[str]] = mapped_column(String(200))
    email: Mapped[Optional[str]] = mapped_column(String(320))
    email_status: Mapped[str] = mapped_column(String(24), nullable=False, default="none")
    phone: Mapped[Optional[str]] = mapped_column(String(60))
    instagram: Mapped[Optional[str]] = mapped_column(String(200))
    linkedin_url: Mapped[Optional[str]] = mapped_column(String(400))
    source_url: Mapped[Optional[str]] = mapped_column(String(600))
    confidence: Mapped[str] = mapped_column(String(16), nullable=False, default="low")
    reasoning: Mapped[Optional[str]] = mapped_column(Text)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    found_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    prospect: Mapped["Prospect"] = relationship(back_populates="contacts")
    touches: Mapped[list["Touch"]] = relationship(
        back_populates="contact", order_by="Touch.created_at.desc()"
    )


TOUCH_KINDS = ("sent", "reply", "call", "note")


class Touch(Base):
    """One logged interaction with a gym, usually with a specific contact."""

    __tablename__ = "touches"

    id: Mapped[int] = mapped_column(primary_key=True)
    prospect_id: Mapped[int] = mapped_column(
        ForeignKey("prospects.id", ondelete="CASCADE"), index=True
    )
    contact_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    kind: Mapped[str] = mapped_column(String(16))
    body: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    prospect: Mapped["Prospect"] = relationship(back_populates="touches")
    contact: Mapped[Optional["Contact"]] = relationship(back_populates="touches")


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    prospect_id: Mapped[int] = mapped_column(ForeignKey("prospects.id"), index=True)
    kind: Mapped[str] = mapped_column(String(30))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    prospect: Mapped["Prospect"] = relationship(back_populates="activities")


class Settings(Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    weight_fit: Mapped[float] = mapped_column(Float, default=30)
    weight_size: Mapped[float] = mapped_column(Float, default=25)
    weight_demo: Mapped[float] = mapped_column(Float, default=20)
    weight_location: Mapped[float] = mapped_column(Float, default=15)
    weight_ease: Mapped[float] = mapped_column(Float, default=10)
    adoption_pct: Mapped[float] = mapped_column(Float, default=8)
    bottles_per_week: Mapped[float] = mapped_column(Float, default=3)
    margin_per_bottle: Mapped[float] = mapped_column(Float, default=1.2)
