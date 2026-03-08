from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps.auth import CurrentPrincipal, get_current_principal, require_roles
from app.core.db import get_db
from app.repositories.audit import AuditRepository
from app.schemas.operations import AuditLogItem

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get(
    "/logs",
    response_model=list[AuditLogItem],
    dependencies=[Depends(require_roles({"owner", "admin"}))],
)
def list_audit_logs(
    limit: int = Query(default=50, ge=1, le=200),
    entity: str | None = Query(default=None),
    action: str | None = Query(default=None),
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> list[AuditLogItem]:
    repo = AuditRepository(db)
    return [
        AuditLogItem(
            id=item.id,
            created_at=item.created_at.isoformat(),
            tenant_id=item.tenant_id,
            actor_user_id=item.actor_user_id,
            entity=item.entity,
            entity_id=item.entity_id,
            action=item.action,
            payload_json=item.payload_json,
            ip=item.ip,
            user_agent=item.user_agent,
        )
        for item in repo.list_recent(tenant_id=principal.tenant_id, limit=limit, entity=entity, action=action)
    ]
