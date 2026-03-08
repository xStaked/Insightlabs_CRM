from __future__ import annotations

from redis import RedisError
from sqlalchemy.orm import Session

from app.core.redis import redis_client
from app.repositories.webhooks import WebhookRepository

RATE_LIMIT_NAMESPACES = (
    {"namespace": "auth_login", "limit": 10, "window_seconds": 60},
    {"namespace": "auth_refresh", "limit": 20, "window_seconds": 60},
    {"namespace": "auth_logout", "limit": 20, "window_seconds": 60},
    {"namespace": "webhooks_meta", "limit": 120, "window_seconds": 60},
    {"namespace": "webhooks_wompi", "limit": 120, "window_seconds": 60},
)


class OperationsService:
    def __init__(self, db: Session):
        self.webhook_repo = WebhookRepository(db)

    def rate_limit_status(self) -> list[dict]:
        items: list[dict] = []

        for spec in RATE_LIMIT_NAMESPACES:
            namespace = spec["namespace"]
            pattern = f"rate_limit:{namespace}:*"
            active_keys = 0
            max_hits = 0
            retry_after_seconds = 0

            try:
                for key in redis_client.scan_iter(match=pattern):
                    active_keys += 1
                    current_hits = int(redis_client.get(key) or 0)
                    ttl = max(int(redis_client.ttl(key) or 0), 0)
                    max_hits = max(max_hits, current_hits)
                    retry_after_seconds = max(retry_after_seconds, ttl)
            except RedisError:
                active_keys = 0
                max_hits = 0
                retry_after_seconds = 0

            items.append(
                {
                    **spec,
                    "active_keys": active_keys,
                    "max_hits": max_hits,
                    "retry_after_seconds": retry_after_seconds,
                    "saturated": max_hits >= spec["limit"],
                }
            )

        return items

    def failed_webhooks(self, tenant_id: str, *, limit: int = 20) -> list[dict]:
        return [
            {
                "id": item.id,
                "created_at": item.created_at.isoformat(),
                "tenant_id": item.tenant_id,
                "provider": item.provider,
                "event_id": item.event_id,
                "event_type": item.event_type,
                "signature_valid": item.signature_valid,
                "status": item.status,
                "processed_at": item.processed_at.isoformat() if item.processed_at else None,
                "error": item.error,
            }
            for item in self.webhook_repo.list_recent(limit=limit, status="failed", tenant_id=tenant_id)
        ]

    def summary(self, tenant_id: str) -> dict[str, list[dict]]:
        return {
            "rate_limits": self.rate_limit_status(),
            "failed_webhooks": self.failed_webhooks(tenant_id),
        }
