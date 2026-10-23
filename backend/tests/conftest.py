import asyncio
import json
import os
from collections.abc import Callable, Iterator

import httpx
import pytest
from fastapi.testclient import TestClient

from kothora.config import Settings
from kothora.db import Base, make_engine
from kothora.main import create_app

# Set these to run the suite against real services, as CI does:
#   KOTHORA_TEST_DATABASE_URL=postgresql+asyncpg://...  KOTHORA_TEST_REDIS_URL=redis://...
TEST_DATABASE_URL = os.environ.get("KOTHORA_TEST_DATABASE_URL", "")
TEST_REDIS_URL = os.environ.get("KOTHORA_TEST_REDIS_URL", "")

LOCAL_URL = "http://local.test/v1"
OPENROUTER_URL = "https://openrouter.test/api/v1"
SEARXNG_URL = "http://search.test"

Handler = Callable[[httpx.Request], httpx.Response]


def sse_response(*texts: str, usage: dict | None = None) -> httpx.Response:
    """An OpenAI-style streamed completion."""
    lines = [": keep-alive"]
    for text in texts:
        lines.append("data: " + json.dumps({"choices": [{"delta": {"content": text}}]}))
    if usage:
        lines.append("data: " + json.dumps({"choices": [], "usage": usage}))
    lines.append("data: [DONE]")
    body = "\n\n".join(lines) + "\n\n"
    return httpx.Response(200, text=body, headers={"content-type": "text/event-stream"})


class FakeNetwork:
    """Stands in for every outbound HTTP call. Tests register handlers by URL prefix."""

    def __init__(self) -> None:
        self.handlers: dict[str, Handler] = {}
        self.requests: list[httpx.Request] = []

    def on(self, url_prefix: str, handler: Handler) -> None:
        self.handlers[url_prefix] = handler

    def calls_to(self, url_prefix: str) -> list[httpx.Request]:
        return [r for r in self.requests if str(r.url).startswith(url_prefix)]

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        # Longest prefix wins, so specific routes can override general ones.
        for prefix in sorted(self.handlers, key=len, reverse=True):
            if str(request.url).startswith(prefix):
                return self.handlers[prefix](request)
        raise httpx.ConnectError(f"No fake handler for {request.url}", request=request)


@pytest.fixture
def network() -> FakeNetwork:
    fake = FakeNetwork()
    fake.on(f"{LOCAL_URL}/chat/completions", lambda r: sse_response("Local answer [1]."))
    fake.on(
        f"{OPENROUTER_URL}/chat/completions",
        lambda r: sse_response(
            "Routed ",
            "answer [1][9].",
            usage={"prompt_tokens": 120, "completion_tokens": 30, "cost": 0.0021},
        ),
    )
    fake.on(
        f"{SEARXNG_URL}/search",
        lambda r: httpx.Response(
            200,
            json={
                "results": [
                    {"title": "Dhaka", "url": "https://example.org/dhaka", "content": "Capital."}
                ]
            },
        ),
    )
    return fake


async def _reset_database(url: str) -> None:
    from kothora import models  # noqa: F401  (registers tables)

    engine = make_engine(url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


async def _flush_redis(url: str) -> None:
    import redis.asyncio as redis

    client = redis.from_url(url)
    await client.flushdb()
    await client.aclose()


@pytest.fixture
def database_url(tmp_path) -> Iterator[str]:
    if not TEST_DATABASE_URL:
        yield f"sqlite+aiosqlite:///{tmp_path / 'test.db'}"
        return
    asyncio.run(_reset_database(TEST_DATABASE_URL))
    yield TEST_DATABASE_URL


@pytest.fixture
def settings(database_url) -> Settings:
    if TEST_REDIS_URL:
        asyncio.run(_flush_redis(TEST_REDIS_URL))
    return Settings(
        env="test",
        database_url=database_url,
        redis_url=TEST_REDIS_URL,
        jwt_secret="test-secret-that-is-long-enough-for-hs256",
        local_base_url=LOCAL_URL,
        openrouter_base_url=OPENROUTER_URL,
        openrouter_api_key="test-key",
        search_provider="searxng",
        searxng_url=SEARXNG_URL,
        sslcommerz_store_id="teststore",
        sslcommerz_store_password="testpass",
        public_url="http://api.test",
        frontend_url="http://app.test",
    )


@pytest.fixture
def client(settings: Settings, network: FakeNetwork) -> Iterator[TestClient]:
    app = create_app(settings, http_transport=httpx.MockTransport(network))
    with TestClient(app) as test_client:
        yield test_client


def register(client: TestClient, email: str = "user@example.com") -> dict[str, str]:
    response = client.post(
        "/api/auth/register", json={"email": email, "name": "Test User", "password": "password123"}
    )
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def read_events(response: httpx.Response) -> list[dict]:
    return [
        json.loads(line[len("data: ") :])
        for line in response.text.splitlines()
        if line.startswith("data: ")
    ]
