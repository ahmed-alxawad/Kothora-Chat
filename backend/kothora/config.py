"""Runtime settings, read from environment variables prefixed with ``KOTHORA_``."""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="KOTHORA_", env_file=".env", extra="ignore")

    env: Literal["development", "test", "production"] = "development"
    public_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:5173"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])

    database_url: str = "sqlite+aiosqlite:///./kothora.db"
    # Leave empty to use the in-process cache (single worker only).
    redis_url: str = ""
    cache_ttl_seconds: int = 6 * 60 * 60

    jwt_secret: str = "change-me-in-production"
    jwt_ttl_minutes: int = 60 * 24 * 7

    # Local inference (Section 6.1): any OpenAI-compatible server, e.g. Ollama or llama.cpp.
    local_base_url: str = "http://localhost:11434/v1"
    local_general_model: str = "llama3:8b-instruct-q4_K_M"
    local_code_model: str = "codellama:7b-instruct-q4_K_M"
    local_enabled: bool = True
    local_timeout_seconds: float = 120.0

    # OpenRouter (Section 6.2, step 4).
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_api_key: str = ""
    openrouter_default_model: str = "anthropic/claude-sonnet-4.5"
    openrouter_budget_model: str = "google/gemini-2.5-flash"
    openrouter_premium_models: list[str] = Field(
        default_factory=lambda: [
            "anthropic/claude-sonnet-4.5",
            "openai/gpt-5",
            "google/gemini-2.5-pro",
        ]
    )
    # Used when the local server is down and the tier allows a paid fallback.
    local_fallback_to_openrouter: bool = True

    # Search grounding.
    search_provider: Literal["none", "searxng", "brave", "tavily"] = "none"
    searxng_url: str = "http://localhost:8080"
    brave_api_key: str = ""
    tavily_api_key: str = ""
    search_max_results: int = 5

    # SSLCommerz covers cards, bKash, Nagad, Rocket and net banking in BDT.
    sslcommerz_store_id: str = ""
    sslcommerz_store_password: str = ""
    sslcommerz_sandbox: bool = True

    # Pricing decisions left open in the business document (Appendix B).
    quarterly_discount: float = 0.10
    yearly_discount: float = 0.15

    upload_max_bytes: int = 10 * 1024 * 1024

    @property
    def sslcommerz_base_url(self) -> str:
        if self.sslcommerz_sandbox:
            return "https://sandbox.sslcommerz.com"
        return "https://securepay.sslcommerz.com"


@lru_cache
def get_settings() -> Settings:
    return Settings()
