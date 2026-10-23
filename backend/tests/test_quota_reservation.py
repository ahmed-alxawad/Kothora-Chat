"""A query is reserved against the quota before the model is called, so neither
parallel requests nor aborted streams can get answers past the plan's limit."""

import asyncio

import pytest

from kothora.models import User
from kothora.services.chat import TurnRequest
from kothora.services.subscriptions import QuotaExceededError

from .conftest import TEST_DATABASE_URL, register


async def _usage_count(services, user_id: str) -> int:
    from datetime import UTC, datetime

    from kothora.services.subscriptions import usage_summary

    async with services.sessionmaker() as session:
        user = await session.get(User, user_id)
        return (await usage_summary(session, user, datetime.now(UTC))).used_today


def _user_id(client, headers) -> str:
    return client.get("/api/auth/me", headers=headers).json()["id"]


def test_prepared_turn_counts_before_any_answer_is_streamed(client):
    """An aborted stream has already used its query."""
    headers = register(client)
    user_id = _user_id(client, headers)
    services = client.app.state.services

    async def prepare_only() -> None:
        async with services.sessionmaker() as session:
            user = await session.get(User, user_id)
            await services.chat.prepare(session, user, TurnRequest(question="Hi"))

    client.portal.call(prepare_only)

    assert client.portal.call(_usage_count, services, user_id) == 1


@pytest.mark.skipif(not TEST_DATABASE_URL, reason="needs row locks; SQLite (dev only) has none")
def test_parallel_requests_cannot_exceed_the_daily_limit(client):
    headers = register(client)
    user_id = _user_id(client, headers)
    services = client.app.state.services

    async def prepare_once() -> bool:
        async with services.sessionmaker() as session:
            user = await session.get(User, user_id)
            try:
                await services.chat.prepare(session, user, TurnRequest(question="Hi"))
            except QuotaExceededError:
                return False
            return True

    async def burst() -> list[bool]:
        return await asyncio.gather(*(prepare_once() for _ in range(12)))

    outcomes = client.portal.call(burst)

    assert outcomes.count(True) == 5  # Free plan: 5 per day
    assert client.portal.call(_usage_count, services, user_id) == 5
