from pydantic import BaseModel

from app.schemas.common import ApiItem
from app.schemas.leads import LeadOut


class PipelineCreate(BaseModel):
    name: str
    is_default: bool = False


class PipelineOut(ApiItem):
    tenant_id: str
    name: str
    is_default: bool
    is_active: bool


class PipelineStageCreate(BaseModel):
    name: str
    position: int
    probability: int = 0
    sla_hours: int | None = None


class PipelineStageOut(ApiItem):
    tenant_id: str
    pipeline_id: str
    name: str
    position: int
    probability: int
    sla_hours: int | None = None


class KanbanColumn(BaseModel):
    stage: PipelineStageOut
    leads: list[LeadOut]
