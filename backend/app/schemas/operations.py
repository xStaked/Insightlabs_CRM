from __future__ import annotations

from pydantic import BaseModel


class AuditLogItem(BaseModel):
    id: str
    created_at: str
    tenant_id: str
    actor_user_id: str | None = None
    entity: str
    entity_id: str
    action: str
    payload_json: dict
    ip: str | None = None
    user_agent: str | None = None


class WebhookEventItem(BaseModel):
    id: str
    created_at: str
    tenant_id: str | None = None
    provider: str
    event_id: str
    event_type: str
    signature_valid: bool
    status: str
    processed_at: str | None = None
    error: str | None = None


class RateLimitStatusItem(BaseModel):
    namespace: str
    limit: int
    window_seconds: int
    active_keys: int
    max_hits: int
    retry_after_seconds: int
    saturated: bool


class OperationsStatus(BaseModel):
    rate_limits: list[RateLimitStatusItem]
    failed_webhooks: list[WebhookEventItem]
