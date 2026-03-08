from pydantic import BaseModel, EmailStr

from app.schemas.common import ApiItem


class LeadCreate(BaseModel):
    name: str
    phone: str | None = None
    email: EmailStr | None = None
    source_channel: str = "manual"


class LeadMoveStageInput(BaseModel):
    to_stage_id: str
    reason: str | None = None


class LeadOut(ApiItem):
    tenant_id: str
    assigned_user_id: str | None = None
    current_stage_id: str | None = None
    name: str
    phone: str | None = None
    email: str | None = None
    source_channel: str
    status: str
    score_total: int
    temperature: str
