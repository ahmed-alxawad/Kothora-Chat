from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from kothora.deps import AdminUser, CurrentUser, Services, Session
from kothora.models import Payment, User
from kothora.schemas import EducationVerification, PaymentOut, UsageOut, UserOut
from kothora.services.router import allowed_models
from kothora.services.subscriptions import usage_summary

router = APIRouter(prefix="/api/account", tags=["account"])


@router.get("/usage", response_model=UsageOut)
async def get_usage(user: CurrentUser, session: Session, services: Services) -> UsageOut:
    summary = await usage_summary(session, user, datetime.now(UTC))
    plan = summary.plan
    return UsageOut(
        plan_id=plan.id,
        plan_name=plan.name,
        seats=summary.seats,
        used_today=summary.used_today,
        used_this_month=summary.used_this_month,
        monthly_limit=summary.monthly_limit,
        daily_limit=summary.daily_limit,
        period_ends_at=summary.period_ends_at,
        allowed_models=allowed_models(plan.model_access, services.settings),
        kothora_code=plan.kothora_code,
        scholarly_search=plan.scholarly_search,
        bibliography_export=plan.bibliography_export,
    )


@router.get("/payments", response_model=list[PaymentOut])
async def list_payments(user: CurrentUser, session: Session) -> list[Payment]:
    result = await session.execute(
        select(Payment).where(Payment.user_id == user.id).order_by(Payment.created_at.desc())
    )
    return list(result.scalars())


@router.post("/admin/education-verification", response_model=UserOut)
async def verify_education(
    body: EducationVerification, _admin: AdminUser, session: Session
) -> User:
    """Record an off-platform student or educator check (SheerID-style)."""
    if body.verified_until.tzinfo is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "verified_until needs a timezone")
    result = await session.execute(select(User).where(User.email == body.email.lower()))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No user with that email")
    user.education_verified_until = body.verified_until
    await session.commit()
    return user
