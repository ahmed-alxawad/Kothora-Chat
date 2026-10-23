"""Plan catalog and price arithmetic (business document, Section 4).

Decisions taken where the document leaves an item open (Appendix A/B):

* Premium is not "unlimited": it carries a fair-use cap (flag 5).
* Quarterly billing uses the 10% discount implied by the 720 / 1,350 / 1,800 figures,
  billed per quarter (flag 6). Both discounts are configurable.
* Kothora Code is included from Pro upward and is not sold standalone at the Pro price
  (flag 17); Kothora Computer is a roadmap flag on Premium only (flag 9).
"""

from dataclasses import dataclass, field
from enum import StrEnum

from kothora.config import Settings


class ModelAccess(StrEnum):
    LOCAL = "local"  # Local Llama only
    STANDARD = "standard"  # Local + default OpenRouter models
    PREMIUM = "premium"  # Every configured model


class BillingCycle(StrEnum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


CYCLE_MONTHS = {BillingCycle.MONTHLY: 1, BillingCycle.QUARTERLY: 3, BillingCycle.YEARLY: 12}


@dataclass(frozen=True)
class Plan:
    id: str
    name: str
    monthly_bdt: int | None  # None = priced by quote
    monthly_queries: int
    daily_queries: int | None
    model_access: ModelAccess
    audience: str
    features: tuple[str, ...] = field(default_factory=tuple)
    per_seat: bool = False
    min_seats: int = 1
    requires_verification: bool = False
    scholarly_search: bool = False
    bibliography_export: bool = False
    kothora_code: bool = False
    purchasable: bool = True


PLANS: dict[str, Plan] = {
    p.id: p
    for p in [
        Plan(
            id="free",
            name="Free",
            monthly_bdt=0,
            monthly_queries=15,
            daily_queries=5,
            model_access=ModelAccess.LOCAL,
            audience="Anyone trying Kothora",
            features=("Cited answers", "Local model"),
            purchasable=False,
        ),
        Plan(
            id="basic",
            name="Basic",
            monthly_bdt=800,
            monthly_queries=50,
            daily_queries=None,
            model_access=ModelAccess.LOCAL,
            audience="Students, light users",
            features=("50 queries per month", "Llama 3 8B running locally", "Email support"),
        ),
        Plan(
            id="pro",
            name="Pro",
            monthly_bdt=1500,
            monthly_queries=500,
            daily_queries=None,
            model_access=ModelAccess.STANDARD,
            audience="Power users, professionals",
            features=(
                "500 queries per month",
                "Local and OpenRouter models",
                "Per-claim citations",
                "Kothora Code included",
                "Priority support",
            ),
            kothora_code=True,
        ),
        Plan(
            id="premium",
            name="Premium",
            monthly_bdt=2000,
            monthly_queries=3000,
            daily_queries=200,
            model_access=ModelAccess.PREMIUM,
            audience="Heavy users, researchers",
            features=(
                "3,000 queries per month (fair use, 200 per day)",
                "All models",
                "Kothora Code included",
                "Dedicated support",
            ),
            kothora_code=True,
        ),
        Plan(
            id="education",
            name="Education",
            monthly_bdt=750,
            monthly_queries=1000,
            daily_queries=100,
            model_access=ModelAccess.STANDARD,
            audience="Verified students and educators",
            features=(
                "Scholarly and web search combined",
                "Bibliography export (BibTeX and plain text)",
                "Higher limits for thesis work",
                "Re-verified every academic year",
            ),
            requires_verification=True,
            scholarly_search=True,
            bibliography_export=True,
        ),
        Plan(
            id="business_basic",
            name="Business Basic",
            monthly_bdt=2500,
            monthly_queries=800,
            daily_queries=None,
            model_access=ModelAccess.STANDARD,
            audience="Teams",
            features=("Per seat, 2-seat minimum", "Admin controls", "Audit logs"),
            per_seat=True,
            min_seats=2,
            kothora_code=True,
        ),
        Plan(
            id="business_premium",
            name="Business Premium",
            monthly_bdt=5000,
            monthly_queries=3000,
            daily_queries=None,
            model_access=ModelAccess.PREMIUM,
            audience="Teams with heavier use",
            features=("Per seat, 2-seat minimum", "All models", "API access"),
            per_seat=True,
            min_seats=2,
            kothora_code=True,
        ),
        Plan(
            id="enterprise",
            name="Enterprise",
            monthly_bdt=None,
            monthly_queries=3000,
            daily_queries=None,
            model_access=ModelAccess.PREMIUM,
            audience="5+ seats, custom terms",
            features=("SLA", "Private deployment options", "Training"),
            per_seat=True,
            min_seats=5,
            kothora_code=True,
            purchasable=False,
        ),
    ]
}


class PricingError(ValueError):
    pass


def get_plan(plan_id: str) -> Plan:
    try:
        return PLANS[plan_id]
    except KeyError as exc:
        raise PricingError(f"Unknown plan: {plan_id}") from exc


def cycle_discount(cycle: BillingCycle, settings: Settings) -> float:
    if cycle is BillingCycle.QUARTERLY:
        return settings.quarterly_discount
    if cycle is BillingCycle.YEARLY:
        return settings.yearly_discount
    return 0.0


def price_bdt(plan: Plan, cycle: BillingCycle, seats: int, settings: Settings) -> int:
    """Total charged up front for one billing period, in whole BDT."""
    if plan.monthly_bdt is None or not plan.purchasable:
        raise PricingError(f"{plan.name} cannot be bought online")
    if not plan.per_seat and seats != 1:
        raise PricingError(f"{plan.name} is a single-user plan")
    if seats < plan.min_seats:
        raise PricingError(f"{plan.name} needs at least {plan.min_seats} seats")
    months = CYCLE_MONTHS[cycle]
    gross = plan.monthly_bdt * months * seats
    return round(gross * (1 - cycle_discount(cycle, settings)))
