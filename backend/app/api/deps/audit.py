from __future__ import annotations

from fastapi import Request
from sqlalchemy.orm import Session

from app.api.deps.auth import CurrentPrincipal
from app.services.audit_service import AuditService


def audit_action(
    db: Session,
    request: Request,
    principal: CurrentPrincipal,
    *,
    entity: str,
    entity_id: str,
    action: str,
    payload: dict | None = None,
) -> None:
    service = AuditService(db)
    service.log(
        tenant_id=principal.tenant_id,
        actor_user_id=principal.user_id,
        entity=entity,
        entity_id=entity_id,
        action=action,
        payload_json=payload,
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
