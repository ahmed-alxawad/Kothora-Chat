"""FastAPI dependencies. Long-lived services live on ``app.state`` and are built in
``kothora.main.create_app``, which keeps them replaceable in tests."""

from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Annotated

import httpx
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from kothora.config import Settings
from kothora.models import User
from kothora.security import InvalidTokenError, decode_access_token
from kothora.services.cache import AnswerCache
from kothora.services.chat import ChatService
from kothora.services.payments.sslcommerz import SSLCommerzClient


@dataclass
class AppServices:
    settings: Settings
    sessionmaker: async_sessionmaker[AsyncSession]
    http: httpx.AsyncClient
    cache: AnswerCache
    chat: ChatService
    gateway: SSLCommerzClient | None  # None until SSLCommerz credentials are set


def get_services(request: Request) -> AppServices:
    return request.app.state.services


Services = Annotated[AppServices, Depends(get_services)]


async def get_session(services: Services) -> AsyncIterator[AsyncSession]:
    async with services.sessionmaker() as session:
        yield session


Session = Annotated[AsyncSession, Depends(get_session)]

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    services: Services,
    session: Session,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    unauthorized = HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        "Sign in to continue",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    try:
        user_id = decode_access_token(credentials.credentials, services.settings)
    except InvalidTokenError as exc:
        raise unauthorized from exc
    user = await session.get(User, user_id)
    if user is None:
        raise unauthorized
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_admin_user(user: CurrentUser) -> User:
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Administrators only")
    return user


AdminUser = Annotated[User, Depends(get_admin_user)]
