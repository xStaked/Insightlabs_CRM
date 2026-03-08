from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.entities import Pipeline, PipelineStage
from app.repositories.pipelines import PipelineRepository
from app.schemas.leads import LeadOut
from app.schemas.pipelines import KanbanColumn, PipelineStageOut


class PipelineService:
    def __init__(self, db: Session):
        self.repo = PipelineRepository(db)

    def create(self, *, tenant_id: str, name: str, is_default: bool) -> Pipeline:
        return self.repo.create(tenant_id=tenant_id, name=name, is_default=is_default)

    def list(self, tenant_id: str) -> list[Pipeline]:
        return self.repo.list_by_tenant(tenant_id)

    def create_stage(
        self,
        *,
        tenant_id: str,
        pipeline_id: str,
        name: str,
        position: int,
        probability: int,
        sla_hours: int | None,
    ) -> PipelineStage:
        return self.repo.create_stage(
            tenant_id=tenant_id,
            pipeline_id=pipeline_id,
            name=name,
            position=position,
            probability=probability,
            sla_hours=sla_hours,
        )

    def list_stages(self, tenant_id: str, pipeline_id: str) -> list[PipelineStage]:
        return self.repo.list_stages(tenant_id, pipeline_id)

    def kanban(self, tenant_id: str, pipeline_id: str) -> list[KanbanColumn]:
        data = self.repo.get_kanban(tenant_id, pipeline_id)
        return [
            KanbanColumn(
                stage=PipelineStageOut.model_validate(item["stage"], from_attributes=True),
                leads=[LeadOut.model_validate(lead, from_attributes=True) for lead in item["leads"]],
            )
            for item in data
        ]
