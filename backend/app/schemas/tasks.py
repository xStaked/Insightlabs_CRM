from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import ApiItem


class TaskCreate(BaseModel):
    lead_id: str | None = None
    assigned_user_id: str | None = None
    type: str
    due_at: datetime | None = None
    priority: str = "medium"


class TaskUpdateStatus(BaseModel):
    status: str


class TaskOut(ApiItem):
    tenant_id: str
    lead_id: str | None
    assigned_user_id: str | None
    type: str
    due_at: datetime | None
    status: str
    priority: str
    origin: str
