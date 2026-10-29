"""Compose the outreach email for a prospect and its primary contact."""

from typing import Optional

from ..models import Contact, Prospect


def first_name(name: Optional[str]) -> str:
    if not name:
        return ""
    return name.strip().split()[0]


def build_outreach(prospect: Prospect, contact: Optional[Contact]) -> dict:
    first = first_name(contact.name) if contact else ""
    role = (contact.role or "").strip() if contact else ""
    gym = prospect.name

    if contact and first:
        greeting = f"Hi {first},"
        role_line = (
            f"As the {role} at {gym}, you're the person who decides which drinks and "
            "supplements make it onto the shelf — so I wanted to reach you directly."
            if role
            else f"You're the person who decides which drinks and supplements make it "
            f"onto the shelf at {gym} — so I wanted to reach you directly."
        )
        subject = f"Crest drinks & supplements for {gym}"
    else:
        greeting = f"Hi {gym} team,"
        role_line = (
            "I'm writing to whoever decides which drinks and supplements make it onto "
            f"the shelf at {gym}."
        )
        subject = f"Crest drinks & supplements for {gym}"

    body = "\n".join(
        [
            greeting,
            "",
            "I'm reaching out from Crest. " + role_line,
            "",
            "We make a small line of shelf-ready functional drinks and supplements for "
            "people who train, and we're looking for a handful of gyms to stock a first "
            f"set with. I think {gym} would be a good fit for it.",
            "",
            f"Would 15 minutes be worth it to see whether a starter set makes sense for {gym}?",
            "",
            "Best,",
            "The Crest team",
        ]
    )

    return {
        "to": (contact.email or "") if contact else "",
        "subject": subject,
        "body": body,
        "contact_id": contact.id if contact else None,
    }
