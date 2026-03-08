from datetime import UTC, datetime

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.entities import WebhookEvent


class WebhookRepository:
    def __init__(self, db: Session):
        self.db = db

    def find_by_event_id(self, event_id: str) -> WebhookEvent | None:
        stmt = select(WebhookEvent).where(WebhookEvent.event_id == event_id)
        return self.db.scalar(stmt)

    def create(
        self,
        *,
        provider: str,
        event_id: str,
        event_type: str,
        payload_json: dict,
        signature_valid: bool,
        tenant_id: str | None = None,
    ) -> WebhookEvent:
        existing = self.find_by_event_id(event_id)
        if existing:
            return existing

        event = WebhookEvent(
            provider=provider,
            event_id=event_id,
            event_type=event_type,
            payload_json=payload_json,
            signature_valid=signature_valid,
            tenant_id=tenant_id,
        )
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)
        return event

    def mark_processed(self, event_id: str) -> None:
        event = self.find_by_event_id(event_id)
        if not event:
            return
        event.status = "processed"
        event.processed_at = datetime.now(UTC)
        self.db.commit()

    def mark_failed(self, event_id: str, error: str) -> None:
        event = self.find_by_event_id(event_id)
        if not event:
            return
        event.status = "failed"
        event.error = error
        self.db.commit()

    def list_recent(
        self,
        *,
        limit: int = 20,
        status: str | None = None,
        tenant_id: str | None = None,
    ) -> list[WebhookEvent]:
        stmt = select(WebhookEvent)
        if status:
            stmt = stmt.where(WebhookEvent.status == status)
        if tenant_id:
            stmt = stmt.where(WebhookEvent.tenant_id == tenant_id)
        stmt = stmt.order_by(desc(WebhookEvent.created_at)).limit(limit)
        return list(self.db.scalars(stmt).all())
