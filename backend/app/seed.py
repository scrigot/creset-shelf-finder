import json
import os
from pathlib import Path
from urllib.parse import urlparse

from sqlalchemy import select

from .db import SessionLocal
from .models import Activity, Contact, Prospect, Settings

# 100 real gyms within ~20 miles of UNC and the people named on their public
# pages, gathered with Exa web research. Membership and demographics are
# type-based estimates (see each gym's notes); emails are only ones published.
GYMS_FILE = Path(__file__).with_name("seed_gyms.json")

CONTACT_FIELDS = ("name", "role", "email", "linkedin_url", "source_url")


def seed() -> None:
    """Populate the pipeline the first time the database is empty."""
    if os.environ.get("SEED_DEMO_DATA", "1") != "1":
        return
    with SessionLocal() as session:
        if session.scalars(select(Prospect).limit(1)).first() is not None:
            return

        for gym in json.loads(GYMS_FILE.read_text()):
            people = gym.pop("contacts")
            prospect = Prospect(**gym, stage="Not contacted", warm_intro="", next_action="")
            session.add(prospect)
            session.flush()
            session.add(
                Activity(prospect_id=prospect.id, kind="system", body="Added to pipeline · stage Not contacted")
            )
            for index, person in enumerate(people):
                source = person.get("source_url")
                session.add(
                    Contact(
                        prospect_id=prospect.id,
                        **{field: person.get(field) for field in CONTACT_FIELDS},
                        email_status="listed_publicly" if person.get("email") else "none",
                        confidence="high" if person.get("email") else "medium",
                        reasoning=f"Named on {urlparse(source).netloc}." if source else None,
                        is_primary=index == 0,
                    )
                )

        session.add(Settings(id=1))
        session.commit()
