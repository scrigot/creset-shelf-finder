"""Turn a prospect into a web-search prompt, then clean up what comes back.

Two jobs live here: build the instructions that make the LLM search the right
sources for the right person, and enforce the email rules on the returned
candidates so a guessed address can never look like a verified one.
"""

import re
from datetime import date
from typing import Any, Optional

from ..models import Prospect
from ..schemas import CONFIDENCES, EMAIL_STATUSES
from . import llm

# Prospect types are the pipeline's own labels ("strength", "crossfit", ...).
TYPE_LABELS = {
    "strength": "Independent strength gym",
    "crossfit": "CrossFit box",
    "boutique": "Boutique studio",
    "big-box": "Big-box gym",
    "yoga/spin": "Yoga and spin studio",
    "campus rec": "Campus recreation centre",
    "run club": "Run club",
}

INDEPENDENT_RULE = (
    "Independent strength gym. Target the owner first, then the head coach — "
    "they decide what is stocked and buy it themselves."
)
CROSSFIT_RULE = (
    "CrossFit box. Target the box owner first, then the head coach — "
    "they decide what is stocked and buy it themselves."
)
BOUTIQUE_RULE = (
    "Boutique studio or franchise (Orangetheory, F45, Planet Fitness, and the like). "
    "Target the franchise owner or the general manager, not a corporate inbox. "
    "Note in the reasoning when corporate or franchise approval is likely required "
    "before a product reaches the shelf."
)
CAMPUS_RULE = (
    "Campus recreation centre. Target the retail manager or the operations manager "
    "who owns concessions and pro-shop purchasing."
)
RUN_CLUB_RULE = (
    "Run club. Target the club organizer, or the store that hosts the run club and "
    "handles its retail."
)
DEFAULT_RULE = "Find the person who decides what drinks and supplements the gym stocks."

TYPE_RULES = {
    "strength": INDEPENDENT_RULE,
    "crossfit": CROSSFIT_RULE,
    "boutique": BOUTIQUE_RULE,
    "big-box": BOUTIQUE_RULE,
    "yoga/spin": BOUTIQUE_RULE,
    "campus rec": CAMPUS_RULE,
    "run club": RUN_CLUB_RULE,
}

EMAIL_STATUS_ALIASES = {
    "verified": "verified",
    "listed publicly": "listed_publicly",
    "listed_publicly": "listed_publicly",
    "listed": "listed_publicly",
    "published": "listed_publicly",
    "guessed": "guessed",
    "pattern": "guessed",
    "none": "none",
    "not found": "none",
    "unknown": "none",
}

CONFIDENCE_ALIASES = {
    "high": "high",
    "medium": "medium",
    "med": "medium",
    "low": "low",
}

EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")
CITATION_TOKEN_RE = re.compile(r"^turn(\d+)search(\d+)$")
# Models often copy typographic hyphens out of web pages; they break addresses and URLs.
TYPOGRAPHIC_DASHES = "\u2010\u2011\u2012\u2013\u2014\u2015\u2212"
MAX_CANDIDATES = 3

CANDIDATE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["candidates"],
    "properties": {
        "candidates": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "name",
                    "role",
                    "email",
                    "email_status",
                    "phone",
                    "instagram",
                    "linkedin_url",
                    "source_url",
                    "confidence",
                    "reasoning",
                ],
                "properties": {
                    "name": {"type": "string"},
                    "role": {"type": "string"},
                    "email": {"type": ["string", "null"]},
                    "email_status": {
                        "type": "string",
                        "enum": ["verified", "listed_publicly", "guessed", "none"],
                    },
                    "phone": {"type": ["string", "null"]},
                    "instagram": {"type": ["string", "null"]},
                    "linkedin_url": {"type": ["string", "null"]},
                    "source_url": {
                        "type": ["string", "null"],
                        "description": "Full https URL of the page where this person was found",
                    },
                    "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
                    "reasoning": {"type": "string"},
                },
            },
        }
    },
}

SYSTEM_PROMPT = """You are a research assistant for Crest, a small brand that sells \
shelf-ready functional drinks and supplements to gyms. Your job is to find the one \
person at a gym who decides which drinks and supplements the gym stocks.

Use the web search tool. Check the gym's own website (About, Team and Contact pages), \
its Google Business listing, its Instagram bio, LinkedIn, and local news or press. \
Open the pages you cite; do not rely on memory or on the first search snippet.

Rules you must never break:
- Never invent a person, a role, an email address or a phone number.
- Never invent an email address. If no email is published, return the gym's general \
email or contact form address and mark email_status "listed_publicly" (or "none" if \
you only have a contact form).
- A guessed address pattern (for example first@domain.com) is allowed only when you \
mark email_status "guessed" and confidence "low".
- Every candidate needs the full https:// URL of the page where you found them in \
source_url. Never put a citation marker such as turn0search1 there.
- Only return people you actually found. Fewer than three real candidates is a good \
answer; an empty list is better than a made-up person.
- Rank the candidates best first: the person most likely to control drinks and \
supplement purchasing goes first.

Answer with JSON that matches the provided schema and nothing else."""


