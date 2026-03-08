from __future__ import annotations

from sqlalchemy.orm import Session

from app.repositories.reports import ReportsRepository


class ReportService:
    def __init__(self, db: Session):
        self.repo = ReportsRepository(db)

    def sales_by_advisor(self, tenant_id: str) -> list[dict]:
        return self.repo.sales_by_advisor(tenant_id)

    def conversion_by_stage(self, tenant_id: str) -> list[dict]:
        return self.repo.conversion_by_stage(tenant_id)

    def average_close_time(self, tenant_id: str) -> list[dict]:
        rows = self.repo.average_close_time(tenant_id)
        for row in rows:
            row["closed_leads"] = int(row["closed_leads"] or 0)
            row["average_hours_to_close"] = round(float(row["average_hours_to_close"] or 0.0), 2)
        return rows

    def leads_by_channel(self, tenant_id: str) -> list[dict]:
        return self.repo.leads_by_channel(tenant_id)

    def loss_reasons(self, tenant_id: str) -> list[dict]:
        return self.repo.loss_reasons(tenant_id)

    def summary(self, tenant_id: str) -> dict[str, list[dict]]:
        return {
            "sales_by_advisor": self.sales_by_advisor(tenant_id),
            "conversion_by_stage": self.conversion_by_stage(tenant_id),
            "average_close_time": self.average_close_time(tenant_id),
            "leads_by_channel": self.leads_by_channel(tenant_id),
            "loss_reasons": self.loss_reasons(tenant_id),
        }
