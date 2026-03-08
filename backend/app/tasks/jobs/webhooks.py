from app.core.db import SessionLocal
from app.repositories.webhooks import WebhookRepository
from app.services.billing_service import BillingService
from app.services.meta_messaging_service import MetaMessagingService
from app.tasks.worker import celery_app


@celery_app.task(name="webhooks.process_event", bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 5})
def process_webhook_event(self, event_id: str) -> str:  # noqa: ARG001
    db = SessionLocal()
    repo = WebhookRepository(db)
    try:
        event = repo.find_by_event_id(event_id)
        if not event:
            return "not_found"
        if event.status == "processed":
            return "already_processed"

        if event.provider == "meta":
            if not event.tenant_id:
                repo.mark_failed(event_id, "Missing tenant_id for meta event")
                return "failed"
            service = MetaMessagingService(db)
            service.ingest_event(event.tenant_id, event.payload_json)
            repo.mark_processed(event_id)
            return "processed"

        if event.provider == "wompi":
            service = BillingService(db)
            service.process_wompi_event(event.payload_json)
            repo.mark_processed(event_id)
            return "processed"

        repo.mark_failed(event_id, "Unsupported provider")
        return "failed"
    except Exception as exc:
        repo.mark_failed(event_id, str(exc))
        raise
    finally:
        db.close()
