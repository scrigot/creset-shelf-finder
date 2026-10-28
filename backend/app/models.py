from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class Shelf(Base):
    __tablename__ = "shelves"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    room: Mapped[str] = mapped_column(String(120))

    items: Mapped[list["Item"]] = relationship(
        back_populates="shelf", cascade="all, delete-orphan"
    )


class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    crest: Mapped[str] = mapped_column(String(300), default="")
    category: Mapped[str] = mapped_column(String(80), default="Uncategorised")
    slot: Mapped[str] = mapped_column(String(40), default="")
    shelf_id: Mapped[int] = mapped_column(ForeignKey("shelves.id"))

    shelf: Mapped[Shelf] = relationship(back_populates="items")
