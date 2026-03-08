from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.automation_service import AutomationService


@dataclass
class FakeAutomation:
    id: str
    tenant_id: str
    name: str
    trigger_type: str
    conditions_json: dict
    actions_json: list[dict]


@dataclass
class FakeLead:
    id: str
    tenant_id: str
    name: str
    created_at: datetime
    updated_at: datetime
    email: str | None = None
    phone: str | None = None
    status: str = "new"
    source_channel: str = "manual"
    assigned_user_id: str | None = None
    current_stage_id: str | None = None
    score_total: int = 0
    temperature: str = "cold"


class FakeAutomationRepository:
    def __init__(self, now: datetime):
        self.now = now
        self.automations: list[FakeAutomation] = []
        self.leads: dict[tuple[str, str], FakeLead] = {}
        self.tags: dict[tuple[str, str], list[str]] = {}
        self.latest_stage_history: dict[tuple[str, str], str] = {}
        self.latest_activity: dict[tuple[str, str], datetime] = {}
        self.runs: dict[str, SimpleNamespace] = {}
        self.tasks: list[dict] = []
        self.score_events: list[dict] = []

    def list_active_by_trigger(self, tenant_id: str, trigger_type: str) -> list[FakeAutomation]:
        return [item for item in self.automations if item.tenant_id == tenant_id and item.trigger_type == trigger_type]

    def list_active_by_trigger_global(self, trigger_type: str) -> list[FakeAutomation]:
        return [item for item in self.automations if item.trigger_type == trigger_type]

    def get_lead(self, tenant_id: str, lead_id: str) -> FakeLead | None:
        return self.leads.get((tenant_id, lead_id))

    def list_leads_by_tenant(self, tenant_id: str) -> list[FakeLead]:
        return [lead for (item_tenant, _), lead in self.leads.items() if item_tenant == tenant_id]

    def get_latest_stage_history(self, tenant_id: str, lead_id: str) -> SimpleNamespace | None:
        history_id = self.latest_stage_history.get((tenant_id, lead_id))
        return SimpleNamespace(id=history_id) if history_id else None

    def get_latest_conversation(self, tenant_id: str, lead_id: str) -> SimpleNamespace | None:
        latest = self.latest_activity.get((tenant_id, lead_id))
        if latest is None:
            return None
        return SimpleNamespace(last_message_at=latest)

    def list_tag_names(self, tenant_id: str, lead_id: str) -> list[str]:
        return list(self.tags.get((tenant_id, lead_id), []))

    def get_or_create_run(
        self,
        *,
        tenant_id: str,
        automation_id: str,
        entity_type: str,
        entity_id: str,
        idempotency_key: str,
    ) -> tuple[SimpleNamespace, bool]:
        existing = self.runs.get(idempotency_key)
        if existing:
            return existing, False
        run = SimpleNamespace(
            id=f"run-{len(self.runs) + 1}",
            tenant_id=tenant_id,
            automation_id=automation_id,
            entity_type=entity_type,
            entity_id=entity_id,
            idempotency_key=idempotency_key,
            status="running",
            error=None,
        )
        self.runs[idempotency_key] = run
        return run, True

    def mark_run_completed(self, run_id: str) -> SimpleNamespace:
        run = self._run_by_id(run_id)
        run.status = "completed"
        return run

    def mark_run_skipped(self, run_id: str, error: str | None = None) -> SimpleNamespace:
        run = self._run_by_id(run_id)
        run.status = "skipped"
        run.error = error
        return run

    def mark_run_failed(self, run_id: str, error: str) -> SimpleNamespace:
        run = self._run_by_id(run_id)
        run.status = "failed"
        run.error = error
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
    ) -> dict:
        task = {
            "tenant_id": tenant_id,
            "lead_id": lead_id,
            "assigned_user_id": assigned_user_id,
            "task_type": task_type,
            "due_at": due_at,
            "priority": priority,
            "origin": origin,
        }
        self.tasks.append(task)
        return task

    def get_or_create_tag(self, tenant_id: str, name: str, color: str | None = None) -> SimpleNamespace:
        return SimpleNamespace(id=f"tag-{name.lower()}", name=name, color=color, tenant_id=tenant_id)

    def attach_tag_to_lead(self, tenant_id: str, lead_id: str, tag_id: str) -> SimpleNamespace:
        tag_name = tag_id.removeprefix("tag-")
        key = (tenant_id, lead_id)
        current = self.tags.setdefault(key, [])
        if tag_name not in current:
            current.append(tag_name)
        return SimpleNamespace(id=f"{lead_id}:{tag_id}")

    def create_lead_score(
        self,
        *,
        tenant_id: str,
        lead_id: str,
        event_type: str,
        points: int,
        reason: str,
        metadata_json: dict | None = None,
    ) -> dict:
        event = {
            "tenant_id": tenant_id,
            "lead_id": lead_id,
            "event_type": event_type,
            "points": points,
            "reason": reason,
            "metadata_json": metadata_json or {},
        }
        self.score_events.append(event)
        return event

    def recalculate_lead_score(self, tenant_id: str, lead_id: str) -> FakeLead:
        lead = self.leads[(tenant_id, lead_id)]
        total = sum(item["points"] for item in self.score_events if item["tenant_id"] == tenant_id and item["lead_id"] == lead_id)
        lead.score_total = total
        if total >= 60:
            lead.temperature = "hot"
        elif total >= 25:
            lead.temperature = "warm"
        else:
            lead.temperature = "cold"
        return lead

    def _run_by_id(self, run_id: str) -> SimpleNamespace:
        for run in self.runs.values():
            if run.id == run_id:
                return run
        raise KeyError(run_id)


class AutomationServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.now = datetime(2026, 3, 8, 12, 0, tzinfo=UTC)
        self.repo = FakeAutomationRepository(self.now)
        self.service = AutomationService(repo=self.repo, now_provider=lambda: self.now)

    def test_stage_change_executes_actions_and_recalculates_score(self) -> None:
        lead = FakeLead(
            id="lead-1",
            tenant_id="tenant-1",
            name="Ana Perez",
            created_at=self.now - timedelta(days=2),
            updated_at=self.now,
            current_stage_id="stage-qualified",
            assigned_user_id="user-1",
            email="ana@example.com",
        )
        self.repo.leads[(lead.tenant_id, lead.id)] = lead
        self.repo.latest_stage_history[(lead.tenant_id, lead.id)] = "history-1"
        self.repo.automations.append(
            FakeAutomation(
                id="auto-1",
                tenant_id="tenant-1",
                name="Qualified follow up",
                trigger_type="lead.stage_changed",
                conditions_json={"current_stage_id": "stage-qualified", "has_email": True},
                actions_json=[
                    {"type": "create_task", "task_type": "follow_up", "delay_hours": 2, "priority": "high"},
                    {"type": "tag", "name": "qualified"},
                    {"type": "score", "points": 30, "reason": "Reached qualified"},
                ],
            )
        )

        first = self.service.evaluate_trigger("lead.stage_changed", "tenant-1", "lead-1")
        second = self.service.evaluate_trigger("lead.stage_changed", "tenant-1", "lead-1")

        self.assertEqual(first["executed"], 1)
        self.assertEqual(first["failed"], 0)
        self.assertEqual(second["skipped"], 1)
        self.assertEqual(len(self.repo.tasks), 1)
        self.assertEqual(self.repo.tasks[0]["task_type"], "follow_up")
        self.assertEqual(lead.score_total, 30)
        self.assertEqual(lead.temperature, "warm")
        self.assertIn("qualified", self.repo.tags[(lead.tenant_id, lead.id)])

    def test_inactivity_scan_only_executes_for_matching_leads(self) -> None:
        stale = FakeLead(
            id="lead-stale",
            tenant_id="tenant-1",
            name="Lead Dormido",
            created_at=self.now - timedelta(days=10),
            updated_at=self.now - timedelta(days=10),
            phone="+573001112233",
        )
        fresh = FakeLead(
            id="lead-fresh",
            tenant_id="tenant-1",
            name="Lead Activo",
            created_at=self.now - timedelta(days=1),
            updated_at=self.now - timedelta(days=1),
        )
        self.repo.leads[(stale.tenant_id, stale.id)] = stale
        self.repo.leads[(fresh.tenant_id, fresh.id)] = fresh
        self.repo.latest_activity[(stale.tenant_id, stale.id)] = self.now - timedelta(days=5)
        self.repo.latest_activity[(fresh.tenant_id, fresh.id)] = self.now - timedelta(hours=12)
        self.repo.automations.append(
            FakeAutomation(
                id="auto-inactive",
                tenant_id="tenant-1",
                name="Reminder inactivity",
                trigger_type="lead.inactive",
                conditions_json={"field": "inactivity_days", "op": "gte", "value": 3},
                actions_json=[{"type": "reminder", "delay_hours": 1}],
            )
        )

        result = self.service.run_inactivity_scan()

        self.assertEqual(result["matched"], 1)
        self.assertEqual(result["executed"], 1)
        self.assertEqual(len(self.repo.tasks), 1)
        self.assertEqual(self.repo.tasks[0]["lead_id"], "lead-stale")
        self.assertEqual(self.repo.tasks[0]["task_type"], "reminder")


if __name__ == "__main__":
    unittest.main()
