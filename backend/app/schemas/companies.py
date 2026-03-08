from pydantic import BaseModel

from app.schemas.common import ApiItem


class CompanyCreate(BaseModel):
    name: str
    slug: str
    timezone: str = "UTC"
    industry: str | None = None


class CompanyOut(ApiItem):
    name: str
    slug: str
    status: str
    timezone: str
    industry: str | None = None
