from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.entities import Task
from app.repositories.tasks import TaskRepository


class TaskService:
    def __init__(self, db: Session):
        self.repo = TaskRepository(db)

    def create(self, *, tenant_id: str, lead_id: str | None, assigned_user_id: str | None, type: str, due_at, priority: str) -> Task:
        return self.repo.create(
            tenant_id=tenant_id,
            lead_id=lead_id,
            assigned_user_id=assigned_user_id,
            type=type,
            due_at=due_at,
            priority=priority,
        )

    def list(self, tenant_id: str) -> list[Task]:
        return self.repo.list_by_tenant(tenant_id)

    def update_status(self, tenant_id: str, task_id: str, status: str) -> Task | None:
        return self.repo.update_status(tenant_id, task_id, status)
