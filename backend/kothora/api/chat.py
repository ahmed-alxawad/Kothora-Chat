import json
import logging
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, HTTPException, Response, status
from fastapi.responses import PlainTextResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from kothora.deps import CurrentUser, Services, Session
from kothora.models import Conversation, Message, User
from kothora.schemas import (
    ConversationDetail,
    ConversationOut,
    MessageOut,
    RenameConversation,
    SendMessage,
)
from kothora.services.bibliography import to_bibtex, to_plain_text
from kothora.services.chat import TurnRequest
from kothora.services.llm import ModelError
from kothora.services.router import ModelNotAllowedError
from kothora.services.subscriptions import QuotaExceededError, usage_summary

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/conversations", tags=["chat"])


async def _owned_conversation(
    session: AsyncSession, user: User, conversation_id: str
) -> Conversation:
    conversation = await session.get(Conversation, conversation_id)
    # 404 rather than 403 so other users' conversation ids are not confirmed.
    if conversation is None or conversation.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    return conversation


@router.get("", response_model=list[ConversationOut])
async def list_conversations(user: CurrentUser, session: Session) -> list[Conversation]:
    result = await session.execute(
        select(Conversation)
        .where(Conversation.user_id == user.id)
        .order_by(Conversation.updated_at.desc())
        .limit(200)
    )
    return list(result.scalars())


@router.post("", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
async def create_conversation(user: CurrentUser, session: Session) -> Conversation:
    conversation = Conversation(user_id=user.id)
    session.add(conversation)
    await session.commit()
    return conversation


@router.get("/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: str, user: CurrentUser, session: Session
) -> ConversationDetail:
    conversation = await _owned_conversation(session, user, conversation_id)
    result = await session.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at)
    )
    return ConversationDetail(
        **ConversationOut.model_validate(conversation).model_dump(),
        messages=[MessageOut.model_validate(m) for m in result.scalars()],
    )


@router.patch("/{conversation_id}", response_model=ConversationOut)
async def rename_conversation(
    conversation_id: str, body: RenameConversation, user: CurrentUser, session: Session
) -> Conversation:
    conversation = await _owned_conversation(session, user, conversation_id)
    conversation.title = body.title.strip()
    await session.commit()
    return conversation


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: str, user: CurrentUser, session: Session
) -> Response:
    conversation = await _owned_conversation(session, user, conversation_id)
    await session.delete(conversation)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    body: SendMessage,
    user: CurrentUser,
    session: Session,
    services: Services,
) -> StreamingResponse:
    """Answer as Server-Sent Events: ``meta``, ``notice``, ``delta``, then ``done`` or ``error``."""
    await _owned_conversation(session, user, conversation_id)
    turn = TurnRequest(
        question=body.content.strip(),
        requested_model=body.model,
        web_search=body.web_search,
        scholarly_search=body.scholarly_search,
    )
    try:
        prepared = await services.chat.prepare(session, user, turn)
    except QuotaExceededError as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, str(exc)) from exc
    except ModelNotAllowedError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except ModelError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc

    async def events() -> AsyncIterator[str]:
        # The request-scoped session may close before the stream ends, so the stream
        # opens its own.
        async with services.sessionmaker() as stream_session:
            conversation = await stream_session.get(Conversation, conversation_id)
            try:
                async for event in services.chat.run_turn(
                    stream_session, conversation, turn, prepared
                ):
                    yield _sse(event)
            except Exception:
                logger.exception("Chat turn failed in conversation %s", conversation_id)
                yield _sse({"type": "error", "message": "Something went wrong. Try again."})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        # Stop Nginx from buffering the stream.
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/{conversation_id}/messages/{message_id}/bibliography")
async def export_bibliography(
    conversation_id: str,
    message_id: str,
    user: CurrentUser,
    session: Session,
    format: Literal["bibtex", "text"] = "bibtex",
) -> PlainTextResponse:
    summary = await usage_summary(session, user, datetime.now(UTC))
    if not summary.plan.bibliography_export:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Bibliography export is in the Education plan"
        )
    await _owned_conversation(session, user, conversation_id)
    message = await session.get(Message, message_id)
    if message is None or message.conversation_id != conversation_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found")
    cited = [s for s in message.sources if s.get("cited")] or message.sources
    if format == "bibtex":
        return PlainTextResponse(to_bibtex(cited), media_type="application/x-bibtex")
    return PlainTextResponse(to_plain_text(cited))


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
