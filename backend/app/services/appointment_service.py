from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.entities import Appointment
from app.repositories.appointments import AppointmentRepository


class AppointmentService:
    def __init__(self, db: Session):
        self.repo = AppointmentRepository(db)

    def create(self, *, tenant_id: str, lead_id: str | None, owner_user_id: str | None, starts_at, ends_at, location: str | None, notes: str | None) -> Appointment:
        return self.repo.create(
            tenant_id=tenant_id,
            lead_id=lead_id,
            owner_user_id=owner_user_id,
            starts_at=starts_at,
            ends_at=ends_at,
            location=location,
            notes=notes,
        )

    def list(self, tenant_id: str) -> list[Appointment]:
        return self.repo.list_by_tenant(tenant_id)

    def update_status(self, tenant_id: str, appointment_id: str, status: str) -> Appointment | None:
        return self.repo.update_status(tenant_id, appointment_id, status)
