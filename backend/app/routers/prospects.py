"""Prospect endpoints: the ranked table, the detail page, and Find contact."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Contact, Prospect
from ..schemas import (
    ContactIn,
    ContactOut,
    FindContactResponse,
    OutreachDraft,
    ProspectDetail,
    ProspectListItem,
)
from ..services import contact_search, llm, outreach

router = APIRouter(prefix="/api", tags=["prospects"])

CONFIDENCE_ORDER = {"high": 0, "medium": 1, "low": 2}


def _get_prospect(db: Session, prospect_id: int) -> Prospect:
    prospect = db.get(Prospect, prospect_id)
    if prospect is None:
        raise HTTPException(status_code=404, detail="Prospect not found")
    return prospect


def _sorted_contacts(prospect: Prospect) -> list[Contact]:
    return sorted(
        prospect.contacts,
        key=lambda contact: (
            not contact.is_primary,
            CONFIDENCE_ORDER.get(contact.confidence, 9),
            -contact.found_at.timestamp(),
        ),
    )


def _primary_contact(prospect: Prospect) -> Optional[Contact]:
    contacts = _sorted_contacts(prospect)
    return contacts[0] if contacts else None


@router.get("/prospects", response_model=list[ProspectListItem])
def list_prospects(db: Session = Depends(get_db)):
    prospects = list(
        db.scalars(select(Prospect).order_by(Prospect.score.desc(), Prospect.name.asc()))
    )
    items = []
    for index, prospect in enumerate(prospects, start=1):
        item = ProspectListItem.model_validate(prospect)
        item.rank = index
        primary = _primary_contact(prospect)
        item.primary_contact = ContactOut.model_validate(primary) if primary else None
        items.append(item)
    return items


@router.get("/prospects/{prospect_id}", response_model=ProspectDetail)
def get_prospect(prospect_id: int, db: Session = Depends(get_db)):
    prospect = _get_prospect(db, prospect_id)
    detail = ProspectDetail.model_validate(prospect)
    detail.contacts = [ContactOut.model_validate(c) for c in _sorted_contacts(prospect)]
    return detail


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


@router.post("/prospects/{prospect_id}/outreach-draft", response_model=OutreachDraft)
def outreach_draft(prospect_id: int, db: Session = Depends(get_db)):
    prospect = _get_prospect(db, prospect_id)
    contact = _primary_contact(prospect)
    return OutreachDraft(**outreach.build_outreach(prospect, contact))
