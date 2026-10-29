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
def prospect():
    with SessionLocal() as db:
        item = Prospect(
            name="Barbell Union",
            gym_type="independent_strength",
            address="1408 E 6th St, Austin, TX",
            website="https://barbellunion.example",
            instagram="@barbellunion",
            score=94,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
    return item
