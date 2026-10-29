from app.services import llm


def test_key_starts_unset(client):
    assert client.get("/api/openai-key").json() == {
        "configured": False, "source": None, "hint": None, "editable": True,
    }


def test_saved_key_is_used_but_never_returned(client):
    status = client.put("/api/openai-key", json={"key": "  sk-test-abcd1234  "}).json()
    assert status == {"configured": True, "source": "saved", "hint": "…1234", "editable": True}
    assert "sk-test" not in client.get("/api/openai-key").text
    assert llm.api_key() == "sk-test-abcd1234"


def test_empty_key_clears_it_and_falls_back_to_env(client, monkeypatch):
    client.put("/api/openai-key", json={"key": "sk-saved-0000"})
    monkeypatch.setenv("OPENAI_API_KEY", "sk-env-9999")
    assert client.get("/api/openai-key").json()["source"] == "saved"
    status = client.put("/api/openai-key", json={"key": ""}).json()
    assert status["source"] == "env" and status["hint"] == "…9999"
    assert llm.api_key() == "sk-env-9999"


def test_deployed_build_refuses_to_save_and_ignores_saved_keys(client, monkeypatch):
    client.put("/api/openai-key", json={"key": "sk-saved-0000"})
    monkeypatch.setenv("STATIC_DIR", "/nonexistent")
    assert client.put("/api/openai-key", json={"key": "sk-x"}).status_code == 403
    assert client.get("/api/openai-key").json() == {
        "configured": False, "source": None, "hint": None, "editable": False,
    }
    assert llm.api_key() == ""


def test_find_contact_uses_the_saved_key(client, prospect):
    assert client.post(f"/api/prospects/{prospect.id}/find-contact").status_code == 503
    client.put("/api/openai-key", json={"key": "sk-saved-0000"})
    assert llm.api_key() == "sk-saved-0000"
