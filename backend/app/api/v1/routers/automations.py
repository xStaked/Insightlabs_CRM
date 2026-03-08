from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps.audit import audit_action
from app.api.deps.auth import CurrentPrincipal, get_current_principal, require_roles
from app.api.deps.subscription import require_active_subscription
from app.core.db import get_db
from app.schemas.automations import (
    AutomationCreate,
    AutomationOut,
    AutomationRunOut,
    AutomationTagSuggestion,
    AutomationUpdate,
    LeadScoreOut,
    LeadTagOut,
)
from app.services.automations_service import AutomationsService

router = APIRouter(prefix="/automations", tags=["automations"])


@router.get(
    "",
    response_model=list[AutomationOut],
    dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin", "advisor", "viewer"}))],
)
def list_automations(
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> list[AutomationOut]:
    service = AutomationsService(db)
    return [AutomationOut.model_validate(item, from_attributes=True) for item in service.list(principal.tenant_id)]


@router.post(
    "",
    response_model=AutomationOut,
    dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin", "advisor"}))],
)
def create_automation(
    payload: AutomationCreate,
    request: Request,
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> AutomationOut:
    service = AutomationsService(db)
    automation = service.create(
        tenant_id=principal.tenant_id,
        name=payload.name,
        trigger_type=payload.trigger_type,
        conditions=[item.model_dump() for item in payload.conditions],
        actions=[item.model_dump(exclude_none=True) for item in payload.actions],
        is_active=payload.is_active,
    )
    audit_action(
        db,
        request,
        principal,
        entity="automation",
        entity_id=automation.id,
        action="create",
        payload={
            "name": automation.name,
            "trigger_type": automation.trigger_type,
            "is_active": automation.is_active,
        },
    )
    return AutomationOut.model_validate(automation, from_attributes=True)


@router.patch(
    "/{automation_id}",
    response_model=AutomationOut,
    dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin", "advisor"}))],
)
def update_automation(
    automation_id: str,
    payload: AutomationUpdate,
    request: Request,
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> AutomationOut:
    service = AutomationsService(db)
    automation = service.update(
        tenant_id=principal.tenant_id,
        automation_id=automation_id,
        name=payload.name,
        trigger_type=payload.trigger_type,
        conditions=[item.model_dump() for item in payload.conditions] if payload.conditions is not None else None,
        actions=[item.model_dump(exclude_none=True) for item in payload.actions] if payload.actions is not None else None,
        is_active=payload.is_active,
    )
    if automation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Automation not found")

    audit_action(
        db,
        request,
        principal,
        entity="automation",
        entity_id=automation.id,
        action="update",
        payload=payload.model_dump(exclude_none=True),
    )
    return AutomationOut.model_validate(automation, from_attributes=True)


@router.get(
    "/runs",
    response_model=list[AutomationRunOut],
    dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin", "advisor", "viewer"}))],
)
def list_automation_runs(
    automation_id: str | None = None,
    entity_id: str | None = None,
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> list[AutomationRunOut]:
    service = AutomationsService(db)
    return [
        AutomationRunOut.model_validate(item, from_attributes=True)
        for item in service.list_runs(principal.tenant_id, automation_id=automation_id, entity_id=entity_id)
    ]


@router.get(
    "/lead-scores/{lead_id}",
    response_model=list[LeadScoreOut],
    dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin", "advisor", "viewer"}))],
)
def list_lead_scores(
    lead_id: str,
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> list[LeadScoreOut]:
    service = AutomationsService(db)
    return [LeadScoreOut.model_validate(item, from_attributes=True) for item in service.list_lead_scores(principal.tenant_id, lead_id)]


@router.get(
    "/lead-tags/{lead_id}",
    response_model=list[LeadTagOut],
    dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin", "advisor", "viewer"}))],
)
def list_lead_tags(
    lead_id: str,
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> list[LeadTagOut]:
    service = AutomationsService(db)
    return [LeadTagOut.model_validate(item, from_attributes=True) for item in service.list_lead_tags(principal.tenant_id, lead_id)]


@router.get(
    "/tag-suggestions",
    response_model=list[AutomationTagSuggestion],
    dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin", "advisor", "viewer"}))],
)
def list_tag_suggestions(
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> list[AutomationTagSuggestion]:
    service = AutomationsService(db)
    return [AutomationTagSuggestion.model_validate(item) for item in service.list_tag_suggestions(principal.tenant_id)]
