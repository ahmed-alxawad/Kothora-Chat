import logging
import uuid
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import RedirectResponse

from kothora.deps import AppServices, CurrentUser, Services, Session
from kothora.models import Payment
from kothora.plans import CYCLE_MONTHS, PLANS, BillingCycle, Plan, PricingError, get_plan, price_bdt
from kothora.schemas import CheckoutRequest, CheckoutResponse, PlanOut, PriceOut
from kothora.services import billing
from kothora.services.payments import sslcommerz
from kothora.services.payments.sslcommerz import PaymentGatewayError, SSLCommerzClient

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/billing", tags=["billing"])


@router.get("/plans", response_model=list[PlanOut])
async def list_plans(services: Services) -> list[PlanOut]:
    return [_plan_out(plan, services) for plan in PLANS.values()]


@router.post("/checkout", response_model=CheckoutResponse)
async def checkout(
    body: CheckoutRequest, user: CurrentUser, session: Session, services: Services
) -> CheckoutResponse:
    gateway = _require_gateway(services)
    try:
        plan = get_plan(body.plan_id)
        amount = price_bdt(plan, body.cycle, body.seats, services.settings)
    except PricingError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    if plan.requires_verification and not _is_education_verified(user.education_verified_until):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "The Education plan needs a verified student or educator account",
        )

    payment = Payment(
        tran_id=f"KTH-{uuid.uuid4().hex[:20].upper()}",
        user_id=user.id,
        plan_id=plan.id,
        cycle=body.cycle.value,
        seats=body.seats,
        amount_bdt=amount,
    )
    session.add(payment)
    await session.commit()

    callback_base = services.settings.public_url.rstrip("/") + "/api/billing/sslcommerz"
    try:
        gateway_url = await gateway.create_session(
            sslcommerz.CheckoutRequest(
                tran_id=payment.tran_id,
                amount_bdt=amount,
                product_name=f"Kothora {plan.name} ({body.cycle.value})",
                customer_name=user.name,
                customer_email=user.email,
                success_url=f"{callback_base}/return/success",
                fail_url=f"{callback_base}/return/fail",
                cancel_url=f"{callback_base}/return/cancel",
                ipn_url=f"{callback_base}/ipn",
            )
        )
    except PaymentGatewayError as exc:
        logger.error("Checkout %s failed: %s", payment.tran_id, exc)
        payment.status = "failed"
        await session.commit()
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, "The payment gateway is unavailable. Try again."
        ) from exc
    return CheckoutResponse(tran_id=payment.tran_id, amount_bdt=amount, gateway_url=gateway_url)


@router.post("/sslcommerz/ipn")
async def sslcommerz_ipn(request: Request, session: Session, services: Services) -> dict:
    """Server-to-server notice from SSLCommerz. Confirmed with the validation API."""
    gateway = _require_gateway(services)
    form = await request.form()
    tran_id, val_id = str(form.get("tran_id", "")), str(form.get("val_id", ""))
    if not tran_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "tran_id is required")
    try:
        if val_id:
            payment = await billing.settle_payment(
                session, gateway, tran_id, val_id, datetime.now(UTC)
            )
        else:
            payment = await billing.mark_unpaid(session, tran_id, "failed")
    except billing.UnknownPaymentError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown transaction") from exc
    except PaymentGatewayError as exc:
        # A 5xx makes SSLCommerz retry the IPN later.
        logger.error("IPN for %s could not be validated: %s", tran_id, exc)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Validation unavailable") from exc
    return {"tran_id": payment.tran_id, "status": payment.status}


@router.post("/sslcommerz/return/{outcome}")
async def sslcommerz_return(
    outcome: Literal["success", "fail", "cancel"],
    request: Request,
    session: Session,
    services: Services,
) -> RedirectResponse:
    """The browser comes back here from the gateway; send it on to the web app."""
    gateway = _require_gateway(services)
    form = await request.form()
    tran_id, val_id = str(form.get("tran_id", "")), str(form.get("val_id", ""))
    result = "failed"
    try:
        if outcome == "success" and val_id:
            payment = await billing.settle_payment(
                session, gateway, tran_id, val_id, datetime.now(UTC)
            )
        else:
            unpaid_status = "cancelled" if outcome == "cancel" else "failed"
            payment = await billing.mark_unpaid(session, tran_id, unpaid_status)
        result = payment.status
    except billing.UnknownPaymentError:
        logger.warning("Return for unknown transaction %r", tran_id)
    except PaymentGatewayError as exc:
        # The IPN will settle it; tell the user it is still processing.
        logger.error("Return for %s could not be validated: %s", tran_id, exc)
        result = "pending"
    target = f"{services.settings.frontend_url.rstrip('/')}/billing?payment={result}"
    return RedirectResponse(target, status_code=status.HTTP_303_SEE_OTHER)


def _require_gateway(services: AppServices) -> SSLCommerzClient:
    if services.gateway is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Payments are not configured")
    return services.gateway


def _is_education_verified(verified_until: datetime | None) -> bool:
    return verified_until is not None and verified_until > datetime.now(UTC)


def _plan_out(plan: Plan, services: AppServices) -> PlanOut:
    prices = []
    if plan.purchasable and plan.monthly_bdt is not None:
        for cycle in BillingCycle:
            total = price_bdt(plan, cycle, plan.min_seats, services.settings) // plan.min_seats
            prices.append(
                PriceOut(cycle=cycle, total_bdt=total, per_month_bdt=total // CYCLE_MONTHS[cycle])
            )
    return PlanOut(
        id=plan.id,
        name=plan.name,
        audience=plan.audience,
        features=list(plan.features),
        monthly_bdt=plan.monthly_bdt,
        monthly_queries=plan.monthly_queries,
        daily_queries=plan.daily_queries,
        per_seat=plan.per_seat,
        min_seats=plan.min_seats,
        requires_verification=plan.requires_verification,
        purchasable=plan.purchasable,
        prices=prices,
    )
