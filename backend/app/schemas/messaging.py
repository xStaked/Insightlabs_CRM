from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import ApiItem


class OutboundMessageInput(BaseModel):
    conversation_id: str
    content: str


class MessageOut(ApiItem):
    tenant_id: str
    conversation_id: str
    direction: str
    provider_message_id: str | None
    content: str
    message_type: str
    status: str
    sent_at: datetime | None
    delivered_at: datetime | None
    read_at: datetime | None
    error_code: str | None


class ConversationSummaryOut(ApiItem):
    tenant_id: str
    lead_id: str | None
    lead_name: str
    lead_phone: str | None
    lead_email: str | None
    lead_temperature: str
    assigned_user_id: str | None
    assigned_advisor_name: str
    channel: str
    status: str
    last_message_at: datetime | None
    unread_count: int
    last_message_preview: str | None


class ConversationDetailOut(ConversationSummaryOut):
    messages: list[MessageOut]
