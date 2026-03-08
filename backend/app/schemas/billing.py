from datetime import datetime

from pydantic import BaseModel


class PlanOut(BaseModel):
    id: str
    code: str
    name: str
    price: float
    currency: str
    billing_cycle: str


class CheckoutInput(BaseModel):
    plan_code: str


class CheckoutOut(BaseModel):
    subscription_id: str
    payment_id: str
    provider_tx_id: str | None
    checkout_url: str


class SubscriptionOut(BaseModel):
    id: str
    plan_id: str
    status: str
    starts_at: datetime
    renews_at: datetime | None
    grace_until: datetime | None
