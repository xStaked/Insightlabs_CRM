from __future__ import annotations

from datetime import datetime

from sqlalchemy import Select, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.entities import (
    Automation,
    AutomationRun,
    Conversation,
    Lead,
    LeadScore,
    LeadStageHistory,
    LeadTag,
    Tag,
    Task,
)


class AutomationRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_automations(self, tenant_id: str) -> list[Automation]:
        stmt = (
            select(Automation)
            .where(Automation.tenant_id == tenant_id)
            .order_by(Automation.is_active.desc(), Automation.updated_at.desc(), Automation.created_at.desc())
        )
        return list(self.db.scalars(stmt).all())

    def get_automation(self, tenant_id: str, automation_id: str) -> Automation | None:
        stmt = select(Automation).where(Automation.tenant_id == tenant_id, Automation.id == automation_id)
        return self.db.scalar(stmt)

    def create_automation(
        self,
        *,
        tenant_id: str,
        name: str,
        trigger_type: str,
        conditions_json: dict,
        actions_json: dict | list,
        is_active: bool,
    ) -> Automation:
        automation = Automation(
            tenant_id=tenant_id,
            name=name,
            trigger_type=trigger_type,
            conditions_json=conditions_json,
            actions_json=actions_json,
            is_active=is_active,
        )
        self.db.add(automation)
        self.db.commit()
        self.db.refresh(automation)
        return automation

    def update_automation(
        self,
        *,
        tenant_id: str,
        automation_id: str,
        name: str | None = None,
        trigger_type: str | None = None,
        conditions_json: dict | None = None,
        actions_json: dict | list | None = None,
        is_active: bool | None = None,
    ) -> Automation | None:
        automation = self.get_automation(tenant_id, automation_id)
        if automation is None:
            return None

        if name is not None:
            automation.name = name
        if trigger_type is not None:
            automation.trigger_type = trigger_type
        if conditions_json is not None:
            automation.conditions_json = conditions_json
        if actions_json is not None:
            automation.actions_json = actions_json
        if is_active is not None:
            automation.is_active = is_active

        self.db.commit()
        self.db.refresh(automation)
        return automation

    def list_active_by_trigger(self, tenant_id: str, trigger_type: str) -> list[Automation]:
        stmt = (
            select(Automation)
            .where(
                Automation.tenant_id == tenant_id,
                Automation.trigger_type == trigger_type,
                Automation.is_active.is_(True),
            )
            .order_by(Automation.created_at.asc())
        )
        return list(self.db.scalars(stmt).all())

    def list_active_by_trigger_global(self, trigger_type: str) -> list[Automation]:
        stmt = (
            select(Automation)
            .where(
                Automation.trigger_type == trigger_type,
                Automation.is_active.is_(True),
            )
            .order_by(Automation.tenant_id.asc(), Automation.created_at.asc())
        )
        return list(self.db.scalars(stmt).all())

    def get_lead(self, tenant_id: str, lead_id: str) -> Lead | None:
        stmt = select(Lead).where(Lead.tenant_id == tenant_id, Lead.id == lead_id)
        return self.db.scalar(stmt)

    def list_leads_by_tenant(self, tenant_id: str) -> list[Lead]:
        stmt = select(Lead).where(Lead.tenant_id == tenant_id).order_by(Lead.created_at.asc())
        return list(self.db.scalars(stmt).all())

    def get_latest_stage_history(self, tenant_id: str, lead_id: str) -> LeadStageHistory | None:
        stmt = (
            select(LeadStageHistory)
            .where(LeadStageHistory.tenant_id == tenant_id, LeadStageHistory.lead_id == lead_id)
            .order_by(LeadStageHistory.created_at.desc())
        )
        return self.db.scalar(stmt)

    def get_latest_conversation(self, tenant_id: str, lead_id: str) -> Conversation | None:
        stmt = (
            select(Conversation)
            .where(Conversation.tenant_id == tenant_id, Conversation.lead_id == lead_id)
            .order_by(Conversation.last_message_at.desc().nullslast(), Conversation.created_at.desc())
        )
        return self.db.scalar(stmt)

    def list_tag_names(self, tenant_id: str, lead_id: str) -> list[str]:
        stmt = (
            select(Tag.name)
            .join(LeadTag, LeadTag.tag_id == Tag.id)
            .where(LeadTag.tenant_id == tenant_id, LeadTag.lead_id == lead_id, Tag.tenant_id == tenant_id)
            .order_by(Tag.name.asc())
        )
        return list(self.db.scalars(stmt).all())

    def list_lead_tags(self, tenant_id: str, lead_id: str) -> list[Tag]:
        stmt = (
            select(Tag)
            .join(LeadTag, LeadTag.tag_id == Tag.id)
            .where(LeadTag.tenant_id == tenant_id, LeadTag.lead_id == lead_id, Tag.tenant_id == tenant_id)
            .order_by(Tag.name.asc())
        )
        return list(self.db.scalars(stmt).all())

    def list_runs(
        self,
        tenant_id: str,
        *,
        automation_id: str | None = None,
        entity_id: str | None = None,
        limit: int = 100,
    ) -> list[AutomationRun]:
        stmt = select(AutomationRun).where(AutomationRun.tenant_id == tenant_id)
        if automation_id:
            stmt = stmt.where(AutomationRun.automation_id == automation_id)
        if entity_id:
            stmt = stmt.where(AutomationRun.entity_id == entity_id)
        stmt = stmt.order_by(AutomationRun.created_at.desc()).limit(limit)
        return list(self.db.scalars(stmt).all())

    def list_lead_scores(self, tenant_id: str, lead_id: str, *, limit: int = 100) -> list[LeadScore]:
        stmt = (
            select(LeadScore)
            .where(LeadScore.tenant_id == tenant_id, LeadScore.lead_id == lead_id)
            .order_by(LeadScore.created_at.desc())
            .limit(limit)
        )
        return list(self.db.scalars(stmt).all())

    def get_or_create_run(
        self,
        *,
        tenant_id: str,
        automation_id: str,
        entity_type: str,
        entity_id: str,
        idempotency_key: str,
    ) -> tuple[AutomationRun, bool]:
        stmt: Select[tuple[AutomationRun]] = select(AutomationRun).where(AutomationRun.idempotency_key == idempotency_key)
        existing = self.db.scalar(stmt)
        if existing:
            return existing, False

        run = AutomationRun(
            tenant_id=tenant_id,
            automation_id=automation_id,
            entity_type=entity_type,
            entity_id=entity_id,
            idempotency_key=idempotency_key,
            status="running",
            attempts=1,
        )
        self.db.add(run)
        try:
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            existing = self.db.scalar(stmt)
            if existing is None:
                raise
            return existing, False
        self.db.refresh(run)
        return run, True

    def mark_run_completed(self, run_id: str) -> AutomationRun:
        run = self.db.get(AutomationRun, run_id)
        if run is None:
            raise ValueError("Automation run not found")
        run.status = "completed"
        run.error = None
        self.db.commit()
        self.db.refresh(run)
        return run

    def mark_run_skipped(self, run_id: str, error: str | None = None) -> AutomationRun:
        run = self.db.get(AutomationRun, run_id)
        if run is None:
            raise ValueError("Automation run not found")
        run.status = "skipped"
        run.error = error
        self.db.commit()
        self.db.refresh(run)
        return run

    def mark_run_failed(self, run_id: str, error: str) -> AutomationRun:
        run = self.db.get(AutomationRun, run_id)
        if run is None:
            raise ValueError("Automation run not found")
        run.status = "failed"
        run.error = error
        self.db.commit()
        self.db.refresh(run)
        return run

    def create_task(
        self,
        *,
        tenant_id: str,
        lead_id: str | None,
        assigned_user_id: str | None,
        task_type: str,
        due_at: datetime | None,
        priority: str,
        origin: str,
    ) -> Task:
        task = Task(
            tenant_id=tenant_id,
            lead_id=lead_id,
            assigned_user_id=assigned_user_id,
            type=task_type,
            due_at=due_at,
            priority=priority,
            origin=origin,
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task

    def get_or_create_tag(self, tenant_id: str, name: str, color: str | None = None) -> Tag:
        stmt = select(Tag).where(Tag.tenant_id == tenant_id, func.lower(Tag.name) == name.strip().lower())
        tag = self.db.scalar(stmt)
        if tag:
            if color and tag.color != color:
                tag.color = color
                self.db.commit()
                self.db.refresh(tag)
            return tag

        tag = Tag(tenant_id=tenant_id, name=name.strip(), color=color)
        self.db.add(tag)
        self.db.commit()
        self.db.refresh(tag)
        return tag

    def attach_tag_to_lead(self, tenant_id: str, lead_id: str, tag_id: str) -> LeadTag:
        stmt = select(LeadTag).where(
            LeadTag.tenant_id == tenant_id,
            LeadTag.lead_id == lead_id,
            LeadTag.tag_id == tag_id,
        )
        existing = self.db.scalar(stmt)
        if existing:
            return existing

        relation = LeadTag(tenant_id=tenant_id, lead_id=lead_id, tag_id=tag_id)
        self.db.add(relation)
        self.db.commit()
        self.db.refresh(relation)
        return relation

    def create_lead_score(
        self,
        *,
        tenant_id: str,
        lead_id: str,
        event_type: str,
        points: int,
        reason: str,
        metadata_json: dict | None = None,
    ) -> LeadScore:
        score = LeadScore(
            tenant_id=tenant_id,
            lead_id=lead_id,
            event_type=event_type,
            points=points,
            reason=reason,
            metadata_json=metadata_json or {},
        )
        self.db.add(score)
        self.db.commit()
        self.db.refresh(score)
        return score

    def recalculate_lead_score(self, tenant_id: str, lead_id: str) -> Lead:
        lead = self.get_lead(tenant_id, lead_id)
        if lead is None:
            raise ValueError("Lead not found")

        stmt = select(func.coalesce(func.sum(LeadScore.points), 0)).where(
            LeadScore.tenant_id == tenant_id,
            LeadScore.lead_id == lead_id,
        )
        total = int(self.db.scalar(stmt) or 0)
        lead.score_total = total
        lead.temperature = self._temperature_from_score(total)
        self.db.commit()
        self.db.refresh(lead)
        return lead

    @staticmethod
    def _temperature_from_score(score_total: int) -> str:
        if score_total >= 60:
            return "hot"
        if score_total >= 25:
            return "warm"
        return "cold"
