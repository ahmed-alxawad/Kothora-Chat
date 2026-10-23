"""One chat turn: quota -> search -> cache -> routed model (with fallback) -> persist."""

import logging
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from kothora.config import Settings
from kothora.models import Conversation, Message, UsageRecord, User
from kothora.plans import Plan
from kothora.services import grounding
from kothora.services.cache import AnswerCache, cache_key
from kothora.services.llm import ChatModelClient, ModelError, ModelUnavailableError, Usage
from kothora.services.router import (
    QueryCategory,
    Route,
    RouteStep,
    classify_query,
    plan_route,
)
from kothora.services.search import SearchError, SearchProvider, Source
from kothora.services.subscriptions import ensure_within_quota, usage_summary

logger = logging.getLogger(__name__)

# Older turns are dropped so prompts fit local 8k-token context windows.
HISTORY_MESSAGES = 10
TITLE_MAX_CHARS = 60

Event = dict[str, Any]


@dataclass
class ChatModels:
    local: ChatModelClient
    openrouter: ChatModelClient

    def client_for(self, route: Route) -> ChatModelClient:
        return self.openrouter if route is Route.OPENROUTER else self.local


@dataclass
class TurnRequest:
    question: str
    requested_model: str | None = None
    web_search: bool = True
    scholarly_search: bool = False


@dataclass(frozen=True)
class PreparedTurn:
    """The outcome of the checks that run before streaming starts."""

    plan: Plan
    category: QueryCategory
    steps: list[RouteStep]


@dataclass
class _Answer:
    text: str
    step: RouteStep
    usage: Usage


