import httpx
import pytest

from app.services import llm


class FakeResponse:
    def __init__(self, status_code=200, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload
        self.text = text

    def json(self):
        if self._payload is None:
            raise ValueError("no json")
        return self._payload


class FakeClient:
    def __init__(self, response):
        self.response = response
        self.calls = []

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def post(self, url, headers=None, json=None):
        self.calls.append({"url": url, "headers": headers, "json": json})
        return self.response


def test_build_payload_enables_web_search_and_json_schema(monkeypatch):
    monkeypatch.setenv("OPENAI_MODEL", "gpt-test")
    payload = llm.build_payload(
        system="sys", user="usr", schema={"type": "object"}, schema_name="contact_candidates"
    )

    assert payload["model"] == "gpt-test"
    assert payload["tools"] == [{"type": "web_search"}]
    assert payload["include"] == ["web_search_call.action.sources"]
    assert payload["text"]["format"]["type"] == "json_schema"
    assert payload["text"]["format"]["name"] == "contact_candidates"
    assert payload["text"]["format"]["strict"] is True
    assert payload["input"][1]["content"][0]["text"] == "usr"


def test_output_text_skips_tool_items_and_reads_message():
    data = {
        "output": [
            {"type": "web_search_call", "status": "completed"},
            {
                "type": "message",
                "content": [{"type": "output_text", "text": '{"candidates": []}'}],
            },
        ]
    }

    assert llm._output_text(data) == '{"candidates": []}'


def test_output_text_raises_on_refusal():
    data = {
        "output": [
            {
                "type": "message",
                "content": [{"type": "refusal", "refusal": "I can't help with that."}],
            }
        ]
    }

    with pytest.raises(llm.LLMError):
        llm._output_text(data)


def test_responses_json_requires_a_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    with pytest.raises(llm.LLMNotConfigured):
        llm.responses_json(system="s", user="u", schema={}, schema_name="x")


def test_responses_json_parses_provider_output(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    body = {
        "output": [
            {
                "type": "web_search_call",
                "action": {
                    "type": "search",
                    "sources": [{"type": "url", "url": "https://gym.example/team"}],
                },
            },
            {
                "type": "message",
                "content": [
                    {
                        "type": "output_text",
                        "text": '{"candidates": [{"name": "A"}]}',
                        "annotations": [
                            {"type": "url_citation", "url": "https://gym.example/team"}
                        ],
                    }
                ],
            },
        ]
    }
    monkeypatch.setattr(llm, "_send", lambda payload, key: body)

    result = llm.responses_json(system="s", user="u", schema={}, schema_name="x")

    assert result.data == {"candidates": [{"name": "A"}]}
    assert result.search_sources == [["https://gym.example/team"]]
    assert result.citations == ["https://gym.example/team"]


def test_search_sources_keeps_one_list_per_search_call():
    body = {
        "output": [
            {"type": "web_search_call", "action": {"sources": [{"url": "https://a.example"}]}},
            {"type": "message", "content": []},
            {
                "type": "web_search_call",
                "action": {
                    "sources": [
                        {"url": "https://b.example"},
                        {"url": "https://c.example"},
                        {"url": None},
                    ]
                },
            },
        ]
    }

    assert llm._search_sources(body) == [
        ["https://a.example"],
        ["https://b.example", "https://c.example"],
    ]
    assert llm._search_sources({}) == []


def test_responses_json_rejects_non_json_output(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    body = {"output": [{"type": "message", "content": [{"type": "output_text", "text": "sorry"}]}]}
    monkeypatch.setattr(llm, "_send", lambda payload, key: body)

    with pytest.raises(llm.LLMError):
        llm.responses_json(system="s", user="u", schema={}, schema_name="x")


def test_send_posts_to_responses_and_surfaces_provider_errors(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_BASE_URL", "https://llm.example/v1")
    fake = FakeClient(
        FakeResponse(status_code=400, payload={"error": {"message": "bad model"}})
    )
    monkeypatch.setattr(llm.httpx, "Client", lambda **_: fake)

    with pytest.raises(llm.LLMError) as excinfo:
        llm._send({"model": "m"}, "test-key")

    assert "bad model" in str(excinfo.value)
    assert fake.calls[0]["url"] == "https://llm.example/v1/responses"
    assert fake.calls[0]["headers"]["Authorization"] == "Bearer test-key"


def test_send_wraps_network_errors(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    class BrokenClient(FakeClient):
        def post(self, *args, **kwargs):
            raise httpx.ConnectError("nope")

    monkeypatch.setattr(llm.httpx, "Client", lambda **_: BrokenClient(None))

    with pytest.raises(llm.LLMError):
        llm._send({"model": "m"}, "test-key")
