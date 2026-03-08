from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Lead, LeadStageHistory, PipelineStage


class LeadRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, *, tenant_id: str, name: str, phone: str | None, email: str | None, source_channel: str) -> Lead:
        lead = Lead(tenant_id=tenant_id, name=name, phone=phone, email=email, source_channel=source_channel)
        self.db.add(lead)
        self.db.commit()
        self.db.refresh(lead)
        return lead

    def list_by_tenant(self, tenant_id: str) -> list[Lead]:
        stmt = select(Lead).where(Lead.tenant_id == tenant_id).order_by(Lead.created_at.desc())
        return list(self.db.scalars(stmt).all())

    def get_by_id(self, tenant_id: str, lead_id: str) -> Lead | None:
        stmt = select(Lead).where(Lead.tenant_id == tenant_id, Lead.id == lead_id)
        return self.db.scalar(stmt)

    def get_stage_by_id(self, tenant_id: str, stage_id: str) -> PipelineStage | None:
        stmt = select(PipelineStage).where(PipelineStage.tenant_id == tenant_id, PipelineStage.id == stage_id)
        return self.db.scalar(stmt)

    def move_stage(
        self,
        *,
        tenant_id: str,
        lead_id: str,
        to_stage_id: str,
        changed_by_user_id: str,
        reason: str | None,
    ) -> Lead:
        lead = self.get_by_id(tenant_id, lead_id)
        if not lead:
            raise ValueError("Lead not found")

        stage = self.get_stage_by_id(tenant_id, to_stage_id)
        if not stage:
            raise ValueError("Target stage not found")

        previous_stage_id = lead.current_stage_id
        lead.current_stage_id = to_stage_id

        history = LeadStageHistory(
            tenant_id=tenant_id,
            lead_id=lead.id,
            from_stage_id=previous_stage_id,
            to_stage_id=to_stage_id,
            changed_by_user_id=changed_by_user_id,
            reason=reason,
        )
        self.db.add(history)
        self.db.commit()
        self.db.refresh(lead)
        return lead
