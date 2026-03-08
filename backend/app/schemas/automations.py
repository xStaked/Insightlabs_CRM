from typing import Any

from pydantic import BaseModel, Field

from app.schemas.common import ApiItem


class AutomationCondition(BaseModel):
    field: str
    op: str = "eq"
    value: Any = None


class AutomationAction(BaseModel):
    type: str
    task_type: str | None = None
    priority: str | None = None
    delay_hours: int | None = None
    delay_days: int | None = None
    schedule: str | None = None
    assigned_user_id: str | None = None
    name: str | None = None
    color: str | None = None
    points: int | None = None
    reason: str | None = None
    event_type: str | None = None


class AutomationCreate(BaseModel):
    name: str
    trigger_type: str
    conditions: list[AutomationCondition] = Field(default_factory=list)
    actions: list[AutomationAction] = Field(default_factory=list)
    is_active: bool = True


class AutomationUpdate(BaseModel):
    name: str | None = None
    trigger_type: str | None = None
    conditions: list[AutomationCondition] | None = None
    actions: list[AutomationAction] | None = None
    is_active: bool | None = None


class AutomationOut(ApiItem):
    tenant_id: str
    name: str
    trigger_type: str
    conditions_json: dict[str, Any]
    actions_json: dict[str, Any] | list[dict[str, Any]]
    is_active: bool


class AutomationRunOut(ApiItem):
    tenant_id: str
    automation_id: str
    entity_type: str
    entity_id: str
    status: str
    attempts: int
    idempotency_key: str
    error: str | None


class LeadScoreOut(ApiItem):
    tenant_id: str
    lead_id: str
    event_type: str
    points: int
    reason: str
    metadata_json: dict[str, Any]


class LeadTagOut(ApiItem):
    tenant_id: str
    name: str
    color: str | None


class AutomationTagSuggestion(BaseModel):
    name: str
    color: str | None = None
    source_automation_ids: list[str] = Field(default_factory=list)
