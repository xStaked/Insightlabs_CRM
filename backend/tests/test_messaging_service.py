from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.messaging_service import MessagingService
from app.services.meta_messaging_service import MetaMessagingService


@dataclass
class FakeConversation:
    id: str
    tenant_id: str
    lead_id: str | None
    assigned_user_id: str | None
    channel: str
    status: str
    external_thread_id: str
    last_message_at: datetime | None
    created_at: datetime
    updated_at: datetime


@dataclass
class FakeMessage:
    id: str
    tenant_id: str
    conversation_id: str
    direction: str
    provider_message_id: str | None
    content: str
    message_type: str
    status: str
    created_at: datetime
    updated_at: datetime
    sent_at: datetime | None = None
    delivered_at: datetime | None = None
    read_at: datetime | None = None
    error_code: str | None = None


class FakeMessagingRepository:
    def __init__(self, now: datetime):
        self.now = now
        self.summary = {
            "conversation": FakeConversation(
                id="conv-1",
                tenant_id="tenant-1",
                lead_id="lead-1",
                assigned_user_id="user-1",
                channel="whatsapp",
                status="open",
                external_thread_id="573001112233",
                last_message_at=now,
                created_at=now,
                updated_at=now,
            ),
            "lead_name": "Ana Perez",
            "lead_phone": "+573001112233",
            "lead_email": "ana@example.com",
            "lead_temperature": "hot",
            "assigned_user_id": "user-1",
            "assigned_advisor_name": "Laura Gomez",
            "unread_count": 1,
            "last_message_preview": "Te comparto la propuesta.",
        }
        self.messages = [
            FakeMessage(
                id="msg-1",
                tenant_id="tenant-1",
                conversation_id="conv-1",
                direction="outbound",
                provider_message_id="wamid-1",
                content="Te comparto la propuesta.",
                message_type="text",
                status="sent",
                created_at=now,
                updated_at=now,
                sent_at=now,
            )
        ]

    def list_conversations(self, tenant_id: str, **_: object) -> list[dict]:
        return [self.summary] if tenant_id == "tenant-1" else []

    def list_messages(self, tenant_id: str, conversation_id: str) -> list[FakeMessage]:
        if tenant_id == "tenant-1" and conversation_id == "conv-1":
            return self.messages
        return []

    def get_conversation_by_id(self, tenant_id: str, conversation_id: str) -> FakeConversation | None:
        if tenant_id == "tenant-1" and conversation_id == "conv-1":
            return self.summary["conversation"]
        return None

    def create_outbound_message(self, *, tenant_id: str, conversation_id: str, content: str) -> FakeMessage:
        message = FakeMessage(
            id="msg-2",
            tenant_id=tenant_id,
            conversation_id=conversation_id,
            direction="outbound",
            provider_message_id=None,
            content=content,
            message_type="text",
            status="queued",
            created_at=self.now,
            updated_at=self.now,
        )
        self.messages.append(message)
        return message

    def mark_message_provider_status(
        self,
        tenant_id: str,
        provider_message_id: str,
        *,
        status: str,
        occurred_at: datetime | None = None,
        error_code: str | None = None,
    ) -> FakeMessage | None:
        for message in self.messages:
            if message.tenant_id == tenant_id and message.provider_message_id == provider_message_id:
                message.status = status
                if status == "delivered":
                    message.delivered_at = occurred_at
                if status == "read":
                    message.read_at = occurred_at
                if status == "failed":
                    message.error_code = error_code
                return message
        return None


class FakeMetaRepo:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str, str | None, str | None]] = []

    def get_lead_by_phone(self, tenant_id: str, phone: str):  # noqa: ANN001
        return None

    def create_lead_from_inbound(self, tenant_id: str, phone: str, name: str | None, channel: str):  # noqa: ANN001
        return type("Lead", (), {"id": "lead-1"})()

    def upsert_conversation(self, tenant_id: str, lead_id: str, channel: str, external_thread_id: str):  # noqa: ANN001
        return type("Conversation", (), {"id": "conv-1"})()

    def create_inbound_message(self, *, tenant_id: str, conversation_id: str, provider_message_id: str, content: str):  # noqa: ANN001
        self.calls.append(("inbound", conversation_id, provider_message_id, content))
        return None


class FakeProviderStatusService:
    def __init__(self) -> None:
        self.events: list[dict] = []

    def ingest_provider_status(self, **payload: object) -> None:
        self.events.append(payload)


class MessagingServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.now = datetime(2026, 3, 8, 12, 0, tzinfo=UTC)
        self.repo = FakeMessagingRepository(self.now)
        self.service = MessagingService.__new__(MessagingService)
        self.service.repo = self.repo

    def test_get_conversation_detail_returns_messages(self) -> None:
        detail = self.service.get_conversation_detail(tenant_id="tenant-1", conversation_id="conv-1")

        self.assertEqual(detail["lead_name"], "Ana Perez")
        self.assertEqual(len(detail["messages"]), 1)
        self.assertEqual(detail["messages"][0].status, "sent")

    def test_ingest_provider_status_parses_unix_timestamp(self) -> None:
        result = self.service.ingest_provider_status(
            tenant_id="tenant-1",
            provider_message_id="wamid-1",
            status="read",
            timestamp="1772971200",
        )

        self.assertIsNotNone(result)
        self.assertEqual(result.status, "read")
        self.assertEqual(result.read_at, datetime(2026, 3, 8, 12, 0, tzinfo=UTC))


class MetaMessagingServiceTests(unittest.TestCase):
    def test_ingest_event_processes_inbound_messages_and_provider_statuses(self) -> None:
        service = MetaMessagingService.__new__(MetaMessagingService)
        service.repo = FakeMetaRepo()
        service.messaging = FakeProviderStatusService()

        processed = service.ingest_event(
            "tenant-1",
            {
                "entry": [
                    {
                        "changes": [
                            {
                                "value": {
                                    "messaging_product": "whatsapp",
                                    "contacts": [{"profile": {"name": "Ana Perez"}}],
                                    "messages": [
                                        {
                                            "from": "573001112233",
                                            "id": "wamid-1",
                                            "text": {"body": "Hola"},
                                        }
                                    ],
                                    "statuses": [
                                        {
                                            "id": "wamid-1",
                                            "status": "delivered",
                                            "timestamp": "1772971200",
                                        }
                                    ],
                                }
                            }
                        ]
                    }
                ]
            },
        )

        self.assertEqual(processed, 1)
        self.assertEqual(service.repo.calls[0], ("inbound", "conv-1", "wamid-1", "Hola"))
        self.assertEqual(service.messaging.events[0]["status"], "delivered")
