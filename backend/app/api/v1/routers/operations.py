from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps.auth import CurrentPrincipal, get_current_principal, require_roles
from app.core.db import get_db
from app.schemas.operations import OperationsStatus
from app.services.operations_service import OperationsService

router = APIRouter(prefix="/operations", tags=["operations"])


@router.get(
    "/status",
    response_model=OperationsStatus,
    dependencies=[Depends(require_roles({"owner", "admin"}))],
)
def get_operations_status(
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> OperationsStatus:
    service = OperationsService(db)
    return OperationsStatus.model_validate(service.summary(principal.tenant_id))
