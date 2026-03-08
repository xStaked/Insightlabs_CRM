from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from collections.abc import Callable

from sqlalchemy.orm import Session

from app.models.entities import Automation, Lead
from app.repositories.automations import AutomationRepository


@dataclass
class LeadContext:
    lead: Lead
    tags: list[str]
    latest_activity_at: datetime
    inactivity_days: int
    latest_stage_history_id: str | None


class AutomationService:
    def __init__(
        self,
        db: Session | None = None,
        *,
        repo: AutomationRepository | None = None,
        now_provider: Callable[[], datetime] | None = None,
    ):
        if repo is None and db is None:
            raise ValueError("AutomationService requires a db session or repository")
        self.repo = repo or AutomationRepository(db)
        self.now_provider = now_provider or (lambda: datetime.now(UTC))

    def evaluate_trigger(self, trigger_type: str, tenant_id: str, entity_id: str) -> dict[str, Any]:
        automations = self.repo.list_active_by_trigger(tenant_id, trigger_type)
        lead = self.repo.get_lead(tenant_id, entity_id)
        if lead is None:
            return {
                "status": "not_found",
                "trigger_type": trigger_type,
                "tenant_id": tenant_id,
                "entity_id": entity_id,
                "matched": 0,
                "executed": 0,
                "skipped": 0,
                "failed": 0,
            }

        context = self._build_lead_context(tenant_id, lead)
        summary = {
            "status": "processed",
            "trigger_type": trigger_type,
            "tenant_id": tenant_id,
            "entity_id": entity_id,
            "matched": 0,
            "executed": 0,
            "skipped": 0,
            "failed": 0,
        }
        for automation in automations:
            if not self._matches_conditions(automation.conditions_json, context):
                continue
            summary["matched"] += 1
            outcome = self._run_automation(
                automation=automation,
                entity_type="lead",
                entity_id=entity_id,
                context=context,
                event_key=self._event_key_for_trigger(trigger_type, context),
            )
            summary[outcome] += 1
        return summary

    def run_inactivity_scan(self) -> dict[str, int | str]:
        automations = self.repo.list_active_by_trigger_global("lead.inactive")
        summary: dict[str, int | str] = {
            "status": "processed",
            "automations": len(automations),
            "matched": 0,
            "executed": 0,
            "skipped": 0,
            "failed": 0,
        }
        now = self.now_provider()
        scan_key = now.date().isoformat()

        for automation in automations:
            for lead in self.repo.list_leads_by_tenant(automation.tenant_id):
                context = self._build_lead_context(automation.tenant_id, lead)
                if not self._matches_conditions(automation.conditions_json, context):
                    continue
                summary["matched"] += 1
                outcome = self._run_automation(
                    automation=automation,
                    entity_type="lead",
                    entity_id=lead.id,
                    context=context,
                    event_key=f"inactivity:{scan_key}",
                )
                summary[outcome] += 1

        return summary

    def _run_automation(
        self,
        *,
        automation: Automation,
        entity_type: str,
        entity_id: str,
        context: LeadContext,
        event_key: str,
    ) -> str:
        if not self._matches_conditions(automation.conditions_json, context):
            return "skipped"

        run, created = self.repo.get_or_create_run(
            tenant_id=automation.tenant_id,
            automation_id=automation.id,
            entity_type=entity_type,
            entity_id=entity_id,
            idempotency_key=f"{automation.id}:{entity_type}:{entity_id}:{event_key}",
        )
        if not created:
            return "skipped"

        try:
            self._execute_actions(automation, context)
        except Exception as exc:
            self.repo.mark_run_failed(run.id, str(exc))
            return "failed"

        self.repo.mark_run_completed(run.id)
        return "executed"

    def _build_lead_context(self, tenant_id: str, lead: Lead) -> LeadContext:
        latest_conversation = self.repo.get_latest_conversation(tenant_id, lead.id)
        latest_stage_history = self.repo.get_latest_stage_history(tenant_id, lead.id)
        tags = self.repo.list_tag_names(tenant_id, lead.id)

        latest_activity_at = latest_conversation.last_message_at if latest_conversation and latest_conversation.last_message_at else lead.created_at
        latest_activity_at = self._coerce_utc(latest_activity_at)
        inactivity_days = max((self.now_provider() - latest_activity_at).days, 0)

        return LeadContext(
            lead=lead,
            tags=tags,
            latest_activity_at=latest_activity_at,
            inactivity_days=inactivity_days,
            latest_stage_history_id=latest_stage_history.id if latest_stage_history else None,
        )

    def _event_key_for_trigger(self, trigger_type: str, context: LeadContext) -> str:
        if trigger_type == "lead.stage_changed" and context.latest_stage_history_id:
            return context.latest_stage_history_id
        return f"{trigger_type}:{context.lead.updated_at.isoformat()}"

    def _matches_conditions(self, raw_conditions: Any, context: LeadContext) -> bool:
        normalized = self._normalize_conditions(raw_conditions)

        if "all" in normalized:
            return all(self._matches_conditions(item, context) for item in normalized["all"])
        if "any" in normalized:
            return any(self._matches_conditions(item, context) for item in normalized["any"])
        if "not" in normalized:
            return not self._matches_conditions(normalized["not"], context)

        field = normalized.get("field")
        operator = normalized.get("op", normalized.get("operator", "eq"))
        expected = normalized.get("value")
        actual = self._resolve_field_value(field, context)
        return self._compare(actual, operator, expected)

    def _normalize_conditions(self, raw_conditions: Any) -> dict[str, Any]:
        if not raw_conditions:
            return {"all": []}
        if isinstance(raw_conditions, list):
            return {"all": raw_conditions}
        if isinstance(raw_conditions, dict):
            if any(key in raw_conditions for key in ("all", "any", "not", "field")):
                return raw_conditions
            return {
                "all": [
                    {
                        "field": key,
                        "op": "in" if isinstance(value, list) else "eq",
                        "value": value,
                    }
                    for key, value in raw_conditions.items()
                ]
            }
        raise ValueError("Invalid conditions_json payload")

    def _resolve_field_value(self, field: str | None, context: LeadContext) -> Any:
        if not field:
            raise ValueError("Condition field is required")
        field = field.removeprefix("lead.")
        lead = context.lead
        mapping = {
            "id": lead.id,
            "name": lead.name,
            "email": lead.email,
            "phone": lead.phone,
            "status": lead.status,
            "source_channel": lead.source_channel,
            "assigned_user_id": lead.assigned_user_id,
            "current_stage_id": lead.current_stage_id,
            "score_total": lead.score_total,
            "temperature": lead.temperature,
            "has_email": bool(lead.email),
            "has_phone": bool(lead.phone),
            "inactivity_days": context.inactivity_days,
            "latest_activity_at": context.latest_activity_at.isoformat(),
            "tags": context.tags,
        }
        if field not in mapping:
            raise ValueError(f"Unsupported condition field: {field}")
        return mapping[field]

    def _compare(self, actual: Any, operator: str, expected: Any) -> bool:
        if operator == "eq":
            return actual == expected
        if operator == "neq":
            return actual != expected
        if operator == "gt":
            return actual > expected
        if operator == "gte":
            return actual >= expected
        if operator == "lt":
            return actual < expected
        if operator == "lte":
            return actual <= expected
        if operator == "in":
            return actual in expected if not isinstance(actual, list) else any(item in expected for item in actual)
        if operator == "not_in":
            return actual not in expected if not isinstance(actual, list) else all(item not in expected for item in actual)
        if operator == "contains":
            if isinstance(actual, list):
                return expected in actual
            return str(expected) in str(actual)
        if operator == "is_true":
            return bool(actual) is True
        if operator == "is_false":
            return bool(actual) is False
        raise ValueError(f"Unsupported condition operator: {operator}")

    def _execute_actions(self, automation: Automation, context: LeadContext) -> None:
        for action in self._normalize_actions(automation.actions_json):
            action_type = action.get("type", action.get("action"))
            if action_type in {"create_task", "task"}:
                self._create_task_action(context, action, default_type="follow_up")
            elif action_type == "email":
                self._create_task_action(context, action, default_type="email")
            elif action_type == "whatsapp":
                self._create_task_action(context, action, default_type="whatsapp")
            elif action_type == "reminder":
                self._create_task_action(context, action, default_type="reminder")
            elif action_type == "tag":
                name = str(action.get("name") or "").strip()
                if not name:
                    raise ValueError("Tag action requires name")
                tag = self.repo.get_or_create_tag(context.lead.tenant_id, name, action.get("color"))
                self.repo.attach_tag_to_lead(context.lead.tenant_id, context.lead.id, tag.id)
            elif action_type == "score":
                points = int(action.get("points", 0))
                reason = str(action.get("reason") or f"automation:{automation.name}")
                self.repo.create_lead_score(
                    tenant_id=context.lead.tenant_id,
                    lead_id=context.lead.id,
                    event_type=str(action.get("event_type") or automation.trigger_type),
                    points=points,
                    reason=reason,
                    metadata_json={"automation_id": automation.id},
                )
                self.repo.recalculate_lead_score(context.lead.tenant_id, context.lead.id)
            else:
                raise ValueError(f"Unsupported action type: {action_type}")

    def _normalize_actions(self, raw_actions: Any) -> list[dict[str, Any]]:
        if not raw_actions:
            return []
        if isinstance(raw_actions, list):
            return raw_actions
        if isinstance(raw_actions, dict):
            if "actions" in raw_actions and isinstance(raw_actions["actions"], list):
                return raw_actions["actions"]
            if "type" in raw_actions or "action" in raw_actions:
                return [raw_actions]
        raise ValueError("Invalid actions_json payload")

    def _create_task_action(self, context: LeadContext, action: dict[str, Any], *, default_type: str) -> None:
        due_at = self.now_provider()
        if "delay_hours" in action:
            due_at += timedelta(hours=int(action["delay_hours"]))
        if "delay_days" in action:
            due_at += timedelta(days=int(action["delay_days"]))
        self.repo.create_task(
            tenant_id=context.lead.tenant_id,
            lead_id=context.lead.id,
            assigned_user_id=str(action.get("assigned_user_id") or context.lead.assigned_user_id or "") or None,
            task_type=str(action.get("task_type") or default_type),
            due_at=due_at if action.get("schedule") != "immediate" else self.now_provider(),
            priority=str(action.get("priority") or "medium"),
            origin="automation",
        )

    @staticmethod
    def _coerce_utc(value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)
