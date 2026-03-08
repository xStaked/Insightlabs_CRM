from sqlalchemy.orm import Session

from app.repositories.messaging import MessagingRepository
from app.services.messaging_service import MessagingService


class MetaMessagingService:
    def __init__(self, db: Session):
        self.repo = MessagingRepository(db)
        self.messaging = MessagingService(db)

    def ingest_event(self, tenant_id: str, payload: dict) -> int:
        created_messages = 0

        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                channel = value.get("messaging_product", "whatsapp")

                contacts = value.get("contacts", [])
                contact_name = None
                if contacts:
                    profile = contacts[0].get("profile", {})
                    contact_name = profile.get("name")

                for msg in value.get("messages", []):
                    sender_id = str(msg.get("from") or "").strip()
                    provider_message_id = str(msg.get("id") or "").strip()
                    if not sender_id or not provider_message_id:
                        continue

                    text_content = msg.get("text", {}).get("body") or "[unsupported message type]"
                    external_thread_id = sender_id

                    lead = self.repo.get_lead_by_phone(tenant_id, sender_id)
                    if not lead:
                        lead = self.repo.create_lead_from_inbound(
                            tenant_id=tenant_id,
                            phone=sender_id,
                            name=contact_name,
                            channel=channel,
                        )

                    conv = self.repo.upsert_conversation(
                        tenant_id=tenant_id,
                        lead_id=lead.id,
                        channel=channel,
                        external_thread_id=external_thread_id,
                    )

                    self.repo.create_inbound_message(
                        tenant_id=tenant_id,
                        conversation_id=conv.id,
                        provider_message_id=provider_message_id,
                        content=text_content,
                    )
                    created_messages += 1

                for status_event in value.get("statuses", []):
                    provider_message_id = str(status_event.get("id") or "").strip()
                    status = str(status_event.get("status") or "").strip()
                    errors = status_event.get("errors") or []
                    error_code = None
                    if errors and isinstance(errors, list):
                        first = errors[0] or {}
                        error_code = str(first.get("code") or first.get("title") or "").strip() or None
                    if not provider_message_id or not status:
                        continue

                    self.messaging.ingest_provider_status(
                        tenant_id=tenant_id,
                        provider_message_id=provider_message_id,
                        status=status,
                        timestamp=str(status_event.get("timestamp") or "").strip() or None,
                        error_code=error_code,
                    )

        return created_messages
