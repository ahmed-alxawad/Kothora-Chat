"""Answer cache (routing step 1). Redis in production, an in-process dict otherwise."""

import hashlib
import json
import time
from typing import Any, Protocol

import redis.asyncio as redis


class AnswerCache(Protocol):
    async def get(self, key: str) -> dict[str, Any] | None: ...
    async def set(self, key: str, value: dict[str, Any], ttl_seconds: int) -> None: ...
    async def close(self) -> None: ...


def cache_key(query: str, model_access: str, search_scope: str) -> str:
    """Key on the normalized query, on what the tier may see (a Basic user never receives
    a premium model's answer) and on what the answer was grounded on (web, scholarly,
    both, or none)."""
    normalized = " ".join(query.lower().split())
    digest = hashlib.sha256(f"{model_access}|{search_scope}|{normalized}".encode()).hexdigest()
    return f"kothora:answer:{digest}"


class MemoryCache:
    """Single-process cache. Not shared between workers; use Redis when running several."""

    def __init__(self, max_entries: int = 10_000) -> None:
        self._entries: dict[str, tuple[float, dict[str, Any]]] = {}
        self._max_entries = max_entries

    async def get(self, key: str) -> dict[str, Any] | None:
        entry = self._entries.get(key)
        if entry is None:
            return None
        expires_at, value = entry
        if expires_at < time.monotonic():
            del self._entries[key]
            return None
        return value

    async def set(self, key: str, value: dict[str, Any], ttl_seconds: int) -> None:
        if len(self._entries) >= self._max_entries:
            # Dicts keep insertion order, so this evicts the oldest entry.
            self._entries.pop(next(iter(self._entries)))
        self._entries[key] = (time.monotonic() + ttl_seconds, value)

    async def close(self) -> None:
        self._entries.clear()


class RedisCache:
    def __init__(self, url: str) -> None:
        self._client = redis.from_url(url, decode_responses=True)

    async def get(self, key: str) -> dict[str, Any] | None:
        raw = await self._client.get(key)
        return json.loads(raw) if raw else None

    async def set(self, key: str, value: dict[str, Any], ttl_seconds: int) -> None:
        await self._client.set(key, json.dumps(value), ex=ttl_seconds)

    async def close(self) -> None:
        await self._client.aclose()


def make_cache(redis_url: str) -> AnswerCache:
    return RedisCache(redis_url) if redis_url else MemoryCache()
