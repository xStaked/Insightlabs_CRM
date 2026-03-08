from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from hashlib import sha256
import hmac

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.entities import Payment, Plan, Subscription
from app.repositories.billing import BillingRepository

settings = get_settings()


class BillingService:
    def __init__(self, db: Session):
        self.repo = BillingRepository(db)

    def list_plans(self) -> list[Plan]:
        self.repo.seed_default_plans()
        return self.repo.list_plans()

    def create_checkout(self, tenant_id: str, plan_code: str) -> tuple[Subscription, Payment, str]:
        self.repo.seed_default_plans()
        plan = self.repo.get_plan_by_code(plan_code)
        if not plan:
            raise ValueError("Plan not found")

        subscription = self.repo.ensure_subscription_for_checkout(tenant_id=tenant_id, plan_id=plan.id)
        provider_tx_id = f"wompi_{tenant_id}_{int(datetime.now(UTC).timestamp())}"
        payment = self.repo.create_payment(
            tenant_id=tenant_id,
            subscription_id=subscription.id,
            amount=Decimal(plan.price),
            currency=plan.currency,
            status="pending",
            provider_tx_id=provider_tx_id,
            raw_payload={"plan_code": plan.code},
        )

        checkout_url = f"https://checkout.wompi.co/p/?ref={provider_tx_id}"
        return subscription, payment, checkout_url

    def process_wompi_event(self, payload: dict) -> Payment | None:
        data = payload.get("data", payload)
        tx_id = str(data.get("id") or data.get("transaction_id") or "")
        status = str(data.get("status") or "").lower()
        if not tx_id:
            return None

        normalized = "paid" if status in {"approved", "paid", "successful"} else "failed"
        payment = self.repo.mark_payment(tx_id, normalized, payload)
        if not payment:
            return None

        if normalized == "paid" and payment.subscription_id:
            sub = self.repo.activate_subscription(payment.subscription_id)
            if sub:
                sub.renews_at = (sub.renews_at or datetime.now(UTC)) + timedelta(days=30)
                self.repo.db.commit()
        elif normalized == "failed" and payment.subscription_id:
            self.repo.set_subscription_past_due(payment.subscription_id)

        return payment

    def get_subscription(self, tenant_id: str) -> Subscription | None:
        return self.repo.get_current_subscription(tenant_id)

    def run_renewal_and_suspension(self) -> dict[str, int]:
        renewed = 0
        moved_to_past_due = 0

        for sub in self.repo.due_for_renewal():
            since = (sub.renews_at or datetime.now(UTC)) - timedelta(days=30)
            if self.repo.has_recent_paid_payment(sub.id, since=since):
                sub.status = "active"
                sub.renews_at = (sub.renews_at or datetime.now(UTC)) + timedelta(days=30)
                sub.grace_until = None
                renewed += 1
            else:
                sub.status = "past_due"
                sub.grace_until = datetime.now(UTC) + timedelta(days=3)
                moved_to_past_due += 1

        self.repo.db.commit()
        suspended = self.repo.suspend_expired_grace_subscriptions()
        return {"renewed": renewed, "past_due": moved_to_past_due, "suspended": suspended}


def verify_wompi_signature(raw_body: bytes, signature_header: str | None) -> bool:
    if not settings.wompi_webhook_secret:
        return False
    if not signature_header:
        return False

    expected = hmac.new(settings.wompi_webhook_secret.encode("utf-8"), raw_body, sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header.strip())
