from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, declarative_mixin, mapped_column

from app.core.db import Base


@declarative_mixin
class IdMixin:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))


@declarative_mixin
class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


@declarative_mixin
class TenantMixin:
    tenant_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)


class BaseModel(Base, IdMixin, TimestampMixin):
    __abstract__ = True
