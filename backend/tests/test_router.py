import pytest

from kothora.config import Settings
from kothora.plans import ModelAccess
from kothora.services.router import (
    ModelNotAllowedError,
    QueryCategory,
    Route,
    classify_query,
    plan_route,
)

SETTINGS = Settings(openrouter_api_key="key")


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("What is the capital of Bangladesh?", QueryCategory.SIMPLE),
        ("Hello!", QueryCategory.SIMPLE),
        ("Why does my python script raise a KeyError?", QueryCategory.CODE),
        ("Fix this:\n```js\nconst a = b.c\n```", QueryCategory.CODE),
        ("Compare the economies of Bangladesh and Vietnam", QueryCategory.COMPLEX),
        ("word " * 40, QueryCategory.COMPLEX),
        ("Who won? And when? And where?", QueryCategory.COMPLEX),
    ],
)
def test_classify_query(text, expected):
    assert classify_query(text) == expected


def test_paid_tiers_send_simple_questions_to_the_local_model_first():
    steps = plan_route(QueryCategory.SIMPLE, ModelAccess.STANDARD, SETTINGS)
    assert [s.route for s in steps] == [Route.LOCAL_GENERAL, Route.OPENROUTER]


def test_code_questions_use_the_local_code_model():
    steps = plan_route(QueryCategory.CODE, ModelAccess.STANDARD, SETTINGS)
    assert steps[0].route is Route.LOCAL_CODE
    assert steps[0].model == SETTINGS.local_code_model


def test_complex_questions_go_straight_to_openrouter_on_paid_tiers():
    steps = plan_route(QueryCategory.COMPLEX, ModelAccess.STANDARD, SETTINGS)
    assert [s.route for s in steps] == [Route.OPENROUTER]


def test_local_tier_stays_local_and_falls_back_to_the_budget_model():
    steps = plan_route(QueryCategory.COMPLEX, ModelAccess.LOCAL, SETTINGS)
    assert steps[0].route is Route.LOCAL_GENERAL
    assert steps[1].model == SETTINGS.openrouter_budget_model


def test_local_tier_has_no_paid_fallback_when_disabled():
    settings = Settings(openrouter_api_key="key", local_fallback_to_openrouter=False)
    steps = plan_route(QueryCategory.SIMPLE, ModelAccess.LOCAL, settings)
    assert [s.route for s in steps] == [Route.LOCAL_GENERAL]


def test_without_openrouter_key_everything_runs_locally():
    steps = plan_route(QueryCategory.COMPLEX, ModelAccess.PREMIUM, Settings(openrouter_api_key=""))
    assert [s.route for s in steps] == [Route.LOCAL_GENERAL]


def test_premium_user_may_pick_a_premium_model():
    model = SETTINGS.openrouter_premium_models[-1]
    steps = plan_route(QueryCategory.SIMPLE, ModelAccess.PREMIUM, SETTINGS, model)
    assert [(s.route, s.model) for s in steps] == [(Route.OPENROUTER, model)]


@pytest.mark.parametrize("access", [ModelAccess.LOCAL, ModelAccess.STANDARD])
def test_lower_tiers_cannot_pick_premium_models(access):
    with pytest.raises(ModelNotAllowedError):
        plan_route(QueryCategory.SIMPLE, access, SETTINGS, SETTINGS.openrouter_premium_models[-1])
