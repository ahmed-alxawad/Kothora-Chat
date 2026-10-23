"""Settling payments reported by the gateway."""

import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from kothora.models import Payment
from kothora.services.payments.sslcommerz import SSLCommerzClient, Validation
from kothora.services.subscriptions import activate_paid_period

logger = logging.getLogger(__name__)

# SSLCommerz flags risky transactions with risk_level 1; those wait for a manual check.
_RISKY = 1


class UnknownPaymentError(LookupError):
    pass


async def settle_payment(
    session: AsyncSession,
    gateway: SSLCommerzClient,
    tran_id: str,
    val_id: str,
    now: datetime,
) -> Payment:
    """Confirm a payment with the gateway and activate its subscription. Safe to call more
    than once for the same payment (IPN and browser redirect both arrive)."""
    payment = await _load_for_update(session, tran_id)
    if payment.status == "paid":
        return payment

    validation = await gateway.validate(val_id)
    problem = _validation_problem(payment, validation)
    if problem:
        logger.warning("Payment %s not settled: %s", tran_id, problem)
        payment.status = "review" if validation.risk_level == _RISKY else "failed"
        payment.gateway_val_id = val_id
        await session.commit()
        return payment

    payment.status = "paid"
    payment.gateway_val_id = val_id
    payment.gateway_card_type = validation.card_type
    await activate_paid_period(session, payment, now)
    try:
        await session.commit()
    except IntegrityError:
        # A concurrent call activated this payment first (unique subscriptions.payment_id).
        await session.rollback()
        payment = await _load_for_update(session, tran_id)
    return payment


async def mark_unpaid(session: AsyncSession, tran_id: str, status: str) -> Payment:
    payment = await _load_for_update(session, tran_id)
    if payment.status == "pending":
        payment.status = status
        await session.commit()
    return payment


def _validation_problem(payment: Payment, validation: Validation) -> str | None:
    if not validation.is_paid:
        return f"gateway status {validation.status}"
    if validation.tran_id != payment.tran_id:
        return f"tran_id mismatch ({validation.tran_id})"
    if validation.currency != "BDT":
        return f"currency {validation.currency}"
    if abs(validation.amount - payment.amount_bdt) > 0.01:
        return f"amount {validation.amount} != {payment.amount_bdt}"
    if validation.risk_level == _RISKY:
        return "flagged as risky by the gateway"
    return None


async def _load_for_update(session: AsyncSession, tran_id: str) -> Payment:
    result = await session.execute(
        select(Payment).where(Payment.tran_id == tran_id).with_for_update()
    )
    payment = result.scalar_one_or_none()
    if payment is None:
        raise UnknownPaymentError(tran_id)
    return payment
