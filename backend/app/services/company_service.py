from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.entities import Company
from app.repositories.companies import CompanyRepository


class CompanyService:
    def __init__(self, db: Session):
        self.repo = CompanyRepository(db)

    def create(self, *, name: str, slug: str, timezone: str, industry: str | None) -> Company:
        return self.repo.create(name=name, slug=slug, timezone=timezone, industry=industry)

    def list(self) -> list[Company]:
        return self.repo.list_all()
