from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.entities import Conversation, Lead, Message, User


class MessagingRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_lead_by_phone(self, tenant_id: str, phone: str) -> Lead | None:
        stmt = select(Lead).where(Lead.tenant_id == tenant_id, Lead.phone == phone)
        return self.db.scalar(stmt)

    def create_lead_from_inbound(self, tenant_id: str, phone: str, name: str | None, channel: str) -> Lead:
        lead = Lead(
            tenant_id=tenant_id,
            name=name or f"Lead {phone}",
            phone=phone,
            source_channel=channel,
            status="new",
            temperature="cold",
        )
        self.db.add(lead)
        self.db.commit()
        self.db.refresh(lead)
        return lead

    def get_conversation(self, tenant_id: str, channel: str, external_thread_id: str) -> Conversation | None:
        stmt = select(Conversation).where(
            Conversation.tenant_id == tenant_id,
            Conversation.channel == channel,
            Conversation.external_thread_id == external_thread_id,
        )
        return self.db.scalar(stmt)

    def get_conversation_by_id(self, tenant_id: str, conversation_id: str) -> Conversation | None:
        stmt = select(Conversation).where(Conversation.tenant_id == tenant_id, Conversation.id == conversation_id)
        return self.db.scalar(stmt)

    def upsert_conversation(self, tenant_id: str, lead_id: str, channel: str, external_thread_id: str) -> Conversation:
        lead = self.get_lead(tenant_id, lead_id)
        conversation = self.get_conversation(tenant_id, channel, external_thread_id)
        if conversation:
            conversation.lead_id = conversation.lead_id or lead_id
            if lead and not conversation.assigned_user_id:
                conversation.assigned_user_id = lead.assigned_user_id
            conversation.last_message_at = datetime.now(UTC)
            self.db.commit()
            self.db.refresh(conversation)
            return conversation

        conversation = Conversation(
            tenant_id=tenant_id,
            lead_id=lead_id,
            assigned_user_id=lead.assigned_user_id if lead else None,
            channel=channel,
            external_thread_id=external_thread_id,
            status="open",
            last_message_at=datetime.now(UTC),
        )
        self.db.add(conversation)
        self.db.commit()
        self.db.refresh(conversation)
        return conversation

    def get_lead(self, tenant_id: str, lead_id: str) -> Lead | None:
        stmt = select(Lead).where(Lead.tenant_id == tenant_id, Lead.id == lead_id)
        return self.db.scalar(stmt)

    def message_exists(self, tenant_id: str, provider_message_id: str) -> bool:
        stmt = select(Message.id).where(
            Message.tenant_id == tenant_id,
            Message.provider_message_id == provider_message_id,
        )
        return self.db.scalar(stmt) is not None

    def create_inbound_message(
        self,
        *,
        tenant_id: str,
        conversation_id: str,
        provider_message_id: str,
        content: str,
    ) -> Message:
        if self.message_exists(tenant_id, provider_message_id):
            stmt = select(Message).where(
                Message.tenant_id == tenant_id,
                Message.provider_message_id == provider_message_id,
            )
            existing = self.db.scalar(stmt)
            return existing

        message = Message(
            tenant_id=tenant_id,
            conversation_id=conversation_id,
            direction="inbound",
            provider_message_id=provider_message_id,
            content=content,
            message_type="text",
            status="received",
            sent_at=datetime.now(UTC),
        )
        self.db.add(message)
        conversation = self.get_conversation_by_id(tenant_id, conversation_id)
        if conversation:
            conversation.last_message_at = message.sent_at
        self.db.commit()
        self.db.refresh(message)
        return message

    def create_outbound_message(self, *, tenant_id: str, conversation_id: str, content: str) -> Message:
        message = Message(
            tenant_id=tenant_id,
            conversation_id=conversation_id,
            direction="outbound",
            provider_message_id=None,
            content=content,
            message_type="text",
            status="queued",
        )
        self.db.add(message)
        conversation = self.get_conversation_by_id(tenant_id, conversation_id)
        if conversation:
            conversation.last_message_at = datetime.now(UTC)
        self.db.commit()
        self.db.refresh(message)
        return message

    def get_message_by_id(self, tenant_id: str, message_id: str) -> Message | None:
        stmt = select(Message).where(Message.tenant_id == tenant_id, Message.id == message_id)
        return self.db.scalar(stmt)

    def get_message_by_provider_id(self, tenant_id: str, provider_message_id: str) -> Message | None:
        stmt = select(Message).where(
            Message.tenant_id == tenant_id,
            Message.provider_message_id == provider_message_id,
        )
        return self.db.scalar(stmt)

    def mark_message_sent(self, tenant_id: str, message_id: str, provider_message_id: str | None) -> Message | None:
        message = self.get_message_by_id(tenant_id, message_id)
        if not message:
            return None
        message.status = "sent"
        message.provider_message_id = provider_message_id or message.provider_message_id
        message.sent_at = datetime.now(UTC)
        self.db.commit()
        self.db.refresh(message)
        return message

    def mark_message_failed(self, tenant_id: str, message_id: str, error_code: str) -> Message | None:
        message = self.get_message_by_id(tenant_id, message_id)
        if not message:
            return None
        message.status = "failed"
        message.error_code = error_code
        self.db.commit()
        self.db.refresh(message)
        return message

    def mark_message_provider_status(
        self,
        tenant_id: str,
        provider_message_id: str,
        *,
        status: str,
        occurred_at: datetime | None = None,
        error_code: str | None = None,
    ) -> Message | None:
        message = self.get_message_by_provider_id(tenant_id, provider_message_id)
        if not message:
            return None

        event_time = occurred_at or datetime.now(UTC)
        message.status = status

        if status == "sent":
            message.sent_at = event_time
        elif status == "delivered":
            message.sent_at = message.sent_at or event_time
            message.delivered_at = event_time
        elif status == "read":
            message.sent_at = message.sent_at or event_time
            message.delivered_at = message.delivered_at or event_time
            message.read_at = event_time
        elif status == "failed":
            message.error_code = error_code or message.error_code or "provider_failed"

        self.db.commit()
        self.db.refresh(message)
        return message

    def list_conversations(
        self,
        tenant_id: str,
        *,
        channel: str | None = None,
        status: str | None = None,
        advisor_user_id: str | None = None,
    ) -> list[dict]:
        owner_id = func.coalesce(Conversation.assigned_user_id, Lead.assigned_user_id)
        stmt = (
            select(
                Conversation,
                Lead.name.label("lead_name"),
                Lead.phone.label("lead_phone"),
                Lead.email.label("lead_email"),
                Lead.temperature.label("lead_temperature"),
                owner_id.label("assigned_user_id"),
                func.coalesce(User.full_name, "Unassigned").label("assigned_advisor_name"),
            )
            .outerjoin(Lead, Lead.id == Conversation.lead_id)
            .outerjoin(User, User.id == owner_id)
            .where(Conversation.tenant_id == tenant_id)
            .order_by(Conversation.last_message_at.desc().nullslast(), Conversation.created_at.desc())
        )

        if channel:
            stmt = stmt.where(Conversation.channel == channel)
        if status:
            stmt = stmt.where(Conversation.status == status)
        if advisor_user_id:
            stmt = stmt.where(owner_id == advisor_user_id)

        rows = self.db.execute(stmt).all()
        conversation_ids = [row[0].id for row in rows]
        message_meta = self._message_meta_by_conversation(tenant_id, conversation_ids)

        return [
            {
                "conversation": row[0],
                "lead_name": row[1] or "Unknown lead",
                "lead_phone": row[2],
                "lead_email": row[3],
                "lead_temperature": row[4] or "cold",
                "assigned_user_id": row[5],
                "assigned_advisor_name": row[6],
                **message_meta.get(row[0].id, {"unread_count": 0, "last_message_preview": None}),
            }
            for row in rows
        ]

    def list_messages(self, tenant_id: str, conversation_id: str) -> list[Message]:
        stmt = (
            select(Message)
            .where(Message.tenant_id == tenant_id, Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc())
        )
        return list(self.db.scalars(stmt))

    def _message_meta_by_conversation(self, tenant_id: str, conversation_ids: list[str]) -> dict[str, dict]:
        if not conversation_ids:
            return {}

        stmt = (
            select(Message)
            .where(Message.tenant_id == tenant_id, Message.conversation_id.in_(conversation_ids))
            .order_by(Message.conversation_id.asc(), Message.created_at.asc())
        )
        rows = list(self.db.scalars(stmt))
        result: dict[str, dict] = {}

        for message in rows:
            meta = result.setdefault(message.conversation_id, {"unread_count": 0, "last_message_preview": None})
            meta["last_message_preview"] = message.content
            if message.direction == "inbound" and message.status != "read":
                meta["unread_count"] += 1

        return result
