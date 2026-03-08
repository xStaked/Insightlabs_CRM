from datetime import datetime

from pydantic import BaseModel


class ApiItem(BaseModel):
    id: str
    created_at: datetime
    updated_at: datetime
