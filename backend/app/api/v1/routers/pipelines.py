from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps.audit import audit_action
from app.api.deps.auth import CurrentPrincipal, get_current_principal, require_roles
from app.api.deps.subscription import require_active_subscription
from app.core.db import get_db
from app.schemas.pipelines import KanbanColumn, PipelineCreate, PipelineOut, PipelineStageCreate, PipelineStageOut
from app.services.pipeline_service import PipelineService

router = APIRouter(prefix="/pipelines", tags=["pipelines"])


@router.post("", response_model=PipelineOut, dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin"}))])
def create_pipeline(
    payload: PipelineCreate,
    request: Request,
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> PipelineOut:
    service = PipelineService(db)
    pipeline = service.create(tenant_id=principal.tenant_id, name=payload.name, is_default=payload.is_default)
    audit_action(
        db,
        request,
        principal,
        entity="pipeline",
        entity_id=pipeline.id,
        action="create",
        payload={"name": pipeline.name, "is_default": pipeline.is_default},
    )
    return PipelineOut.model_validate(pipeline, from_attributes=True)


@router.get("", response_model=list[PipelineOut], dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin", "advisor", "viewer"}))])
def list_pipelines(
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> list[PipelineOut]:
    service = PipelineService(db)
    return [PipelineOut.model_validate(item, from_attributes=True) for item in service.list(principal.tenant_id)]


@router.post("/{pipeline_id}/stages", response_model=PipelineStageOut, dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin"}))])
def create_stage(
    pipeline_id: str,
    payload: PipelineStageCreate,
    request: Request,
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> PipelineStageOut:
    service = PipelineService(db)
    stage = service.create_stage(
        tenant_id=principal.tenant_id,
        pipeline_id=pipeline_id,
        name=payload.name,
        position=payload.position,
        probability=payload.probability,
        sla_hours=payload.sla_hours,
    )
    audit_action(
        db,
        request,
        principal,
        entity="pipeline_stage",
        entity_id=stage.id,
        action="create",
        payload={"pipeline_id": pipeline_id, "name": stage.name, "position": stage.position},
    )
    return PipelineStageOut.model_validate(stage, from_attributes=True)


@router.get("/{pipeline_id}/stages", response_model=list[PipelineStageOut], dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin", "advisor", "viewer"}))])
def list_stages(
    pipeline_id: str,
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> list[PipelineStageOut]:
    service = PipelineService(db)
    return [PipelineStageOut.model_validate(item, from_attributes=True) for item in service.list_stages(principal.tenant_id, pipeline_id)]


@router.get("/{pipeline_id}/kanban", response_model=list[KanbanColumn], dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin", "advisor", "viewer"}))])
def get_kanban(
    pipeline_id: str,
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> list[KanbanColumn]:
    service = PipelineService(db)
    return service.kanban(principal.tenant_id, pipeline_id)
