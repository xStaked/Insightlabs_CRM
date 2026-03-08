from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps.audit import audit_action
from app.api.deps.auth import CurrentPrincipal, get_current_principal, require_roles
from app.api.deps.subscription import require_active_subscription
from app.core.db import get_db
from app.schemas.leads import LeadCreate, LeadMoveStageInput, LeadOut
from app.services.lead_service import LeadService
from app.tasks.jobs.automations import evaluate_trigger

router = APIRouter(prefix="/leads", tags=["leads"])


@router.post("", response_model=LeadOut, dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin", "advisor"}))])
def create_lead(
    payload: LeadCreate,
    request: Request,
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> LeadOut:
    service = LeadService(db)
    lead = service.create(
        tenant_id=principal.tenant_id,
        name=payload.name,
        phone=payload.phone,
        email=payload.email,
        source_channel=payload.source_channel,
    )
    audit_action(
        db,
        request,
        principal,
        entity="lead",
        entity_id=lead.id,
        action="create",
        payload={
            "name": lead.name,
            "phone": lead.phone,
            "email": lead.email,
            "source_channel": lead.source_channel,
        },
    )
    return LeadOut.model_validate(lead, from_attributes=True)


@router.get("", response_model=list[LeadOut], dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin", "advisor", "viewer"}))])
def list_leads(
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> list[LeadOut]:
    service = LeadService(db)
    return [LeadOut.model_validate(item, from_attributes=True) for item in service.list(principal.tenant_id)]


@router.post("/{lead_id}/move-stage", response_model=LeadOut, dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin", "advisor"}))])
def move_lead_stage(
    lead_id: str,
    payload: LeadMoveStageInput,
    request: Request,
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> LeadOut:
    service = LeadService(db)
    try:
        lead = service.move_stage(
            tenant_id=principal.tenant_id,
            lead_id=lead_id,
            to_stage_id=payload.to_stage_id,
            changed_by_user_id=principal.user_id,
            reason=payload.reason,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    audit_action(
        db,
        request,
        principal,
        entity="lead",
        entity_id=lead.id,
        action="move_stage",
        payload={"to_stage_id": payload.to_stage_id, "reason": payload.reason},
    )
    evaluate_trigger.delay("lead.stage_changed", principal.tenant_id, lead.id)
    return LeadOut.model_validate(lead, from_attributes=True)
