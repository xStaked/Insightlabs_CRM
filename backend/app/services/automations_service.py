from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models.entities import Automation, AutomationRun, LeadScore, Tag
from app.repositories.automations import AutomationRepository


class AutomationsService:
    def __init__(self, db: Session):
        self.repo = AutomationRepository(db)

    def list(self, tenant_id: str) -> list[Automation]:
        return self.repo.list_automations(tenant_id)

    def create(
        self,
        *,
        tenant_id: str,
        name: str,
        trigger_type: str,
        conditions: list[dict[str, Any]],
        actions: list[dict[str, Any]],
        is_active: bool,
    ) -> Automation:
        return self.repo.create_automation(
            tenant_id=tenant_id,
            name=name,
            trigger_type=trigger_type,
            conditions_json={"all": conditions},
            actions_json={"actions": actions},
            is_active=is_active,
        )

    def update(
        self,
        *,
        tenant_id: str,
        automation_id: str,
        name: str | None = None,
        trigger_type: str | None = None,
        conditions: list[dict[str, Any]] | None = None,
        actions: list[dict[str, Any]] | None = None,
        is_active: bool | None = None,
    ) -> Automation | None:
        return self.repo.update_automation(
            tenant_id=tenant_id,
            automation_id=automation_id,
            name=name,
            trigger_type=trigger_type,
            conditions_json={"all": conditions} if conditions is not None else None,
            actions_json={"actions": actions} if actions is not None else None,
            is_active=is_active,
        )

    def list_runs(self, tenant_id: str, *, automation_id: str | None = None, entity_id: str | None = None) -> list[AutomationRun]:
        return self.repo.list_runs(tenant_id, automation_id=automation_id, entity_id=entity_id)

    def list_lead_scores(self, tenant_id: str, lead_id: str) -> list[LeadScore]:
        return self.repo.list_lead_scores(tenant_id, lead_id)

    def list_lead_tags(self, tenant_id: str, lead_id: str) -> list[Tag]:
        return self.repo.list_lead_tags(tenant_id, lead_id)

    def list_tag_suggestions(self, tenant_id: str) -> list[dict[str, Any]]:
        suggestions: dict[str, dict[str, Any]] = {}
        for automation in self.repo.list_automations(tenant_id):
            for action in self._normalize_actions(automation.actions_json):
                if action.get("type") != "tag":
                    continue
                name = str(action.get("name") or "").strip()
                if not name:
                    continue
                key = name.lower()
                existing = suggestions.setdefault(
                    key,
                    {
                        "name": name,
                        "color": action.get("color"),
                        "source_automation_ids": [],
                    },
                )
                if not existing["color"] and action.get("color"):
                    existing["color"] = action.get("color")
                existing["source_automation_ids"].append(automation.id)
        return sorted(suggestions.values(), key=lambda item: item["name"].lower())

    @staticmethod
    def _normalize_actions(raw_actions: Any) -> list[dict[str, Any]]:
        if not raw_actions:
            return []
        if isinstance(raw_actions, list):
            return raw_actions
        if isinstance(raw_actions, dict) and isinstance(raw_actions.get("actions"), list):
            return raw_actions["actions"]
        return []
