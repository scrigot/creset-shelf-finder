from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from .db import Base, SessionLocal, engine, wait_for_db
from .models import Activity, Prospect, Settings
from .outreach import draft_outreach
from .routers import contacts
from .routers.contacts import primary_contact, sorted_contacts
from .schemas import (
    ActivityCreate,
    ActivityOut,
    ContactOut,
    DraftOut,
    FollowUpIn,
    ProspectDetail,
    ProspectOut,
    ProspectUpdate,
    SettingsOut,
    SettingsUpdate,
)
from .seed import seed


@asynccontextmanager
async def lifespan(_: FastAPI):
    wait_for_db()
    Base.metadata.create_all(bind=engine)
    seed()
    yield


app = FastAPI(title="Crest Shelf Finder API", lifespan=lifespan)
app.include_router(contacts.router)


def get_settings(session) -> Settings:
    settings = session.get(Settings, 1)
    if settings is None:
        settings = Settings(id=1)
        session.add(settings)
        session.commit()
    return settings


def get_prospect(session, prospect_id: int) -> Prospect:
    # Activities and contacts must be loaded before the session closes; the
    # response is serialised after this function returns.
    prospect = session.scalars(
        select(Prospect)
        .where(Prospect.id == prospect_id)
        .options(
            selectinload(Prospect.activities),
            selectinload(Prospect.contacts),
        )
        .execution_options(populate_existing=True)
    ).first()
    if prospect is None:
        raise HTTPException(status_code=404, detail="Prospect not found")
    return prospect


@app.get("/api/health")
def health() -> dict:
    with engine.connect() as conn:
        conn.execute(select(1))
    return {"status": "ok"}


@app.get("/api/prospects", response_model=list[ProspectOut])
def list_prospects():
    with SessionLocal() as session:
        rows = session.scalars(
            select(Prospect)
            .order_by(Prospect.name)
            .options(selectinload(Prospect.contacts))
        ).all()
        out = []
        for prospect in rows:
            item = ProspectOut.model_validate(prospect)
            primary = primary_contact(prospect)
            item.primary_contact = ContactOut.model_validate(primary) if primary else None
            out.append(item)
        return out


@app.get("/api/prospects/{prospect_id}", response_model=ProspectDetail)
def get_prospect_detail(prospect_id: int):
    with SessionLocal() as session:
        prospect = get_prospect(session, prospect_id)
        detail = ProspectDetail.model_validate(prospect)
        detail.contacts = [
            ContactOut.model_validate(contact) for contact in sorted_contacts(prospect)
        ]
        return detail


@app.patch("/api/prospects/{prospect_id}", response_model=ProspectDetail)
def update_prospect(prospect_id: int, payload: ProspectUpdate):
    with SessionLocal() as session:
        prospect = get_prospect(session, prospect_id)
        data = payload.model_dump(exclude_unset=True)
        if "stage" in data and data["stage"] != prospect.stage:
            session.add(
                Activity(
                    prospect_id=prospect.id,
                    kind="stage",
                    body=f"Stage {prospect.stage} → {data['stage']}",
                )
            )
        for field, value in data.items():
            setattr(prospect, field, value)
        session.commit()
        session.expire_all()
        return get_prospect(session, prospect_id)


@app.post("/api/prospects/{prospect_id}/activities", response_model=ActivityOut, status_code=201)
def add_activity(prospect_id: int, payload: ActivityCreate):
    with SessionLocal() as session:
        prospect = get_prospect(session, prospect_id)
        activity = Activity(prospect_id=prospect.id, kind=payload.kind, body=payload.body)
        session.add(activity)
        session.commit()
        session.refresh(activity)
        return activity


@app.post("/api/prospects/{prospect_id}/follow-up", response_model=ProspectDetail)
def log_follow_up(prospect_id: int, payload: FollowUpIn):
    with SessionLocal() as session:
        prospect = get_prospect(session, prospect_id)
        prospect.next_action = payload.next_action
        prospect.next_action_date = payload.next_action_date
        note = payload.note.strip()
        session.add(
            Activity(
                prospect_id=prospect.id,
                kind="follow-up",
                body=(
                    f"Follow-up set: {payload.next_action} on "
                    f"{payload.next_action_date.isoformat()}"
                    + (f" — {note}" if note else "")
                ),
            )
        )
        session.commit()
        session.expire_all()
        return get_prospect(session, prospect_id)


@app.post("/api/prospects/{prospect_id}/draft-outreach", response_model=DraftOut)
def create_draft(prospect_id: int):
    with SessionLocal() as session:
        prospect = get_prospect(session, prospect_id)
        contact = primary_contact(prospect)
        subject, body, source = draft_outreach(prospect, contact)
        session.add(
            Activity(
                prospect_id=prospect.id,
                kind="draft",
                body=f"Outreach drafted ({source}) · {subject}",
            )
        )
        session.commit()
        return DraftOut(
            to=(contact.email or "") if contact else "",
            subject=subject,
            body=body,
            source=source,
            contact_id=contact.id if contact else None,
        )


@app.get("/api/settings", response_model=SettingsOut)
def read_settings():
    with SessionLocal() as session:
        return get_settings(session)


@app.put("/api/settings", response_model=SettingsOut)
def update_settings(payload: SettingsUpdate):
    with SessionLocal() as session:
        settings = get_settings(session)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(settings, field, value)
        session.commit()
        session.refresh(settings)
        return settings
