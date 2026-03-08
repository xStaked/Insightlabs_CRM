from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps.audit import audit_action
from app.api.deps.auth import CurrentPrincipal, get_current_principal, require_roles
from app.api.deps.subscription import require_active_subscription
from app.core.db import get_db
from app.schemas.appointments import AppointmentCreate, AppointmentOut, AppointmentUpdateStatus
from app.services.appointment_service import AppointmentService

router = APIRouter(prefix="/appointments", tags=["appointments"])


@router.post(
    "",
    response_model=AppointmentOut,
    dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin", "advisor"}))],
)
def create_appointment(
    payload: AppointmentCreate,
    request: Request,
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> AppointmentOut:
    service = AppointmentService(db)
    appt = service.create(
        tenant_id=principal.tenant_id,
        lead_id=payload.lead_id,
        owner_user_id=payload.owner_user_id,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        location=payload.location,
        notes=payload.notes,
    )
    audit_action(
        db,
        request,
        principal,
        entity="appointment",
        entity_id=appt.id,
        action="create",
        payload={
            "lead_id": appt.lead_id,
            "owner_user_id": appt.owner_user_id,
            "starts_at": appt.starts_at.isoformat(),
            "ends_at": appt.ends_at.isoformat(),
            "location": appt.location,
        },
    )
    return AppointmentOut.model_validate(appt, from_attributes=True)


@router.get(
    "",
    response_model=list[AppointmentOut],
    dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin", "advisor", "viewer"}))],
)
def list_appointments(
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> list[AppointmentOut]:
    service = AppointmentService(db)
    return [AppointmentOut.model_validate(item, from_attributes=True) for item in service.list(principal.tenant_id)]


@router.patch(
    "/{appointment_id}/status",
    response_model=AppointmentOut,
    dependencies=[Depends(require_active_subscription), Depends(require_roles({"owner", "admin", "advisor"}))],
)
def update_appointment_status(
    appointment_id: str,
    payload: AppointmentUpdateStatus,
    request: Request,
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> AppointmentOut:
    service = AppointmentService(db)
    appt = service.update_status(principal.tenant_id, appointment_id, payload.status)
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    audit_action(
        db,
        request,
        principal,
        entity="appointment",
        entity_id=appt.id,
        action="update_status",
        payload={"status": appt.status},
    )
    return AppointmentOut.model_validate(appt, from_attributes=True)
