from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.entities import AuditLog


class AuditService:
    def __init__(self, db: Session):
        self.db = db

    def log(
        self,
        *,
        tenant_id: str,
        actor_user_id: str | None,
        entity: str,
        entity_id: str,
        action: str,
        payload_json: dict | None = None,
        ip: str | None = None,
        user_agent: str | None = None,
    ) -> AuditLog:
        entry = AuditLog(
            tenant_id=tenant_id,
            actor_user_id=actor_user_id,
            entity=entity,
            entity_id=entity_id,
            action=action,
            payload_json=payload_json or {},
            ip=ip,
            user_agent=user_agent,
        )
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry
