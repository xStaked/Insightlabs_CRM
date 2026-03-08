from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import ApiItem


class AppointmentCreate(BaseModel):
    lead_id: str | None = None
    owner_user_id: str | None = None
    starts_at: datetime
    ends_at: datetime
    location: str | None = None
    notes: str | None = None


class AppointmentUpdateStatus(BaseModel):
    status: str


class AppointmentOut(ApiItem):
    tenant_id: str
    lead_id: str | None
    owner_user_id: str | None
    starts_at: datetime
    ends_at: datetime
    status: str
    location: str | None
    notes: str | None
    reminder_status: str
