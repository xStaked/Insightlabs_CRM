from __future__ import annotations

from app.core.db import SessionLocal
from app.integrations.meta.outbound import MetaOutboundClient, NonRetriableProviderError, RetriableProviderError
from app.repositories.messaging import MessagingRepository
from app.repositories.webhooks import WebhookRepository
from app.services.meta_messaging_service import MetaMessagingService
from app.tasks.worker import celery_app


@celery_app.task(name="messaging.process_meta_event", bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 5})
def process_meta_event(self, event_id: str) -> dict[str, int | str]:  # noqa: ARG001
    db = SessionLocal()
    repo = WebhookRepository(db)
    service = MetaMessagingService(db)
    try:
        event = repo.find_by_event_id(event_id)
        if not event:
            return {"status": "not_found", "processed": 0}
        if event.status == "processed":
            return {"status": "already_processed", "processed": 0}

        if not event.tenant_id:
            repo.mark_failed(event_id, "Missing tenant_id for meta event")
            return {"status": "failed", "processed": 0}

        processed = service.ingest_event(event.tenant_id, event.payload_json)
        repo.mark_processed(event_id)
        return {"status": "processed", "processed": processed}
    except Exception as exc:
        repo.mark_failed(event_id, str(exc))
        raise
    finally:
        db.close()


@celery_app.task(name="messaging.send_outbound", bind=True, autoretry_for=(RetriableProviderError,), retry_backoff=True, retry_kwargs={"max_retries": 5})
def send_outbound(self, tenant_id: str, message_id: str) -> str:  # noqa: ARG001
    db = SessionLocal()
    repo = MessagingRepository(db)
    client = MetaOutboundClient()
    try:
        message = repo.get_message_by_id(tenant_id, message_id)
        if not message:
            return "not_found"

        conversation = repo.get_conversation_by_id(tenant_id, message.conversation_id)
        if not conversation:
            repo.mark_message_failed(tenant_id, message_id, "conversation_not_found")
            return "failed"

        payload = {
            "conversation_id": conversation.external_thread_id,
            "content": message.content,
            "channel": conversation.channel,
        }

        if conversation.channel == "instagram":
            response = client.send_instagram(payload)
        else:
            response = client.send_whatsapp(payload)

        provider_message_id = str(response.get("id") or response.get("provider_message_id") or "") or None
        repo.mark_message_sent(tenant_id, message_id, provider_message_id)
        return "sent"
    except NonRetriableProviderError as exc:
        repo.mark_message_failed(tenant_id, message_id, f"non_retriable:{exc}")
        return "failed"
    except RetriableProviderError as exc:
        repo.mark_message_failed(tenant_id, message_id, f"retriable:{exc}")
        raise
    except Exception as exc:
        repo.mark_message_failed(tenant_id, message_id, f"unexpected:{exc}")
        raise
    finally:
        db.close()
