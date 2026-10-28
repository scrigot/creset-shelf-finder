from datetime import date, datetime

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


class Prospect(Base):
    __tablename__ = "prospects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    type: Mapped[str] = mapped_column(String(40))
    address: Mapped[str] = mapped_column(String(200))
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


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    prospect_id: Mapped[int] = mapped_column(ForeignKey("prospects.id"), index=True)
    kind: Mapped[str] = mapped_column(String(30))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    prospect: Mapped[Prospect] = relationship(back_populates="activities")


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
