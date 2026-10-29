from datetime import date, timedelta

from tests.test_api import _add_contact


def test_mark_sent_moves_a_new_gym_to_reached_out_and_schedules_the_follow_up(client, prospect):
    contact = _add_contact(prospect.id)

    response = client.post(
        f"/api/prospects/{prospect.id}/touches",
        json={"kind": "sent", "contact_id": contact.id, "follow_up_days": 5},
    )

    assert response.status_code == 201
    detail = client.get(f"/api/prospects/{prospect.id}").json()
    assert detail["stage"] == "Reached out"
    assert detail["next_action"] == "Follow up with Marcus"
    assert detail["next_action_date"] == (date.today() + timedelta(days=5)).isoformat()
    assert detail["last_touch_kind"] == "sent"
    assert detail["contacts"][0]["touch_count"] == 1
    assert detail["contacts"][0]["last_touch_kind"] == "sent"
    assert {
        a["kind"] for a in detail["activities"]
    } >= {"sent", "stage"}


def test_mark_sent_leaves_a_later_stage_alone(client, prospect_factory):
    gym = prospect_factory(stage="Meeting")
    client.post(f"/api/prospects/{gym.id}/touches", json={"kind": "sent"})
    assert client.get(f"/api/prospects/{gym.id}").json()["stage"] == "Meeting"


def test_reply_puts_answering_it_on_todays_list(client, prospect):
    contact = _add_contact(prospect.id)
    client.post(f"/api/prospects/{prospect.id}/touches", json={"kind": "sent", "contact_id": contact.id})
    client.post(f"/api/prospects/{prospect.id}/touches", json={"kind": "reply", "contact_id": contact.id})

    detail = client.get(f"/api/prospects/{prospect.id}").json()
    assert detail["next_action"] == "Reply to Marcus"
    assert detail["next_action_date"] == date.today().isoformat()
    assert detail["contacts"][0]["last_touch_kind"] == "reply"
    assert detail["contacts"][0]["touch_count"] == 2


def test_touch_rejects_a_contact_from_another_gym(client, prospect_factory):
    gym, other = prospect_factory(), prospect_factory(name="Other")
    contact = _add_contact(other.id)
    response = client.post(f"/api/prospects/{gym.id}/touches", json={"kind": "sent", "contact_id": contact.id})
    assert response.status_code == 400


def test_people_list_spans_gyms(client, prospect_factory):
    a, b = prospect_factory(name="Alpha Gym"), prospect_factory(name="Beta Gym")
    _add_contact(a.id)
    _add_contact(b.id, name="Jo Park")

    people = client.get("/api/contacts").json()
    assert [(p["name"], p["prospect_name"]) for p in people] == [
        ("Marcus Reyes", "Alpha Gym"),
        ("Jo Park", "Beta Gym"),
    ]
    assert people[0]["prospect_stage"] == "Not contacted"


def test_edit_set_primary_and_delete_contact(client, prospect):
    first = _add_contact(prospect.id)
    second = _add_contact(prospect.id, name="Jo Park", is_primary=False)

    edited = client.patch(f"/api/contacts/{second.id}", json={"is_primary": True, "role": "GM"}).json()
    assert edited["is_primary"] is True and edited["role"] == "GM"
    detail = client.get(f"/api/prospects/{prospect.id}").json()
    assert detail["primary_contact"]["name"] == "Jo Park"
    assert [c["is_primary"] for c in detail["contacts"]] == [True, False]

    client.post(f"/api/prospects/{prospect.id}/touches", json={"kind": "sent", "contact_id": first.id})
    assert client.delete(f"/api/contacts/{first.id}").status_code == 204
    detail = client.get(f"/api/prospects/{prospect.id}").json()
    assert [c["name"] for c in detail["contacts"]] == ["Jo Park"]
    assert detail["touches"][0]["contact_id"] is None
