"""Which plan a user is on, how much of it they have used, and activating paid periods."""

import calendar
from dataclasses import dataclass
from datetime import UTC, datetime, time
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from kothora.models import Payment, Subscription, UsageRecord, User
from kothora.plans import CYCLE_MONTHS, PLANS, BillingCycle, Plan

# Daily and monthly limits reset at midnight in Bangladesh, not UTC.
DHAKA = ZoneInfo("Asia/Dhaka")


class QuotaExceededError(Exception):
    pass


@dataclass(frozen=True)
class UsageSummary:
    plan: Plan
    seats: int
    used_today: int
    used_this_month: int
    monthly_limit: int
    daily_limit: int | None
    period_ends_at: datetime | None


def add_months(moment: datetime, months: int) -> datetime:
    """Same day next period, clipped to the month's last day (31 Jan + 1 month = 28/29 Feb)."""
    month_index = moment.month - 1 + months
    year, month = moment.year + month_index // 12, month_index % 12 + 1
    day = min(moment.day, calendar.monthrange(year, month)[1])
    return moment.replace(year=year, month=month, day=day)


async def active_subscription(
    session: AsyncSession, user_id: str, now: datetime
) -> Subscription | None:
    result = await session.execute(
        select(Subscription)
        .where(
            Subscription.user_id == user_id,
            Subscription.starts_at <= now,
            Subscription.ends_at > now,
        )
        .order_by(Subscription.ends_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def usage_summary(session: AsyncSession, user: User, now: datetime) -> UsageSummary:
    subscription = await active_subscription(session, user.id, now)
    plan = PLANS[subscription.plan_id] if subscription else PLANS["free"]
    seats = subscription.seats if subscription else 1

    local_now = now.astimezone(DHAKA)
    day_start = datetime.combine(local_now.date(), time.min, DHAKA)
    month_start = day_start.replace(day=1)

    return UsageSummary(
        plan=plan,
        seats=seats,
        used_today=await _count_queries(session, user.id, since=day_start),
        used_this_month=await _count_queries(session, user.id, since=month_start),
        # Business seats share one pooled allowance until per-member accounts exist.
        monthly_limit=plan.monthly_queries * seats,
        daily_limit=plan.daily_queries * seats if plan.daily_queries else None,
        period_ends_at=subscription.ends_at if subscription else None,
    )


def ensure_within_quota(summary: UsageSummary) -> None:
    if summary.used_this_month >= summary.monthly_limit:
        raise QuotaExceededError(
            f"You have used all {summary.monthly_limit} queries in your {summary.plan.name} "
            "plan this month. Upgrade or wait for the next month."
        )
    if summary.daily_limit is not None and summary.used_today >= summary.daily_limit:
        raise QuotaExceededError(
            f"You have reached today's limit of {summary.daily_limit} queries. "
            "It resets at midnight Bangladesh time."
        )


async def activate_paid_period(
    session: AsyncSession, payment: Payment, now: datetime
) -> Subscription:
    """Renewing the same plan extends the current period; switching plans starts now."""
    current = await active_subscription(session, payment.user_id, now)
    starts_at = current.ends_at if current and current.plan_id == payment.plan_id else now
    months = CYCLE_MONTHS[BillingCycle(payment.cycle)]
    subscription = Subscription(
        user_id=payment.user_id,
        plan_id=payment.plan_id,
        cycle=payment.cycle,
        seats=payment.seats,
        starts_at=starts_at,
        ends_at=add_months(starts_at, months),
        payment_id=payment.id,
    )
    session.add(subscription)
    return subscription


async def _count_queries(session: AsyncSession, user_id: str, since: datetime) -> int:
    result = await session.execute(
        select(func.count(UsageRecord.id)).where(
            UsageRecord.user_id == user_id,
            UsageRecord.counted.is_(True),
            UsageRecord.created_at >= since.astimezone(UTC),
        )
    )
    return int(result.scalar_one())
