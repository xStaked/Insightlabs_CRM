from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Lead, Pipeline, PipelineStage


class PipelineRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, *, tenant_id: str, name: str, is_default: bool) -> Pipeline:
        pipeline = Pipeline(tenant_id=tenant_id, name=name, is_default=is_default)
        self.db.add(pipeline)
        self.db.commit()
        self.db.refresh(pipeline)
        return pipeline

    def list_by_tenant(self, tenant_id: str) -> list[Pipeline]:
        stmt = select(Pipeline).where(Pipeline.tenant_id == tenant_id).order_by(Pipeline.created_at.desc())
        return list(self.db.scalars(stmt).all())

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
        stage = PipelineStage(
            tenant_id=tenant_id,
            pipeline_id=pipeline_id,
            name=name,
            position=position,
            probability=probability,
            sla_hours=sla_hours,
        )
        self.db.add(stage)
        self.db.commit()
        self.db.refresh(stage)
        return stage

    def list_stages(self, tenant_id: str, pipeline_id: str) -> list[PipelineStage]:
        stmt = (
            select(PipelineStage)
            .where(PipelineStage.tenant_id == tenant_id, PipelineStage.pipeline_id == pipeline_id)
            .order_by(PipelineStage.position.asc())
        )
        return list(self.db.scalars(stmt).all())

    def get_kanban(self, tenant_id: str, pipeline_id: str) -> list[dict]:
        stages = self.list_stages(tenant_id, pipeline_id)
        if not stages:
            return []

        stage_ids = [stage.id for stage in stages]
        stmt = (
            select(Lead)
            .where(Lead.tenant_id == tenant_id, Lead.current_stage_id.in_(stage_ids))
            .order_by(Lead.updated_at.desc())
        )
        leads = list(self.db.scalars(stmt).all())

        grouped: dict[str, list[Lead]] = {stage.id: [] for stage in stages}
        for lead in leads:
            if lead.current_stage_id in grouped:
                grouped[lead.current_stage_id].append(lead)

        return [
            {
                "stage": stage,
                "leads": grouped.get(stage.id, []),
            }
            for stage in stages
        ]
