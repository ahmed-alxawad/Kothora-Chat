"""Query routing (business document, Section 6.2): the cheapest adequate model first.

The classifier is a transparent heuristic. Every routed query is logged in
``usage_records`` with its category, route, tokens and cost, which is the dataset a
learned router (the PPO idea in Section 2.1) would need before it can beat these rules.
"""

import re
from dataclasses import dataclass
from enum import StrEnum

from kothora.config import Settings
from kothora.plans import ModelAccess


class QueryCategory(StrEnum):
    SIMPLE = "simple"
    CODE = "code"
    COMPLEX = "complex"


class Route(StrEnum):
    CACHE = "cache"
    LOCAL_GENERAL = "local_general"
    LOCAL_CODE = "local_code"
    OPENROUTER = "openrouter"


@dataclass(frozen=True)
class RouteStep:
    route: Route
    model: str


class ModelNotAllowedError(ValueError):
    pass


_CODE_PATTERN = re.compile(
    r"```|\b(def|class|function|import|return|const|let|var|async|await|lambda)\b"
    r"|\b(python|javascript|typescript|java|golang|rust|c\+\+|php|sql|bash|regex|html|css)\b"
    r"|\b(traceback|stack trace|exception|compile|syntax error|segfault|null pointer|bug)\b"
    r"|\w+\.(py|js|ts|tsx|java|go|rs|cpp|php|sql|sh)\b",
    re.IGNORECASE,
)
_COMPLEX_PATTERN = re.compile(
    r"\b(explain in detail|step by step|compare|analy[sz]e|evaluate|essay|report|strategy"
    r"|pros and cons|research|literature|prove|derive|summari[sz]e this|in depth)\b",
    re.IGNORECASE,
)
# A short single question with no reasoning cue is "simple" (facts, greetings, FAQs).
_SIMPLE_MAX_WORDS = 25


def classify_query(text: str) -> QueryCategory:
    if _CODE_PATTERN.search(text):
        return QueryCategory.CODE
    if _COMPLEX_PATTERN.search(text):
        return QueryCategory.COMPLEX
    word_count = len(text.split())
    if word_count <= _SIMPLE_MAX_WORDS and text.count("?") <= 1:
        return QueryCategory.SIMPLE
    return QueryCategory.COMPLEX


def allowed_models(access: ModelAccess, settings: Settings) -> list[str]:
    """OpenRouter models a tier may pick explicitly."""
    if access is ModelAccess.PREMIUM:
        unique = dict.fromkeys(
            [
                settings.openrouter_default_model,
                settings.openrouter_budget_model,
                *settings.openrouter_premium_models,
            ]
        )
        return list(unique)
    if access is ModelAccess.STANDARD:
        return [settings.openrouter_default_model, settings.openrouter_budget_model]
    return []


def plan_route(
    category: QueryCategory,
    access: ModelAccess,
    settings: Settings,
    requested_model: str | None = None,
) -> list[RouteStep]:
    """Ordered steps to try. A later step is a fallback for when an earlier model is down."""
    if requested_model:
        if requested_model not in allowed_models(access, settings):
            raise ModelNotAllowedError(f"Your plan does not include {requested_model}")
        return [RouteStep(Route.OPENROUTER, requested_model)]

    can_use_openrouter = bool(settings.openrouter_api_key)
    local_step = _local_step(category, settings)
    steps: list[RouteStep] = []

    if access is ModelAccess.LOCAL:
        if local_step:
            steps.append(local_step)
        if can_use_openrouter and (settings.local_fallback_to_openrouter or not local_step):
            steps.append(RouteStep(Route.OPENROUTER, settings.openrouter_budget_model))
        return steps

    if local_step and category is not QueryCategory.COMPLEX:
        steps.append(local_step)
    if can_use_openrouter:
        steps.append(RouteStep(Route.OPENROUTER, settings.openrouter_default_model))
    elif local_step and local_step not in steps:
        steps.append(local_step)
    return steps


def _local_step(category: QueryCategory, settings: Settings) -> RouteStep | None:
    if not settings.local_enabled:
        return None
    if category is QueryCategory.CODE:
        return RouteStep(Route.LOCAL_CODE, settings.local_code_model)
    return RouteStep(Route.LOCAL_GENERAL, settings.local_general_model)
