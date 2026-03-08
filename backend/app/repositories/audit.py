from __future__ import annotations

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.entities import AuditLog


class AuditRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_recent(
        self,
        *,
        tenant_id: str,
        limit: int = 50,
        entity: str | None = None,
        action: str | None = None,
    ) -> list[AuditLog]:
        stmt = select(AuditLog).where(AuditLog.tenant_id == tenant_id)
        if entity:
            stmt = stmt.where(AuditLog.entity == entity)
        if action:
            stmt = stmt.where(AuditLog.action == action)
        stmt = stmt.order_by(desc(AuditLog.created_at)).limit(limit)
        return list(self.db.scalars(stmt).all())
