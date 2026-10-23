"""Request and response bodies."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from kothora.plans import BillingCycle
from kothora.security import MAX_PASSWORD_BYTES


class RegisterRequest(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=8, max_length=MAX_PASSWORD_BYTES)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    name: str
    is_admin: bool
    education_verified_until: datetime | None


class UsageOut(BaseModel):
    plan_id: str
    plan_name: str
    seats: int
    used_today: int
    used_this_month: int
    monthly_limit: int
    daily_limit: int | None
    period_ends_at: datetime | None
    allowed_models: list[str]
    kothora_code: bool
    scholarly_search: bool
    bibliography_export: bool


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    created_at: datetime
    updated_at: datetime


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    role: str
    content: str
    sources: list[dict]
    model: str | None
    route: str | None
    created_at: datetime


class ConversationDetail(ConversationOut):
    messages: list[MessageOut]


class RenameConversation(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class SendMessage(BaseModel):
    content: str = Field(min_length=1, max_length=20_000)
    model: str | None = None
    web_search: bool = True
    scholarly_search: bool = False


class PriceOut(BaseModel):
    cycle: BillingCycle
    total_bdt: int
    per_month_bdt: int


class PlanOut(BaseModel):
    id: str
    name: str
    audience: str
    features: list[str]
    monthly_bdt: int | None
    monthly_queries: int
    daily_queries: int | None
    per_seat: bool
    min_seats: int
    requires_verification: bool
    purchasable: bool
    prices: list[PriceOut]


class CheckoutRequest(BaseModel):
    plan_id: str
    cycle: BillingCycle = BillingCycle.MONTHLY
    seats: int = Field(default=1, ge=1, le=500)


class CheckoutResponse(BaseModel):
    tran_id: str
    amount_bdt: int
    gateway_url: str


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tran_id: str
    plan_id: str
    cycle: str
    seats: int
    amount_bdt: int
    status: str
    gateway_card_type: str | None
    created_at: datetime


class EducationVerification(BaseModel):
    email: EmailStr
    verified_until: datetime
