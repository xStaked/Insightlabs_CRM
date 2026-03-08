from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Task


class TaskRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        *,
        tenant_id: str,
        lead_id: str | None,
        assigned_user_id: str | None,
        type: str,
        due_at,
        priority: str,
    ) -> Task:
        task = Task(
            tenant_id=tenant_id,
            lead_id=lead_id,
            assigned_user_id=assigned_user_id,
            type=type,
            due_at=due_at,
            priority=priority,
            status="pending",
            origin="manual",
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task

    def list_by_tenant(self, tenant_id: str) -> list[Task]:
        stmt = select(Task).where(Task.tenant_id == tenant_id).order_by(Task.created_at.desc())
        return list(self.db.scalars(stmt).all())

    def update_status(self, tenant_id: str, task_id: str, status: str) -> Task | None:
        stmt = select(Task).where(Task.tenant_id == tenant_id, Task.id == task_id)
        task = self.db.scalar(stmt)
        if not task:
            return None
        task.status = status
        self.db.commit()
        self.db.refresh(task)
        return task
