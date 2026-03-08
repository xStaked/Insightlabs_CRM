from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models.entities import Message
from app.repositories.messaging import MessagingRepository


class MessagingService:
    def __init__(self, db: Session):
        self.repo = MessagingRepository(db)

    def list_conversations(
        self,
        *,
        tenant_id: str,
        channel: str | None = None,
        status: str | None = None,
        advisor_user_id: str | None = None,
    ) -> list[dict]:
        return self.repo.list_conversations(
            tenant_id,
            channel=channel,
            status=status,
            advisor_user_id=advisor_user_id,
        )

    def get_conversation_detail(self, *, tenant_id: str, conversation_id: str) -> dict:
        summaries = self.repo.list_conversations(tenant_id, channel=None, status=None, advisor_user_id=None)
        summary = next((item for item in summaries if item["conversation"].id == conversation_id), None)
        if not summary:
            raise ValueError("Conversation not found")

        messages = self.repo.list_messages(tenant_id, conversation_id)
        return {**summary, "messages": messages}

    def queue_outbound_message(self, *, tenant_id: str, conversation_id: str, content: str) -> Message:
        conversation = self.repo.get_conversation_by_id(tenant_id, conversation_id)
        if not conversation:
            raise ValueError("Conversation not found")
        return self.repo.create_outbound_message(tenant_id=tenant_id, conversation_id=conversation_id, content=content)

    def ingest_provider_status(
        self,
        *,
        tenant_id: str,
        provider_message_id: str,
        status: str,
        timestamp: str | None = None,
        error_code: str | None = None,
    ) -> Message | None:
        return self.repo.mark_message_provider_status(
            tenant_id,
            provider_message_id,
            status=status,
            occurred_at=self._parse_provider_timestamp(timestamp),
            error_code=error_code,
        )

    def _parse_provider_timestamp(self, value: str | None) -> datetime | None:
        if not value:
            return None

        try:
            return datetime.fromtimestamp(int(value), UTC)
        except (TypeError, ValueError):
            return None
