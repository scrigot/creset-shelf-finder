from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from .db import Base, SessionLocal, engine, wait_for_db
from .models import Item, Shelf
from .schemas import ItemCreate, ItemOut, ShelfOut
from .seed import seed


@asynccontextmanager
async def lifespan(_: FastAPI):
    wait_for_db()
    Base.metadata.create_all(bind=engine)
    seed()
    yield


app = FastAPI(title="Crest Shelf Finder API", lifespan=lifespan)


def to_item_out(item: Item) -> ItemOut:
    return ItemOut(
        id=item.id,
        name=item.name,
        crest=item.crest,
        category=item.category,
        slot=item.slot,
        shelf_id=item.shelf_id,
        shelf_name=item.shelf.name,
        room=item.shelf.room,
    )


@app.get("/api/health")
def health() -> dict:
    with engine.connect() as conn:
        conn.execute(select(1))
    return {"status": "ok"}


@app.get("/api/shelves", response_model=list[ShelfOut])
def list_shelves() -> list[ShelfOut]:
    with SessionLocal() as session:
        counts = dict(
            session.execute(
                select(Item.shelf_id, func.count(Item.id)).group_by(Item.shelf_id)
            ).all()
        )
        shelves = session.scalars(select(Shelf).order_by(Shelf.room, Shelf.name)).all()
        return [
            ShelfOut(
                id=shelf.id,
                name=shelf.name,
                room=shelf.room,
                item_count=counts.get(shelf.id, 0),
            )
            for shelf in shelves
        ]


@app.get("/api/items", response_model=list[ItemOut])
def list_items(q: str = "", shelf_id: int | None = None) -> list[ItemOut]:
    with SessionLocal() as session:
        stmt = (
            select(Item)
            .options(selectinload(Item.shelf))
            .join(Item.shelf)
            .order_by(Shelf.room, Shelf.name, Item.slot, Item.name)
        )
        if shelf_id is not None:
            stmt = stmt.where(Item.shelf_id == shelf_id)
        term = q.strip()
        if term:
            pattern = f"%{term}%"
            stmt = stmt.where(
                or_(
                    Item.name.ilike(pattern),
                    Item.crest.ilike(pattern),
                    Item.category.ilike(pattern),
                    Item.slot.ilike(pattern),
                    Shelf.name.ilike(pattern),
                    Shelf.room.ilike(pattern),
                )
            )
        return [to_item_out(item) for item in session.scalars(stmt).all()]


@app.post("/api/items", response_model=ItemOut, status_code=201)
def create_item(payload: ItemCreate) -> ItemOut:
    with SessionLocal() as session:
        shelf = session.get(Shelf, payload.shelf_id)
        if shelf is None:
            raise HTTPException(status_code=404, detail="Shelf not found")
        item = Item(**payload.model_dump())
        session.add(item)
        session.commit()
        session.refresh(item)
        return to_item_out(item)
