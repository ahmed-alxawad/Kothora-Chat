from datetime import UTC, datetime

import pytest

from kothora.config import Settings
from kothora.plans import BillingCycle, PricingError, get_plan, price_bdt
from kothora.services.subscriptions import add_months

SETTINGS = Settings()


@pytest.mark.parametrize(
    ("plan_id", "cycle", "expected"),
    [
        ("basic", BillingCycle.MONTHLY, 800),
        ("pro", BillingCycle.QUARTERLY, 4050),  # 1,350 x 3 (10% off)
        ("premium", BillingCycle.QUARTERLY, 5400),
        ("basic", BillingCycle.YEARLY, 8160),  # business document, Section 4.2
        ("pro", BillingCycle.YEARLY, 15300),
        ("premium", BillingCycle.YEARLY, 20400),
        ("education", BillingCycle.MONTHLY, 750),
    ],
)
def test_single_user_prices_match_the_business_document(plan_id, cycle, expected):
    assert price_bdt(get_plan(plan_id), cycle, 1, SETTINGS) == expected


def test_business_plans_charge_per_seat():
    assert price_bdt(get_plan("business_basic"), BillingCycle.MONTHLY, 3, SETTINGS) == 7500


def test_business_plans_enforce_the_seat_minimum():
    with pytest.raises(PricingError, match="at least 2 seats"):
        price_bdt(get_plan("business_basic"), BillingCycle.MONTHLY, 1, SETTINGS)


def test_single_user_plans_reject_extra_seats():
    with pytest.raises(PricingError, match="single-user"):
        price_bdt(get_plan("pro"), BillingCycle.MONTHLY, 2, SETTINGS)


@pytest.mark.parametrize("plan_id", ["free", "enterprise"])
def test_plans_that_cannot_be_bought_online_have_no_price(plan_id):
    with pytest.raises(PricingError):
        price_bdt(get_plan(plan_id), BillingCycle.MONTHLY, 5, SETTINGS)


def test_unknown_plan_is_rejected():
    with pytest.raises(PricingError, match="Unknown plan"):
        get_plan("platinum")


def test_premium_is_capped_not_unlimited():
    premium = get_plan("premium")
    assert premium.monthly_queries > get_plan("pro").monthly_queries
    assert premium.daily_queries is not None


@pytest.mark.parametrize(
    ("start", "months", "expected"),
    [
        (datetime(2026, 1, 31, tzinfo=UTC), 1, datetime(2026, 2, 28, tzinfo=UTC)),
        (datetime(2028, 1, 31, tzinfo=UTC), 1, datetime(2028, 2, 29, tzinfo=UTC)),
        (datetime(2026, 11, 15, tzinfo=UTC), 3, datetime(2027, 2, 15, tzinfo=UTC)),
        (datetime(2026, 10, 23, tzinfo=UTC), 12, datetime(2027, 10, 23, tzinfo=UTC)),
    ],
)
def test_add_months_clips_to_the_end_of_short_months(start, months, expected):
    assert add_months(start, months) == expected
