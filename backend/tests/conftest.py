import os
import pathlib
import sys

TMP_DB = pathlib.Path("/tmp/crest_test.db")
if TMP_DB.exists():
    TMP_DB.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{TMP_DB}"
os.environ["SEED_DEMO_DATA"] = "0"
os.environ["OPENAI_MODEL"] = "gpt-test"
os.environ.pop("OPENAI_API_KEY", None)

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Prospect  # noqa: E402


@pytest.fixture(autouse=True)
def clean_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def prospect_factory():
    """Create a pipeline prospect with every required field filled in."""

    def make(**overrides):
        data = {
            "name": "Barbell Union",
            "type": "strength",
            "address": "1408 E 6th St, Austin, TX",
            "website": "https://barbellunion.example",
            "instagram": "@barbellunion",
            "distance_miles": 1.2,
            "members": 320,
            "pct_18_34": 74,
            "pct_women": 41,
            "athlete_focus": "high",
            "has_drink_fridge": True,
            "sells_supplements": True,
            "warm_intro": "",
            "stage": "Not contacted",
            "next_action": "",
            "next_action_date": None,
            "notes": "",
            "lat": 35.91,
            "lng": -79.05,
        }
        data.update(overrides)
        with SessionLocal() as db:
            item = Prospect(**data)
            db.add(item)
            db.commit()
            db.refresh(item)
        return item

    return make


@pytest.fixture
def prospect(prospect_factory):
    return prospect_factory()
