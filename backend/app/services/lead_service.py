from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.entities import Lead
from app.repositories.leads import LeadRepository


class LeadService:
    def __init__(self, db: Session):
        self.repo = LeadRepository(db)

    def create(self, *, tenant_id: str, name: str, phone: str | None, email: str | None, source_channel: str) -> Lead:
        return self.repo.create(
            tenant_id=tenant_id,
            name=name,
            phone=phone,
            email=email,
            source_channel=source_channel,
        )

    def list(self, tenant_id: str) -> list[Lead]:
        return self.repo.list_by_tenant(tenant_id)

    def move_stage(
        self,
        *,
        tenant_id: str,
        lead_id: str,
        to_stage_id: str,
        changed_by_user_id: str,
        reason: str | None,
    ) -> Lead:
        return self.repo.move_stage(
            tenant_id=tenant_id,
            lead_id=lead_id,
            to_stage_id=to_stage_id,
            changed_by_user_id=changed_by_user_id,
            reason=reason,
        )
