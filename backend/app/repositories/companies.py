from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Company


class CompanyRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, *, name: str, slug: str, timezone: str, industry: str | None) -> Company:
        company = Company(name=name, slug=slug, timezone=timezone, industry=industry)
        self.db.add(company)
        self.db.commit()
        self.db.refresh(company)
        return company

    def list_all(self) -> list[Company]:
        stmt = select(Company).order_by(Company.created_at.desc())
        return list(self.db.scalars(stmt).all())
