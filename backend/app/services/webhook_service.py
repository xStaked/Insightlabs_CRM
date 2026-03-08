from sqlalchemy.orm import Session

from app.models.entities import WebhookEvent
from app.repositories.webhooks import WebhookRepository


class WebhookService:
    def __init__(self, db: Session):
        self.repo = WebhookRepository(db)

    def ingest(
        self,
        *,
        provider: str,
        event_id: str,
        event_type: str,
        payload: dict,
        signature_valid: bool,
        tenant_id: str | None,
    ) -> WebhookEvent:
        return self.repo.create(
            provider=provider,
            event_id=event_id,
            event_type=event_type,
            payload_json=payload,
            signature_valid=signature_valid,
            tenant_id=tenant_id,
        )
