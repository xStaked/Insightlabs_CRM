from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps.audit import audit_action
from app.api.deps.auth import CurrentPrincipal, get_current_principal, require_roles
from app.api.deps.subscription import require_active_subscription
from app.core.db import get_db
from app.schemas.tasks import TaskCreate, TaskOut, TaskUpdateStatus
from app.services.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post(
    "",
    response_model=TaskOut,
    dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin", "advisor"}))],
)
def create_task(
    payload: TaskCreate,
    request: Request,
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> TaskOut:
    service = TaskService(db)
    task = service.create(
        tenant_id=principal.tenant_id,
        lead_id=payload.lead_id,
        assigned_user_id=payload.assigned_user_id,
        type=payload.type,
        due_at=payload.due_at,
        priority=payload.priority,
    )
    audit_action(
        db,
        request,
        principal,
        entity="task",
        entity_id=task.id,
        action="create",
        payload={
            "lead_id": task.lead_id,
            "assigned_user_id": task.assigned_user_id,
            "type": task.type,
            "priority": task.priority,
        },
    )
    return TaskOut.model_validate(task, from_attributes=True)


@router.get(
    "",
    response_model=list[TaskOut],
    dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin", "advisor", "viewer"}))],
)
def list_tasks(
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> list[TaskOut]:
    service = TaskService(db)
    return [TaskOut.model_validate(item, from_attributes=True) for item in service.list(principal.tenant_id)]


@router.patch(
    "/{task_id}/status",
    response_model=TaskOut,
    dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin", "advisor"}))],
)
def update_task_status(
    task_id: str,
    payload: TaskUpdateStatus,
    request: Request,
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> TaskOut:
    service = TaskService(db)
    task = service.update_status(principal.tenant_id, task_id, payload.status)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    audit_action(
        db,
        request,
        principal,
        entity="task",
        entity_id=task.id,
        action="update_status",
        payload={"status": task.status},
    )
    return TaskOut.model_validate(task, from_attributes=True)