class ChatService:
    def __init__(
        self,
        settings: Settings,
        models: ChatModels,
        web_search: SearchProvider,
        scholarly_search: SearchProvider,
        cache: AnswerCache,
    ) -> None:
        self._settings = settings
        self._models = models
        self._web_search = web_search
        self._scholarly_search = scholarly_search
        self._cache = cache

    async def prepare(
        self, session: AsyncSession, user: User, request: TurnRequest
    ) -> PreparedTurn:
        """Checks that can fail before streaming starts, so the API can answer with a
        proper HTTP status. Raises QuotaExceededError or ModelNotAllowedError."""
        summary = await usage_summary(session, user, datetime.now(UTC))
        ensure_within_quota(summary)
        category = classify_query(request.question)
        steps = plan_route(
            category, summary.plan.model_access, self._settings, request.requested_model
        )
        if not steps:
            raise ModelError("No model is configured. Set up a local model or OpenRouter.")
        return PreparedTurn(summary.plan, category, steps)

    async def run_turn(
        self,
        session: AsyncSession,
        user: User,
        conversation: Conversation,
        request: TurnRequest,
        prepared: PreparedTurn,
    ) -> AsyncIterator[Event]:
        plan, category = prepared.plan, prepared.category
        history = await self._history(session, conversation.id)
        session.add(Message(conversation_id=conversation.id, role="user", content=request.question))
        if not history:
            conversation.title = _title_from(request.question)
        await session.commit()

        sources: list[Source] = []
        async for notice in self._search(request, plan, sources):
            yield notice

        key = cache_key(request.question, plan.model_access, grounded=bool(sources))
        # Only standalone questions are cached: a follow-up depends on its conversation.
        cacheable = not history and request.requested_model is None
        started = time.monotonic()

        cached = await self._cache.get(key) if cacheable else None
        if cached:
            answer = _Answer(
                cached["text"], RouteStep(Route.CACHE, cached["model"]), Usage(0, 0, 0)
            )
            sources = [Source(**s) for s in cached["sources"]]
            yield _meta_event(answer.step, category, sources)
            yield {"type": "delta", "text": answer.text}
        else:
            messages = grounding.build_messages(history, request.question, sources)
            answer = None
            async for event in self._stream_with_fallback(
                prepared.steps, messages, category, sources
            ):
                if isinstance(event, _Answer):
                    answer = event
                else:
                    yield event
            if answer is None:
                return
            if cacheable:
                await self._cache.set(
                    key,
                    {
                        "text": answer.text,
                        "model": answer.step.model,
                        "sources": [s.to_dict() for s in sources],
                    },
                    self._settings.cache_ttl_seconds,
                )

        annotated = grounding.annotate_sources(answer.text, sources)
        message = Message(
            conversation_id=conversation.id,
            role="assistant",
            content=answer.text,
            sources=annotated,
            model=answer.step.model,
            route=answer.step.route.value,
        )
        conversation.updated_at = datetime.now(UTC)
        session.add(message)
        await session.flush()
        session.add(
            UsageRecord(
                user_id=user.id,
                message_id=message.id,
                route=answer.step.route.value,
                model=answer.step.model,
                category=category.value,
                prompt_tokens=answer.usage.prompt_tokens,
                completion_tokens=answer.usage.completion_tokens,
                cost_usd=answer.usage.cost_usd,
                latency_ms=int((time.monotonic() - started) * 1000),
            )
        )
        await session.commit()
        yield {
            "type": "done",
            "message_id": message.id,
            "title": conversation.title,
            "sources": annotated,
            "route": answer.step.route.value,
            "model": answer.step.model,
        }

    async def _search(
        self, request: TurnRequest, plan: Plan, sources: list[Source]
    ) -> AsyncIterator[Event]:
        """Fill ``sources``; a failed search is reported to the user, not hidden."""
        limit = self._settings.search_max_results
        searches: list[tuple[str, SearchProvider]] = []
        if request.web_search:
            searches.append(("Web search", self._web_search))
        if request.scholarly_search and plan.scholarly_search:
            searches.append(("Scholarly search", self._scholarly_search))
        for label, provider in searches:
            try:
                sources.extend(await provider.search(request.question, limit))
            except SearchError as exc:
                logger.warning("%s failed: %s", label, exc)
                yield {"type": "notice", "message": f"{label} is unavailable right now."}

    async def _stream_with_fallback(
        self,
        steps: list[RouteStep],
        messages: list[dict[str, str]],
        category: QueryCategory,
        sources: list[Source],
    ) -> AsyncIterator[Event | _Answer]:
        """Try each step in order. Fall back only if nothing was streamed yet; once text
        has reached the user, switching models would produce a spliced answer."""
        for index, step in enumerate(steps):
            parts: list[str] = []
            usage = Usage(0, 0, 0.0)
            yield _meta_event(step, category, sources)
            try:
                async for event in self._models.client_for(step.route).stream(step.model, messages):
                    if isinstance(event, Usage):
                        usage = event
                    else:
                        parts.append(event)
                        yield {"type": "delta", "text": event}
            except ModelUnavailableError as exc:
                logger.warning("Route %s (%s) unavailable: %s", step.route, step.model, exc)
                if parts or index == len(steps) - 1:
                    yield {"type": "error", "message": "The model is unavailable. Try again."}
                    return
                continue
            except ModelError as exc:
                logger.error("Route %s (%s) failed: %s", step.route, step.model, exc)
                yield {"type": "error", "message": "The model returned an error. Try again."}
                return
            yield _Answer("".join(parts), step, usage)
            return

    async def _history(self, session: AsyncSession, conversation_id: str) -> list[dict[str, str]]:
        result = await session.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.desc())
            .limit(HISTORY_MESSAGES)
        )
        recent = reversed(result.scalars().all())
        return [{"role": m.role, "content": m.content} for m in recent]


def _meta_event(step: RouteStep, category: QueryCategory, sources: list[Source]) -> Event:
    return {
        "type": "meta",
        "route": step.route.value,
        "model": step.model,
        "category": category.value,
        "sources": [{"n": n, **s.to_dict()} for n, s in enumerate(sources, start=1)],
    }


def _title_from(question: str) -> str:
    title = " ".join(question.split())
    return title if len(title) <= TITLE_MAX_CHARS else title[: TITLE_MAX_CHARS - 1] + "…"
