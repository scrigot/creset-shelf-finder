from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Prospect(Base):
    """A gym (or run club) that could stock Crest drinks and supplements."""

    __tablename__ = "prospects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    gym_type: Mapped[str] = mapped_column(
        String(40), nullable=False, default="independent_strength"
    )
    address: Mapped[Optional[str]] = mapped_column(String(400))
    website: Mapped[Optional[str]] = mapped_column(String(400))
    instagram: Mapped[Optional[str]] = mapped_column(String(200))
    score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    contacts: Mapped[list["Contact"]] = relationship(
        back_populates="prospect", cascade="all, delete-orphan"
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

    prospect: Mapped[Prospect] = relationship(back_populates="contacts")
