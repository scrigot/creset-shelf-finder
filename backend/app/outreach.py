import json
import os
import urllib.request

TYPE_LABEL = {
    "strength": "strength gym",
    "crossfit": "CrossFit box",
    "boutique": "boutique studio",
    "big-box": "big-box gym",
    "run club": "run club",
    "campus rec": "campus rec center",
    "yoga/spin": "yoga and spin studio",
}

BRAND = "Creset"


def _first_name(name) -> str:
    if not name:
        return ""
    return name.strip().split()[0]


def _greeting(prospect, contact) -> str:
    first = _first_name(contact.name) if contact else ""
    return f"Hi {first}," if first else f"Hi {prospect.name} team,"


def _role_line(prospect, contact) -> str:
    """Open with why this person was picked, when we know who they are."""
    if not contact:
        return ""
    role = (contact.role or "").strip()
    if role:
        return (
            f"As the {role} at {prospect.name}, you're the person who decides which drinks "
            "and supplements make it onto the shelf — so I wanted to reach you directly.\n\n"
        )
    return (
        "You're the person who decides which drinks and supplements make it onto the "
        f"shelf at {prospect.name} — so I wanted to reach you directly.\n\n"
    )


def _template(prospect, contact) -> tuple[str, str]:
    label = TYPE_LABEL.get(prospect.type, prospect.type)
    subject = f"{BRAND} + {prospect.name}: creatine water for your members"
    intro_line = f" — {prospect.warm_intro}" if prospect.warm_intro else ""
    body = (
        f"{_greeting(prospect, contact)}\n\n"
        f"{_role_line(prospect, contact)}"
        f"I'm with {BRAND}, a creatine water built for people who train hard and want "
        f"hydration that pulls double duty. One bottle carries a full 5g dose, with no "
        f"shaker, no powder, no aftertaste.\n\n"
        f"{prospect.name} is a {label}, "
        f"which is close to the profile we do best with: high-frequency training, "
        f"members who already buy supplements, and a front desk that sees them daily."
        f"{intro_line}\n\n"
        f"Would a short sample drop be useful? I can bring a case for the fridge or "
        f"front desk so your members can try it before you decide anything. "
        f"Fifteen minutes, at a time that suits your class schedule.\n\n"
        f"Worth a look?\n\n"
        f"— {BRAND} team\n"
        f"chapel hill · durham"
    )
    return subject, body


def _llm(api_key: str, prospect, contact) -> tuple[str, str]:
    label = TYPE_LABEL.get(prospect.type, prospect.type)
    person = ""
    if contact:
        person = (
            f"Address {contact.name}"
            + (f", {contact.role}" if contact.role else "")
            + " by first name and mention their role, because they decide what the gym "
            "stocks. "
        )
    prompt = (
        f"Write a short, plain-spoken outreach email (max 130 words) from {BRAND}, a "
        f"creatine water brand, to {prospect.name}, a {label} in {prospect.address} "
        f"{prospect.distance_miles} miles from UNC Chapel Hill. Mention its gym type "
        f"naturally; do not state a member count. {person}"
        f"If a warm intro is given, use it: {prospect.warm_intro or 'none'}. End with a low-"
        f"pressure ask for a sample drop. No hype, no emoji. Return JSON with keys "
        f"'subject' and 'body'."
    )
    payload = json.dumps(
        {
            "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
            "messages": [{"role": "user", "content": prompt}],
            "response_format": {"type": "json_object"},
            "temperature": 0.7,
        }
    ).encode()
    request = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=25) as response:
        data = json.loads(response.read())
    parsed = json.loads(data["choices"][0]["message"]["content"])
    return parsed["subject"], parsed["body"]


def draft_outreach(prospect, contact=None) -> tuple[str, str, str]:
    """Return (subject, body, source). Falls back to a written template without a key."""
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if api_key:
        try:
            subject, body = _llm(api_key, prospect, contact)
            return subject, body, "ai"
        except Exception:
            pass
    subject, body = _template(prospect, contact)
    return subject, body, "template"
