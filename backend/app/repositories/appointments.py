from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Appointment


class AppointmentRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        *,
        tenant_id: str,
        lead_id: str | None,
        owner_user_id: str | None,
        starts_at,
        ends_at,
        location: str | None,
        notes: str | None,
    ) -> Appointment:
        appt = Appointment(
            tenant_id=tenant_id,
            lead_id=lead_id,
            owner_user_id=owner_user_id,
            starts_at=starts_at,
            ends_at=ends_at,
            location=location,
            notes=notes,
            status="scheduled",
            reminder_status="pending",
        )
        self.db.add(appt)
        self.db.commit()
        self.db.refresh(appt)
        return appt

    def list_by_tenant(self, tenant_id: str) -> list[Appointment]:
        stmt = select(Appointment).where(Appointment.tenant_id == tenant_id).order_by(Appointment.starts_at.asc())
        return list(self.db.scalars(stmt).all())

    def update_status(self, tenant_id: str, appointment_id: str, status: str) -> Appointment | None:
        stmt = select(Appointment).where(Appointment.tenant_id == tenant_id, Appointment.id == appointment_id)
        appt = self.db.scalar(stmt)
        if not appt:
            return None
        appt.status = status
        self.db.commit()
        self.db.refresh(appt)
        return appt
