import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from .db import Base, SessionLocal, engine, wait_for_db
from .models import Activity, Contact, Prospect, Secret, Settings
from .outreach import draft_outreach
from .routers import contacts
from .services import llm
from .routers.contacts import contact_out, primary_contact, sorted_contacts
from .schemas import (
    ActivityCreate,
    ActivityOut,
    DraftOut,
    FollowUpIn,
    OpenAIKeyIn,
    OpenAIKeyStatus,
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
            selectinload(Prospect.contacts).selectinload(Contact.touches),
            selectinload(Prospect.touches),
        )
        .execution_options(populate_existing=True)
    ).first()
    if prospect is None:
        raise HTTPException(status_code=404, detail="Prospect not found")
    return prospect


def with_contact_stats(model, prospect: Prospect):
    item = model.model_validate(prospect)
    primary = primary_contact(prospect)
    item.primary_contact = contact_out(primary) if primary else None
    item.contact_count = len(prospect.contacts)
    if prospect.touches:
        item.last_touch_at = prospect.touches[0].created_at
        item.last_touch_kind = prospect.touches[0].kind
    if isinstance(item, ProspectDetail):
        item.contacts = [contact_out(contact) for contact in sorted_contacts(prospect)]
    return item


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
            .options(
                selectinload(Prospect.contacts).selectinload(Contact.touches),
                selectinload(Prospect.touches),
            )
        ).all()
        return [with_contact_stats(ProspectOut, prospect) for prospect in rows]


@app.get("/api/prospects/{prospect_id}", response_model=ProspectDetail)
def get_prospect_detail(prospect_id: int):
    with SessionLocal() as session:
        return with_contact_stats(ProspectDetail, get_prospect(session, prospect_id))


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
        return with_contact_stats(ProspectDetail, get_prospect(session, prospect_id))


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
        return with_contact_stats(ProspectDetail, get_prospect(session, prospect_id))


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


def key_status() -> OpenAIKeyStatus:
    saved = llm.saved_key()
    key = saved or (os.environ.get("OPENAI_API_KEY") or "").strip()
    return OpenAIKeyStatus(
        configured=bool(key),
        source=("saved" if saved else "env") if key else None,
        hint=f"…{key[-4:]}" if key else None,
        editable=llm.key_editable(),
    )


@app.get("/api/openai-key", response_model=OpenAIKeyStatus)
def read_openai_key():
    return key_status()


@app.put("/api/openai-key", response_model=OpenAIKeyStatus)
def save_openai_key(payload: OpenAIKeyIn):
    """Save (or, with an empty key, clear) the key. Never echoes it back."""
    if not llm.key_editable():
        raise HTTPException(status_code=403, detail="Set OPENAI_API_KEY on the server for deployed builds.")
    key = payload.key.strip()
    with SessionLocal() as session:
        secret = session.get(Secret, llm.KEY_NAME)
        if key:
            if secret:
                secret.value = key
            else:
                session.add(Secret(name=llm.KEY_NAME, value=key))
        elif secret:
            session.delete(secret)
        session.commit()
    return key_status()


# The production image (./Dockerfile) sets STATIC_DIR to the built Vite bundle so
# the UI and the API share one origin. Development leaves it unset and Vite serves
# the frontend, so this mount only exists in a deployment.
_static_dir = os.environ.get("STATIC_DIR")
if _static_dir and Path(_static_dir).is_dir():
    app.mount("/", StaticFiles(directory=_static_dir, html=True), name="web")
