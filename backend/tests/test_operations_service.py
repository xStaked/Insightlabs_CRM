from __future__ import annotations

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.operations_service import OperationsService


class FakeRedis:
    def scan_iter(self, match: str):
        if match == "rate_limit:auth_login:*":
            return iter(["rate_limit:auth_login:1", "rate_limit:auth_login:2"])
        return iter([])

    def get(self, key: str) -> str:
        values = {
            "rate_limit:auth_login:1": "7",
            "rate_limit:auth_login:2": "10",
        }
        return values.get(key, "0")

    def ttl(self, key: str) -> int:
        values = {
            "rate_limit:auth_login:1": 24,
            "rate_limit:auth_login:2": 59,
        }
        return values.get(key, 0)


class FakeWebhookRepo:
    def list_recent(self, *, limit: int = 20, status: str | None = None, tenant_id: str | None = None):
        return [
            type(
                "WebhookEvent",
                (),
                {
                    "id": "evt-row-1",
                    "created_at": type("IsoDate", (), {"isoformat": lambda self: "2026-03-08T12:00:00+00:00"})(),
                    "tenant_id": "tenant-1",
                    "provider": "meta",
                    "event_id": "evt-1",
                    "event_type": "message.received",
                    "signature_valid": True,
                    "status": "failed",
                    "processed_at": None,
                    "error": "Upstream timeout",
                },
            )()
        ]


class OperationsServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = OperationsService.__new__(OperationsService)
        self.service.webhook_repo = FakeWebhookRepo()

        import app.services.operations_service as operations_module

        self.original_redis = operations_module.redis_client
        operations_module.redis_client = FakeRedis()
        self.operations_module = operations_module

    def tearDown(self) -> None:
        self.operations_module.redis_client = self.original_redis

    def test_rate_limit_status_aggregates_namespace_usage(self) -> None:
        result = self.service.rate_limit_status()
        auth_login = next(item for item in result if item["namespace"] == "auth_login")

        self.assertEqual(auth_login["active_keys"], 2)
        self.assertEqual(auth_login["max_hits"], 10)
        self.assertEqual(auth_login["retry_after_seconds"], 59)
        self.assertTrue(auth_login["saturated"])

    def test_summary_includes_failed_webhooks(self) -> None:
        result = self.service.summary("tenant-1")

        self.assertEqual(result["failed_webhooks"][0]["provider"], "meta")
        self.assertEqual(result["failed_webhooks"][0]["error"], "Upstream timeout")
