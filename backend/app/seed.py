"""Demo prospects so a fresh install has a ranked table to work with."""

import os

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import Contact, Prospect

DEMO_PROSPECTS = [
    {
        "name": "Barbell Union",
        "gym_type": "independent_strength",
        "address": "1408 E 6th St, Austin, TX",
        "website": "https://barbellunion.example",
        "instagram": "@barbellunion",
        "score": 94,
        "notes": "Powerlifting focus, small pro shop behind the front desk.",
        "contacts": [
            {
                "name": "Marcus Reyes",
                "role": "Owner",
                "email": "marcus@barbellunion.example",
                "email_status": "verified",
                "confidence": "high",
                "reasoning": "Named as owner on the gym's About page with a direct email.",
                "source_url": "https://barbellunion.example/about",
                "is_primary": True,
            }
        ],
    },
    {
        "name": "CrossFit Ironworks",
        "gym_type": "crossfit",
        "address": "2250 NW Quimby St, Portland, OR",
        "website": "https://ironworkscrossfit.example",
        "instagram": "@ironworkscrossfit",
        "score": 88,
        "notes": "Sells drinks from a fridge by the front desk; no supplement wall yet.",
        "contacts": [
            {
                "name": "Dana Whitfield",
                "role": "Head Coach",
                "email": "dana@ironworkscrossfit.example",
                "email_status": "listed_publicly",
                "confidence": "medium",
                "reasoning": "Head coach listed on the Team page, email published on the contact page.",
                "source_url": "https://ironworkscrossfit.example/contact",
                "is_primary": True,
            }
        ],
    },
    {
        "name": "Orangetheory Westgate",
        "gym_type": "boutique_franchise",
        "address": "4712 Westgate Blvd, Austin, TX",
        "website": "https://otfwestgate.example",
        "instagram": "@otfwestgate",
        "score": 84,
        "notes": "Franchise studio; corporate approval likely for new shelf items.",
        "contacts": [
            {
                "name": "Priya Natarajan",
                "role": "Franchise Owner",
                "email": None,
                "email_status": "none",
                "confidence": "medium",
                "reasoning": "Franchise owner named in a local news piece; only the studio contact form is published.",
                "source_url": "https://austin.example/news/otf-westgate-owner",
                "is_primary": True,
            }
        ],
    },
    {
        "name": "F45 Downtown",
        "gym_type": "boutique_franchise",
        "address": "88 Congress Ave, Austin, TX",
        "website": "https://f45downtown.example",
        "instagram": "@f45downtown",
        "score": 79,
        "notes": "High foot traffic; studio manager handles retail orders.",
        "contacts": [
            {
                "name": "Luis Ortega",
                "role": "General Manager",
                "email": "luis@f45downtown.example",
                "email_status": "guessed",
                "confidence": "low",
                "reasoning": "Manager identified on Instagram; address follows the studio's first-name pattern and is unconfirmed.",
                "source_url": "https://instagram.example/f45downtown",
                "is_primary": True,
            }
        ],
    },
    {
        "name": "Lakeview Campus Rec",
        "gym_type": "campus_rec",
        "address": "1200 Lakeview Dr, Madison, WI",
        "website": "https://lakeviewrec.example",
        "instagram": None,
        "score": 76,
        "notes": "Student rec centre with a pro shop and vending contract up for renewal.",
        "contacts": [
            {
                "name": "Alicia Kim",
                "role": "Retail Operations Manager",
                "email": "akim@lakeviewrec.example",
                "email_status": "listed_publicly",
                "confidence": "high",
                "reasoning": "Retail operations manager listed in the rec centre staff directory.",
                "source_url": "https://lakeviewrec.example/staff",
                "is_primary": True,
            }
        ],
    },
    {
        "name": "Riverside Run Club",
        "gym_type": "run_club",
        "address": "Riverfront Park, Nashville, TN",
        "website": "https://riversiderun.example",
        "instagram": "@riversiderun",
        "score": 71,
        "notes": "Club meets at a running store that already stocks hydration.",
        "contacts": [
            {
                "name": "Tom Braddock",
                "role": "Club Organizer",
                "email": "hello@riversiderun.example",
                "email_status": "listed_publicly",
                "confidence": "medium",
                "reasoning": "Organizer named on the club's contact page next to the general club inbox.",
                "source_url": "https://riversiderun.example/contact",
                "is_primary": True,
            }
        ],
    },
    {
        "name": "Forge Athletics",
        "gym_type": "independent_strength",
        "address": "310 Foundry Rd, Denver, CO",
        "website": "https://forgeathletics.example",
        "instagram": "@forgeathletics",
        "score": 68,
        "notes": "Strong free-weight membership; owner also runs a small online store.",
        "contacts": [],
    },
    {
        "name": "Planet Fitness Eastside",
        "gym_type": "boutique_franchise",
        "address": "902 Eastside Market, Columbus, OH",
        "website": "https://pfeastside.example",
        "instagram": None,
        "score": 62,
        "notes": "Franchise location; purchasing runs through the regional office.",
        "contacts": [
            {
                "name": "Sandra Cole",
                "role": "General Manager",
                "email": "scole@pfeastside.example",
                "email_status": "none",
                "confidence": "medium",
                "reasoning": "General manager named on the location page but no email published.",
                "source_url": "https://pfeastside.example/team",
                "is_primary": True,
            }
        ],
    },
    {
        "name": "Peak Performance CrossFit",
        "gym_type": "crossfit",
        "address": "77 Summit Way, Boulder, CO",
        "website": "https://peakperformancecf.example",
        "instagram": "@peakperformancecf",
        "score": 57,
        "notes": "New affiliate, opening a retail corner this quarter.",
        "contacts": [],
    },
]


def seed_if_empty(db: Session) -> None:
    if os.environ.get("SEED_DEMO_DATA", "1") != "1":
        return
    existing = db.scalar(select(func.count()).select_from(Prospect))
    if existing:
        return

    for entry in DEMO_PROSPECTS:
        contacts = entry.pop("contacts", [])
        prospect = Prospect(**entry)
        db.add(prospect)
        db.flush()
        for contact in contacts:
            db.add(Contact(prospect_id=prospect.id, **contact))
    db.commit()
