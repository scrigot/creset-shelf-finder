import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from .db import Base, SessionLocal, engine
from .routers import prospects
from .seed import seed_if_empty


def _wait_for_db(attempts: int = 30) -> None:
    for remaining in range(attempts, 0, -1):
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            return
        except OperationalError:
            if remaining == 1:
                raise
            time.sleep(1)


@asynccontextmanager
async def lifespan(_: FastAPI):
    _wait_for_db()
    Base.metadata.create_all(engine)
    if os.environ.get("SEED_DEMO_DATA", "1") == "1":
        with SessionLocal() as db:
            seed_if_empty(db)
    yield


app = FastAPI(title="Crest Shelf Finder API", lifespan=lifespan)
app.include_router(prospects.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
