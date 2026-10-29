"""Contact endpoints: the web-search lookup and saving a chosen contact."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import update
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Contact, Prospect
from ..schemas import ContactIn, ContactOut, FindContactResponse
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
    return contact
