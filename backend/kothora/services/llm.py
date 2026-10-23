"""Streaming client for OpenAI-compatible chat APIs: OpenRouter and local servers
such as Ollama or llama.cpp."""

import json
from collections.abc import AsyncIterator
from dataclasses import dataclass

import httpx


class ModelError(Exception):
    """The model returned an error after the request was accepted."""


class ModelUnavailableError(ModelError):
    """The server could not be reached or refused the request; safe to try another model."""


@dataclass(frozen=True)
class Usage:
    prompt_tokens: int
    completion_tokens: int
    cost_usd: float


ChatMessage = dict[str, str]
StreamEvent = str | Usage


class ChatModelClient:
    def __init__(
        self,
        base_url: str,
        http: httpx.AsyncClient,
        api_key: str = "",
        extra_headers: dict[str, str] | None = None,
        timeout_seconds: float = 120.0,
    ) -> None:
        self._url = base_url.rstrip("/") + "/chat/completions"
        self._http = http
        self._timeout = timeout_seconds
        self._headers = {"Content-Type": "application/json", **(extra_headers or {})}
        if api_key:
            self._headers["Authorization"] = f"Bearer {api_key}"

    async def stream(self, model: str, messages: list[ChatMessage]) -> AsyncIterator[StreamEvent]:
        """Yield text fragments as they arrive, then one Usage if the server reports it."""
        body = {
            "model": model,
            "messages": messages,
            "stream": True,
            "stream_options": {"include_usage": True},
            # OpenRouter-specific; other servers ignore unknown fields.
            "usage": {"include": True},
        }
        try:
            async with self._http.stream(
                "POST", self._url, json=body, headers=self._headers, timeout=self._timeout
            ) as response:
                if response.status_code >= 400:
                    detail = (await response.aread()).decode(errors="replace")[:500]
                    raise ModelUnavailableError(f"{model}: HTTP {response.status_code}: {detail}")
                async for line in response.aiter_lines():
                    for event in _parse_sse_line(line, model):
                        yield event
        except httpx.TransportError as exc:
            raise ModelUnavailableError(f"{model}: {exc.__class__.__name__}: {exc}") from exc


def _parse_sse_line(line: str, model: str) -> list[StreamEvent]:
    # Blank lines separate events; lines starting with ":" are keep-alive comments.
    if not line.startswith("data:"):
        return []
    payload = line[len("data:") :].strip()
    if payload == "[DONE]":
        return []
    try:
        chunk = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise ModelError(f"{model}: malformed stream chunk: {payload[:200]}") from exc

    if "error" in chunk:
        error = chunk["error"]
        message = error.get("message") if isinstance(error, dict) else str(error)
        raise ModelError(f"{model}: {message}")

    events: list[StreamEvent] = []
    for choice in chunk.get("choices") or []:
        text = (choice.get("delta") or {}).get("content")
        if text:
            events.append(text)
    usage = chunk.get("usage")
    if usage:
        events.append(
            Usage(
                prompt_tokens=int(usage.get("prompt_tokens") or 0),
                completion_tokens=int(usage.get("completion_tokens") or 0),
                cost_usd=float(usage.get("cost") or 0.0),
            )
        )
    return events
