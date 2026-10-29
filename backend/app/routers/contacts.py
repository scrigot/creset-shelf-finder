"""Contact endpoints: the web-search lookup, contact CRUD and logged touches."""

from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..models import Activity, Contact, Prospect, Touch
from ..schemas import (
    ContactIn,
    ContactOut,
    ContactUpdate,
    FindContactResponse,
    PersonOut,
    TouchIn,
    TouchOut,
)
from ..services import contact_search, llm

router = APIRouter(prefix="/api", tags=["contacts"])

CONFIDENCE_ORDER = {"high": 0, "medium": 1, "low": 2}


def sorted_contacts(prospect: Prospect) -> list[Contact]:
    """Primary first, then by confidence, newest first."""
    return sorted(
        prospect.contacts,
        key=lambda contact: (
            not contact.is_primary,
            CONFIDENCE_ORDER.get(contact.confidence, 9),
            -contact.found_at.timestamp(),
        ),
    )


def primary_contact(prospect: Prospect) -> Optional[Contact]:
    contacts = sorted_contacts(prospect)
    return contacts[0] if contacts else None


def contact_out(contact: Contact, model=ContactOut, **extra):
    """Serialise a contact with its touch stats (touches are newest first)."""
    out = model.model_validate({**ContactOut.model_validate(contact).model_dump(), **extra})
    if contact.touches:
        out.touch_count = len(contact.touches)
        out.last_touch_at = contact.touches[0].created_at
        out.last_touch_kind = contact.touches[0].kind
    return out


def first_name(contact: Optional[Contact]) -> str:
    return contact.name.split()[0] if contact and contact.name.strip() else "the team"


def _get_prospect(db: Session, prospect_id: int) -> Prospect:
    prospect = db.get(Prospect, prospect_id)
    if prospect is None:
        raise HTTPException(status_code=404, detail="Prospect not found")
    return prospect


@router.post("/prospects/{prospect_id}/find-contact", response_model=FindContactResponse)
def find_contact(prospect_id: int, db: Session = Depends(get_db)):
    prospect = _get_prospect(db, prospect_id)
    try:
        candidates = contact_search.search_contacts(prospect)
    except llm.LLMNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except llm.LLMError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return FindContactResponse(
        candidates=[ContactIn(**candidate) for candidate in candidates],
        searched_at=datetime.now(timezone.utc),
        model=llm.model_name(),
    )


@router.post(
    "/prospects/{prospect_id}/contacts", response_model=ContactOut, status_code=201
)
def save_contact(prospect_id: int, payload: ContactIn, db: Session = Depends(get_db)):
    _get_prospect(db, prospect_id)
    data = payload.model_dump()
    is_primary = data.pop("is_primary", True)
    if is_primary:
        db.execute(
            update(Contact)
            .where(Contact.prospect_id == prospect_id)
            .values(is_primary=False)
        )
    contact = Contact(
        prospect_id=prospect_id,
        is_primary=is_primary,
        found_at=datetime.now(timezone.utc),
        **data,
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact_out(contact)


@router.get("/contacts", response_model=list[PersonOut])
def list_contacts(db: Session = Depends(get_db)):
    contacts = db.scalars(
        select(Contact).options(selectinload(Contact.prospect), selectinload(Contact.touches))
    ).all()
    return [
        contact_out(
            contact,
            PersonOut,
            prospect_name=contact.prospect.name,
            prospect_type=contact.prospect.type,
            prospect_stage=contact.prospect.stage,
        )
        for contact in sorted(contacts, key=lambda c: (c.prospect.name, not c.is_primary, c.name))
    ]


def _get_contact(db: Session, contact_id: int) -> Contact:
    contact = db.get(Contact, contact_id)
    if contact is None:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact


@router.patch("/contacts/{contact_id}", response_model=ContactOut)
def update_contact(contact_id: int, payload: ContactUpdate, db: Session = Depends(get_db)):
    contact = _get_contact(db, contact_id)
    data = payload.model_dump(exclude_unset=True)
    if data.get("is_primary"):
        db.execute(
            update(Contact)
            .where(Contact.prospect_id == contact.prospect_id)
            .values(is_primary=False)
        )
    for field, value in data.items():
        setattr(contact, field, value)
    db.commit()
    db.refresh(contact)
    return contact_out(contact)


@router.delete("/contacts/{contact_id}", status_code=204)
def delete_contact(contact_id: int, db: Session = Depends(get_db)):
    contact = _get_contact(db, contact_id)
    db.delete(contact)
    db.commit()
    return Response(status_code=204)


@router.post("/prospects/{prospect_id}/touches", response_model=TouchOut, status_code=201)
def log_touch(prospect_id: int, payload: TouchIn, db: Session = Depends(get_db)):
    """Log an interaction. "sent" moves a new gym to Reached out and schedules the
    follow-up; "reply" puts answering it on today's list."""
    prospect = _get_prospect(db, prospect_id)
    contact = None
    if payload.contact_id is not None:
        contact = _get_contact(db, payload.contact_id)
        if contact.prospect_id != prospect.id:
            raise HTTPException(status_code=400, detail="Contact belongs to another prospect")

    who = contact.name if contact else "the gym"
    label = {"sent": "Email sent to", "reply": "Reply from", "call": "Call with", "note": "Note on"}
    summary = f"{label[payload.kind]} {who}" + (f" · {payload.body}" if payload.body else "")

    if payload.kind == "sent":
        if prospect.stage == "Not contacted":
            db.add(Activity(prospect_id=prospect.id, kind="stage", body="Stage Not contacted → Reached out"))
            prospect.stage = "Reached out"
        prospect.next_action = f"Follow up with {first_name(contact)}"
        prospect.next_action_date = date.today() + timedelta(days=payload.follow_up_days)
    elif payload.kind == "reply":
        prospect.next_action = f"Reply to {first_name(contact)}"
        prospect.next_action_date = date.today()

    touch = Touch(prospect_id=prospect.id, contact_id=contact.id if contact else None,
                  kind=payload.kind, body=payload.body)
    db.add(touch)
    db.add(Activity(prospect_id=prospect.id, kind=payload.kind, body=summary))
    db.commit()
    db.refresh(touch)
    return touch
