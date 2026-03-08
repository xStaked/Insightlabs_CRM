from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.models.entities import Payment, Plan, Subscription


class BillingRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_plans(self) -> list[Plan]:
        stmt = select(Plan).order_by(Plan.price.asc())
        return list(self.db.scalars(stmt).all())

    def get_plan_by_code(self, code: str) -> Plan | None:
        stmt = select(Plan).where(Plan.code == code)
        return self.db.scalar(stmt)

    def seed_default_plans(self) -> None:
        if self.list_plans():
            return

        plans = [
            Plan(code="starter", name="Starter", price=Decimal("79000.00"), currency="COP", billing_cycle="monthly"),
            Plan(code="growth", name="Growth", price=Decimal("149000.00"), currency="COP", billing_cycle="monthly"),
            Plan(code="scale", name="Scale", price=Decimal("299000.00"), currency="COP", billing_cycle="monthly"),
        ]
        self.db.add_all(plans)
        self.db.commit()

    def get_current_subscription(self, tenant_id: str) -> Subscription | None:
        stmt = (
            select(Subscription)
            .where(Subscription.tenant_id == tenant_id)
            .order_by(Subscription.created_at.desc())
            .limit(1)
        )
        return self.db.scalar(stmt)

    def ensure_subscription_for_checkout(self, tenant_id: str, plan_id: str) -> Subscription:
        current = self.get_current_subscription(tenant_id)
        now = datetime.now(UTC)
        if current:
            current.plan_id = plan_id
            if current.status in {"suspended", "canceled", "past_due"}:
                current.status = "trialing"
            if not current.starts_at:
                current.starts_at = now
            if not current.renews_at:
                current.renews_at = now + timedelta(days=30)
            self.db.commit()
            self.db.refresh(current)
            return current

        subscription = Subscription(
            tenant_id=tenant_id,
            plan_id=plan_id,
            status="trialing",
            starts_at=now,
            renews_at=now + timedelta(days=30),
        )
        self.db.add(subscription)
        self.db.commit()
        self.db.refresh(subscription)
        return subscription

    def create_payment(
        self,
        *,
        tenant_id: str,
        subscription_id: str,
        amount: Decimal,
        currency: str,
        status: str,
        provider_tx_id: str | None,
        raw_payload: dict,
    ) -> Payment:
        payment = Payment(
            tenant_id=tenant_id,
            subscription_id=subscription_id,
            amount=amount,
            currency=currency,
            status=status,
            provider="wompi",
            provider_tx_id=provider_tx_id,
            raw_payload=raw_payload,
        )
        self.db.add(payment)
        self.db.commit()
        self.db.refresh(payment)
        return payment

    def get_payment_by_provider_tx(self, provider_tx_id: str) -> Payment | None:
        stmt = select(Payment).where(Payment.provider_tx_id == provider_tx_id)
        return self.db.scalar(stmt)

    def mark_payment(self, provider_tx_id: str, status: str, raw_payload: dict) -> Payment | None:
        payment = self.get_payment_by_provider_tx(provider_tx_id)
        if not payment:
            return None

        payment.status = status
        payment.raw_payload = raw_payload
        if status == "paid":
            payment.paid_at = datetime.now(UTC)

        self.db.commit()
        self.db.refresh(payment)
        return payment

    def activate_subscription(self, subscription_id: str) -> Subscription | None:
        stmt = select(Subscription).where(Subscription.id == subscription_id)
        subscription = self.db.scalar(stmt)
        if not subscription:
            return None

        now = datetime.now(UTC)
        subscription.status = "active"
        subscription.grace_until = None
        if not subscription.renews_at:
            subscription.renews_at = now + timedelta(days=30)

        self.db.commit()
        self.db.refresh(subscription)
        return subscription

    def set_subscription_past_due(self, subscription_id: str) -> Subscription | None:
        stmt = select(Subscription).where(Subscription.id == subscription_id)
        subscription = self.db.scalar(stmt)
        if not subscription:
            return None

        subscription.status = "past_due"
        subscription.grace_until = datetime.now(UTC) + timedelta(days=3)
        self.db.commit()
        self.db.refresh(subscription)
        return subscription

    def due_for_renewal(self) -> list[Subscription]:
        now = datetime.now(UTC)
        stmt = select(Subscription).where(
            and_(
                Subscription.status.in_(["active", "trialing"]),
                Subscription.renews_at.is_not(None),
                Subscription.renews_at <= now,
            )
        )
        return list(self.db.scalars(stmt).all())

    def has_recent_paid_payment(self, subscription_id: str, since: datetime) -> bool:
        stmt = select(Payment.id).where(
            Payment.subscription_id == subscription_id,
            Payment.status == "paid",
            Payment.paid_at.is_not(None),
            Payment.paid_at >= since,
        )
        return self.db.scalar(stmt) is not None

    def suspend_expired_grace_subscriptions(self) -> int:
        now = datetime.now(UTC)
        stmt = select(Subscription).where(
            Subscription.status == "past_due",
            Subscription.grace_until.is_not(None),
            Subscription.grace_until < now,
        )
        items = list(self.db.scalars(stmt).all())
        for sub in items:
            sub.status = "suspended"
        self.db.commit()
        return len(items)