def type_label(prospect: Prospect) -> str:
    return TYPE_LABELS.get(prospect.type) or prospect.type.replace("_", " ")


def type_rule(prospect: Prospect) -> str:
    return TYPE_RULES.get(prospect.type, DEFAULT_RULE)


def build_user_prompt(prospect: Prospect) -> str:
    lines = [
        f"Today's date: {date.today().isoformat()}.",
        "",
        "Gym to research:",
        f"- Name: {prospect.name}",
        f"- Type: {type_label(prospect)}",
        f"- Address: {prospect.address or 'not provided'}",
        f"- Website: {prospect.website or 'not provided'}",
    ]
    if prospect.instagram:
        lines.append(f"- Instagram: {prospect.instagram}")
    lines += [
        "",
        "Who to look for:",
        type_rule(prospect),
        "",
        "Return up to three candidates, best first. For each candidate fill every field: "
        "name, role, email, email_status, phone, instagram, linkedin_url, source_url, "
        "confidence and reasoning. Keep reasoning to one sentence a salesperson can read "
        "at a glance. If the gym is part of a franchise or corporate group, say so in the "
        "reasoning when approval may be needed above the store.",
    ]
    return "\n".join(lines)


def search_contacts(prospect: Prospect) -> list[dict]:
    """Ask the LLM for candidates and return normalized, validated contact dicts."""
    result = llm.responses_json(
        system=SYSTEM_PROMPT,
        user=build_user_prompt(prospect),
        schema=CANDIDATE_SCHEMA,
        schema_name="contact_candidates",
    )
    return normalize_candidates(result.data, search_sources=result.search_sources)


def resolve_source_url(
    value: Optional[str], search_sources: Optional[list[list[str]]]
) -> Optional[str]:
    """Turn a full URL, or a `turn1search4` citation token, into a real link."""
    if not value:
        return None
    if value.startswith(("http://", "https://")):
        return value
    match = CITATION_TOKEN_RE.match(value.strip())
    if not match or not search_sources:
        return None
    turn, index = int(match.group(1)), int(match.group(2))
    if turn < len(search_sources) and index < len(search_sources[turn]):
        return search_sources[turn][index]
    return None


def normalize_candidates(
    data: Any, search_sources: Optional[list[list[str]]] = None
) -> list[dict]:
    """Coerce the model's output into valid Contact payloads, enforcing email rules."""
    if isinstance(data, dict):
        items = data.get("candidates")
    else:
        items = data
    if not isinstance(items, list):
        return []

    cleaned: list[dict] = []
    seen: set[str] = set()
    for item in items:
        if not isinstance(item, dict):
            continue
        name = _clean(item.get("name"))
        if not name:
            continue
        key = name.casefold()
        if key in seen:
            continue

        email = _clean(item.get("email"))
        if email and not EMAIL_RE.match(email):
            email = None

        status = EMAIL_STATUS_ALIASES.get(
            (_clean(item.get("email_status")) or "none").lower().replace("-", "_"),
            "none",
        )
        if email and status == "none":
            # An address we actually found on the web is a published address.
            status = "listed_publicly"
        if not email:
            status = "none"

        confidence = CONFIDENCE_ALIASES.get(
            (_clean(item.get("confidence")) or "low").lower(), "low"
        )
        if status == "guessed":
            # A pattern guess can never be better than a low-confidence lead.
            confidence = "low"

        cleaned.append(
            {
                "name": name[:200],
                "role": _clean(item.get("role"), 200),
                "email": email,
                "email_status": status if status in EMAIL_STATUSES else "none",
                "phone": _clean(item.get("phone"), 60),
                "instagram": _clean(item.get("instagram"), 200),
                "linkedin_url": _clean(item.get("linkedin_url"), 400),
                "source_url": resolve_source_url(
                    _clean(item.get("source_url"), 600), search_sources
                ),
                "confidence": confidence if confidence in CONFIDENCES else "low",
                "reasoning": _clean(item.get("reasoning"), 400),
                "is_primary": False,
            }
        )
        seen.add(key)
        if len(cleaned) >= MAX_CANDIDATES:
            break
    return cleaned


def _clean(value: Any, limit: Optional[int] = None) -> Optional[str]:
    if value is None:
        return None
    text = str(value)
    for dash in TYPOGRAPHIC_DASHES:
        text = text.replace(dash, "-")
    text = re.sub(r"\s+", " ", text).strip()
    if not text or text.lower() in {"null", "none", "n/a", "unknown"}:
        return None
    return text[:limit] if limit else text
