import pytest

from app.db import SessionLocal
from app.models import Contact, Prospect


CANDIDATES = {
    "candidates": [
        {
            "name": "Marcus Reyes",
            "role": "Owner",
            "email": "marcus@barbellunion.example",
            "email_status": "verified",
            "phone": "+1 512 555 0110",
            "instagram": "@marcuslifts",
            "linkedin_url": "https://linkedin.example/marcus",
            "source_url": "https://barbellunion.example/about",
            "confidence": "high",
            "reasoning": "Owner listed on the gym's About page with a direct email.",
        },
        {
            "name": "Dana Whitfield",
            "role": "Head Coach",
            "email": "dana@barbellunion.example",
            "email_status": "guessed",
            "phone": None,
            "instagram": None,
            "linkedin_url": None,
            "source_url": "https://barbellunion.example/team",
            "confidence": "high",
            "reasoning": "Head coach named on the Team page.",
        },
    ]
}


def _add_contact(prospect_id, **overrides):
    data = {
        "name": "Marcus Reyes",
        "role": "Owner",
        "email": "marcus@barbellunion.example",
        "email_status": "verified",
        "confidence": "high",
        "reasoning": "Owner on the About page.",
        "source_url": "https://barbellunion.example/about",
        "is_primary": True,
    }
    data.update(overrides)
    with SessionLocal() as db:
        contact = Contact(prospect_id=prospect_id, **data)
        db.add(contact)
        db.commit()
        db.refresh(contact)
    return contact


def test_ranked_table_orders_by_score_and_includes_primary_contact(client, prospect):
    with SessionLocal() as db:
        db.add(Prospect(name="Second Gym", gym_type="crossfit", score=50))
        db.commit()
    _add_contact(prospect.id)

    response = client.get("/api/prospects")

    assert response.status_code == 200
    rows = response.json()
    assert [row["name"] for row in rows] == ["Barbell Union", "Second Gym"]
    assert [row["rank"] for row in rows] == [1, 2]
    assert rows[0]["primary_contact"]["name"] == "Marcus Reyes"
    assert rows[0]["primary_contact"]["email_status"] == "verified"
    assert rows[1]["primary_contact"] is None


def test_prospect_detail_lists_contacts_with_primary_first(client, prospect):
    _add_contact(prospect.id, is_primary=False, name="Dana Whitfield", confidence="low")
    _add_contact(prospect.id, is_primary=True, name="Marcus Reyes")

    response = client.get(f"/api/prospects/{prospect.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Barbell Union"
    assert body["contacts"][0]["name"] == "Marcus Reyes"
    assert body["contacts"][0]["is_primary"] is True


def test_find_contact_returns_at_most_three_ranked_candidates(
    client, prospect, monkeypatch
):
    from app.services import llm

    def fake_responses_json(**_):
        return llm.LLMResult(data=CANDIDATES)

    monkeypatch.setattr("app.services.llm.responses_json", fake_responses_json)

    response = client.post(f"/api/prospects/{prospect.id}/find-contact")

    assert response.status_code == 200
    body = response.json()
    assert [c["name"] for c in body["candidates"]] == ["Marcus Reyes", "Dana Whitfield"]
    assert body["candidates"][0]["source_url"].endswith("/about")
    assert body["candidates"][1]["confidence"] == "low"
    assert body["candidates"][1]["email_status"] == "guessed"
    assert body["candidates"][0]["is_primary"] is False
    assert body["searched_at"]


def test_find_contact_without_api_key_reports_a_clear_error(client, prospect, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    response = client.post(f"/api/prospects/{prospect.id}/find-contact")

    assert response.status_code == 503
    assert "API key" in response.json()["detail"]


def test_find_contact_surfaces_provider_failures(client, prospect, monkeypatch):
    from app.services.llm import LLMError

    def boom(**_):
        raise LLMError("The LLM provider rejected the request (400): bad model")

    monkeypatch.setattr("app.services.llm.responses_json", boom)

    response = client.post(f"/api/prospects/{prospect.id}/find-contact")

    assert response.status_code == 502
    assert "bad model" in response.json()["detail"]


def test_use_this_contact_saves_it_as_primary_and_demotes_the_previous_one(
    client, prospect
):
    first = _add_contact(prospect.id, email="first@barbellunion.example")

    payload = CANDIDATES["candidates"][1] | {"is_primary": True}
    response = client.post(f"/api/prospects/{prospect.id}/contacts", json=payload)

    assert response.status_code == 201
    saved = response.json()
    assert saved["name"] == "Dana Whitfield"
    assert saved["is_primary"] is True
    assert saved["found_at"]

    with SessionLocal() as db:
        previous = db.get(Contact, first.id)
        assert previous.is_primary is False

    detail = client.get(f"/api/prospects/{prospect.id}").json()
    assert detail["contacts"][0]["name"] == "Dana Whitfield"


def test_draft_outreach_addresses_the_primary_contact_by_first_name_and_role(
    client, prospect
):
    _add_contact(
        prospect.id,
        name="Dana Whitfield",
        role="Head Coach",
        email="dana@barbellunion.example",
    )

    response = client.post(f"/api/prospects/{prospect.id}/outreach-draft")

    assert response.status_code == 200
    draft = response.json()
    assert draft["to"] == "dana@barbellunion.example"
    assert draft["body"].startswith("Hi Dana,")
    assert "Head Coach" in draft["body"]
    assert "Barbell Union" in draft["body"]
    assert draft["contact_id"] is not None


def test_draft_outreach_without_a_contact_uses_the_gym_team(client, prospect):
    response = client.post(f"/api/prospects/{prospect.id}/outreach-draft")

    assert response.status_code == 200
    draft = response.json()
    assert draft["to"] == ""
    assert draft["body"].startswith("Hi Barbell Union team,")
    assert draft["contact_id"] is None


def test_unknown_prospect_returns_404(client):
    assert client.get("/api/prospects/9999").status_code == 404
    assert client.post("/api/prospects/9999/find-contact").status_code == 404
    assert client.post("/api/prospects/9999/outreach-draft").status_code == 404


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
