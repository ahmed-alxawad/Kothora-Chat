"""Application factory. Run with ``uvicorn kothora.main:app``."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from kothora.api import account, auth, billing, chat
from kothora.config import Settings, get_settings
from kothora.db import create_all, make_engine, make_sessionmaker
from kothora.deps import AppServices, Services
from kothora.services.cache import make_cache
from kothora.services.chat import ChatModels, ChatService
from kothora.services.llm import ChatModelClient
from kothora.services.payments.sslcommerz import SSLCommerzClient
from kothora.services.search import OpenAlexSearch, make_web_search

logger = logging.getLogger(__name__)

_INSECURE_JWT_SECRET = "change-me-in-production"


def create_app(
    settings: Settings | None = None, http_transport: httpx.AsyncBaseTransport | None = None
) -> FastAPI:
    """``http_transport`` replaces the network for every outbound call (models, search,
    payments); tests pass an ``httpx.MockTransport``."""
    settings = settings or get_settings()
    _check_production_settings(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        engine = make_engine(settings.database_url)
        # Tables are created on start for development and tests; production should run
        # migrations instead once the schema starts changing.
        await create_all(engine)
        http = httpx.AsyncClient(transport=http_transport)
        cache = make_cache(settings.redis_url)
        app.state.services = _build_services(settings, engine, http, cache)
        try:
            yield
        finally:
            await cache.close()
            await http.aclose()
            await engine.dispose()

    app = FastAPI(title="Kothora Chat", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )
    for module in (auth, account, chat, billing):
        app.include_router(module.router)

    @app.get("/api/health", tags=["health"])
    async def health(services: Services) -> dict[str, str]:
        """Readiness: answers 503 when the database is unreachable, so the load balancer
        or Compose healthcheck stops sending traffic."""
        try:
            async with services.sessionmaker() as session:
                await session.execute(text("SELECT 1"))
        except (SQLAlchemyError, OSError) as exc:
            logger.error("Health check failed: %s", exc)
            raise HTTPException(503, "Database unavailable") from exc
        return {"status": "ok", "database": "ok"}

    return app


def _build_services(settings: Settings, engine, http: httpx.AsyncClient, cache) -> AppServices:
    models = ChatModels(
        local=ChatModelClient(
            settings.local_base_url, http, timeout_seconds=settings.local_timeout_seconds
        ),
        openrouter=ChatModelClient(
            settings.openrouter_base_url,
            http,
            api_key=settings.openrouter_api_key,
            # OpenRouter attributes traffic to the app with these headers.
            extra_headers={"HTTP-Referer": settings.public_url, "X-Title": "Kothora Chat"},
        ),
    )
    gateway = None
    if settings.sslcommerz_store_id and settings.sslcommerz_store_password:
        gateway = SSLCommerzClient(
            http,
            settings.sslcommerz_base_url,
            settings.sslcommerz_store_id,
            settings.sslcommerz_store_password,
        )
    else:
        logger.warning("SSLCommerz is not configured; checkout is disabled")
    return AppServices(
        settings=settings,
        sessionmaker=make_sessionmaker(engine),
        http=http,
        cache=cache,
        chat=ChatService(
            settings,
            models,
            web_search=make_web_search(settings, http),
            scholarly_search=OpenAlexSearch(http),
            cache=cache,
        ),
        gateway=gateway,
    )


def _check_production_settings(settings: Settings) -> None:
    if settings.env != "production":
        return
    if settings.jwt_secret == _INSECURE_JWT_SECRET or len(settings.jwt_secret) < 32:
        raise RuntimeError("Set KOTHORA_JWT_SECRET to a random value of at least 32 characters")
    if settings.sslcommerz_sandbox:
        logger.warning("Production is using the SSLCommerz sandbox")


def _create_default_app() -> FastAPI:
    logging.basicConfig(level=logging.INFO)
    return create_app()


app = _create_default_app()
