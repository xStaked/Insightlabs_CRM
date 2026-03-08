from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.companies import CompanyCreate, CompanyOut
from app.services.company_service import CompanyService

router = APIRouter(prefix="/companies", tags=["companies"])


@router.post("", response_model=CompanyOut)
def create_company(payload: CompanyCreate, db: Session = Depends(get_db)) -> CompanyOut:
    service = CompanyService(db)
    company = service.create(
        name=payload.name,
        slug=payload.slug,
        timezone=payload.timezone,
        industry=payload.industry,
    )
    return CompanyOut.model_validate(company, from_attributes=True)


@router.get("", response_model=list[CompanyOut])
def list_companies(db: Session = Depends(get_db)) -> list[CompanyOut]:
    service = CompanyService(db)
    return [CompanyOut.model_validate(item, from_attributes=True) for item in service.list()]
