import json
import os
import urllib.request

TYPE_LABEL = {
    "strength": "strength gym",
    "crossfit": "CrossFit box",
    "boutique": "boutique studio",
    "big-box": "big-box gym",
    "run club": "run club",
    "campus rec": "campus rec centre",
    "yoga/spin": "yoga and spin studio",
}

BRAND = "Creset"


def _template(prospect) -> tuple[str, str]:
    label = TYPE_LABEL.get(prospect.type, prospect.type)
    members = prospect.members
    subject = f"{BRAND} + {prospect.name}: creatine water for your {members} members"
    intro_line = (
        f" — {prospect.warm_intro}" if prospect.warm_intro else ""
    )
    body = (
        f"Hi {prospect.name} team,\n\n"
        f"I'm with {BRAND}, a creatine water built for people who train hard and want "
        f"hydration that pulls double duty. One bottle carries a full 5g dose, with no "
        f"shaker, no powder, no aftertaste.\n\n"
        f"I noticed {prospect.name} runs as a {label} with about {members} members, "
        f"which is close to the profile we do best with: high-frequency training, "
        f"members who already buy supplements, and a front desk that sees them daily."
        f"{intro_line}\n\n"
        f"Would a short sample drop be useful? I can bring a case for the fridge or "
        f"front desk so your {members} members can try it before you decide anything. "
        f"Fifteen minutes, at a time that suits your class schedule.\n\n"
        f"Worth a look?\n\n"
        f"— {BRAND} team\n"
        f"chapel hill · durham"
    )
    return subject, body


def _llm(api_key: str, prospect) -> tuple[str, str]:
    label = TYPE_LABEL.get(prospect.type, prospect.type)
    prompt = (
        f"Write a short, plain-spoken outreach email (max 130 words) from {BRAND}, a "
        f"creatine water brand, to {prospect.name}, a {label} in {prospect.address} "
        f"with about {prospect.members} members, {prospect.distance_miles} miles from "
        f"UNC Chapel Hill. Mention its gym type and member count naturally. If a warm "
        f"intro is given, use it: {prospect.warm_intro or 'none'}. End with a low-"
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


def draft_outreach(prospect) -> tuple[str, str, str]:
    """Return (subject, body, source). Falls back to a written template without a key."""
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if api_key:
        try:
            subject, body = _llm(api_key, prospect)
            return subject, body, "ai"
        except Exception:
            pass
    subject, body = _template(prospect)
    return subject, body, "template"
