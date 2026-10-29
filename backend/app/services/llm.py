"""Thin client for the OpenAI Responses API.

The contact search needs live internet context, so every request runs with the
`web_search` tool enabled and asks for a JSON object that matches a schema.
"""

import json
import os
from dataclasses import dataclass, field
from typing import Any

import httpx

DEFAULT_MODEL = "gpt-4.1"
DEFAULT_BASE_URL = "https://api.openai.com/v1"


class LLMNotConfigured(Exception):
    """Raised when no API key is available for the contact search."""


class LLMError(Exception):
    """Raised when the provider rejects the request or returns unusable output."""


@dataclass
class LLMResult:
    """Parsed JSON plus the web pages the search actually visited."""

    data: Any
    search_sources: list[list[str]] = field(default_factory=list)
    citations: list[str] = field(default_factory=list)


def api_key() -> str:
    return (os.environ.get("OPENAI_API_KEY") or "").strip()


def model_name() -> str:
    return (os.environ.get("OPENAI_MODEL") or DEFAULT_MODEL).strip() or DEFAULT_MODEL


def base_url() -> str:
    return (os.environ.get("OPENAI_BASE_URL") or DEFAULT_BASE_URL).strip().rstrip("/")


def build_payload(*, system: str, user: str, schema: dict, schema_name: str) -> dict:
    return {
        "model": model_name(),
        "input": [
            {"role": "system", "content": [{"type": "input_text", "text": system}]},
            {"role": "user", "content": [{"type": "input_text", "text": user}]},
        ],
        "tools": [{"type": "web_search"}],
        "tool_choice": "auto",
        "include": ["web_search_call.action.sources"],
        "text": {
            "format": {
                "type": "json_schema",
                "name": schema_name,
                "schema": schema,
                "strict": True,
            }
        },
    }


def responses_json(*, system: str, user: str, schema: dict, schema_name: str) -> LLMResult:
    """Run one web-search-backed response and return its JSON plus the sources."""
    key = api_key()
    if not key:
        raise LLMNotConfigured(
            "No LLM API key is configured, so the web search cannot run. "
            "Add an OPENAI_API_KEY to enable Find contact."
        )

    payload = build_payload(system=system, user=user, schema=schema, schema_name=schema_name)
    response = _send(payload, key)
    text = _output_text(response)
    if not text:
        raise LLMError("The LLM returned an empty response.")
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise LLMError(f"The LLM returned a response that was not valid JSON: {exc}") from exc

    return LLMResult(
        data=data,
        search_sources=_search_sources(response),
        citations=_citations(response),
    )


def _send(payload: dict, key: str) -> dict:
    try:
        with httpx.Client(timeout=180.0) as client:
            response = client.post(
                f"{base_url()}/responses",
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
    except httpx.HTTPError as exc:
        raise LLMError(f"Could not reach the LLM provider: {exc}") from exc

    if response.status_code >= 400:
        raise LLMError(
            f"The LLM provider rejected the request ({response.status_code}): "
            f"{_error_message(response)}"
        )

    try:
        return response.json()
    except ValueError as exc:
        raise LLMError("The LLM provider returned a response that was not JSON.") from exc


def _error_message(response: httpx.Response) -> str:
    try:
        body = response.json()
    except ValueError:
        return response.text[:300] or "no details provided"
    error = body.get("error") if isinstance(body, dict) else None
    if isinstance(error, dict) and error.get("message"):
        return str(error["message"])
    return json.dumps(body)[:300]


def _search_sources(data: dict) -> list[list[str]]:
    """URLs per web_search_call, in call order.

    The model sometimes cites a result as `turn1search4` instead of a URL; the
    token points at this structure, so keep it to resolve those.
    """
    if not isinstance(data, dict):
        return []
    sources: list[list[str]] = []
    for item in data.get("output", []) or []:
        if not isinstance(item, dict) or item.get("type") != "web_search_call":
            continue
        action = item.get("action") if isinstance(item.get("action"), dict) else {}
        urls = [
            source["url"]
            for source in action.get("sources") or []
            if isinstance(source, dict) and source.get("url")
        ]
        sources.append(urls)
    return sources


def _citations(data: dict) -> list[str]:
    if not isinstance(data, dict):
        return []
    urls: list[str] = []
    for item in data.get("output", []) or []:
        if not isinstance(item, dict) or item.get("type") != "message":
            continue
        for content in item.get("content", []) or []:
            if not isinstance(content, dict):
                continue
            for annotation in content.get("annotations") or []:
                if (
                    isinstance(annotation, dict)
                    and annotation.get("type") == "url_citation"
                    and annotation.get("url")
                ):
                    urls.append(annotation["url"])
    return urls


def _output_text(data: dict) -> str:
    """Collect the assistant text from a Responses API payload.

    Responses mix tool-call items with the final message, so walk the output
    instead of assuming the first item carries the text.
    """
    if not isinstance(data, dict):
        return ""
    if isinstance(data.get("output_text"), str) and data["output_text"].strip():
        return data["output_text"]

    parts: list[str] = []
    for item in data.get("output", []) or []:
        if not isinstance(item, dict) or item.get("type") != "message":
            continue
        for content in item.get("content", []) or []:
            if not isinstance(content, dict):
                continue
            if content.get("type") == "refusal" and content.get("refusal"):
                raise LLMError(f"The LLM refused the request: {content['refusal']}")
            if content.get("type") == "output_text" and content.get("text"):
                parts.append(content["text"])
    return "".join(parts).strip()
