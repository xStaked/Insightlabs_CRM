"use client";

import { FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/primitives";
import type { Automation, AutomationAction, AutomationCondition } from "@/types/api";

type AutomationDraft = {
  name: string;
  trigger_type: string;
  is_active: boolean;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
};

const CONDITION_FIELDS = [
  "lead.source_channel",
  "lead.status",
  "lead.temperature",
  "lead.current_stage_id",
  "lead.score_total",
  "lead.has_email",
  "lead.has_phone",
  "lead.inactivity_days",
] as const;

const CONDITION_OPERATORS = ["eq", "neq", "gt", "gte", "lt", "lte", "contains", "is_true", "is_false"] as const;
const ACTION_TYPES = ["create_task", "email", "whatsapp", "reminder", "tag", "score"] as const;
const TRIGGERS = ["lead.stage_changed", "lead.created", "lead.updated", "lead.inactive"] as const;

function toDraft(automation?: Automation | null): AutomationDraft {
  if (!automation) {
    return {
      name: "",
      trigger_type: "lead.stage_changed",
      is_active: true,
      conditions: [{ field: "lead.temperature", op: "eq", value: "warm" }],
      actions: [{ type: "score", points: 10, reason: "Qualified engagement" }],
    };
  }

  const actions = Array.isArray(automation.actions_json)
    ? automation.actions_json
    : (automation.actions_json.actions ?? []);

  return {
    name: automation.name,
    trigger_type: automation.trigger_type,
    is_active: automation.is_active,
    conditions: automation.conditions_json.all ?? [],
    actions,
  };
}

export function AutomationForm({
  automation,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  automation?: Automation | null;
  busy: boolean;
  error: string | null;
  onSubmit: (draft: AutomationDraft) => Promise<void>;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<AutomationDraft>(() => toDraft(automation));

  useEffect(() => {
    setDraft(toDraft(automation));
  }, [automation]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(draft);
  }

  return (
    <Card
      title={automation ? "Edit automation" : "Create automation"}
      subtitle="Simple builder for trigger, conditions and actions."
      actions={
        onCancel ? (
          <Button variant="ghost" size="small" onClick={onCancel}>
            Cancel
          </Button>
        ) : null
      }
    >
      <form className="inline-stack" onSubmit={handleSubmit}>
        <Field label="Automation name">
          <input
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            placeholder="Qualified follow-up"
            required
          />
        </Field>

        <div className="form-grid">
          <Field label="Trigger">
            <select
              value={draft.trigger_type}
              onChange={(event) => setDraft((current) => ({ ...current, trigger_type: event.target.value }))}
            >
              {TRIGGERS.map((trigger) => (
                <option key={trigger} value={trigger}>
                  {trigger}
                </option>
              ))}
            </select>
          </Field>

          <Field label="State">
            <select
              value={draft.is_active ? "active" : "paused"}
              onChange={(event) => setDraft((current) => ({ ...current, is_active: event.target.value === "active" }))}
            >
              <option value="active">active</option>
              <option value="paused">paused</option>
            </select>
          </Field>
        </div>

        <div className="automation-builder">
          <div className="topbar-row">
            <strong>Conditions</strong>
            <Button
              variant="secondary"
              size="small"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  conditions: [...current.conditions, { field: "lead.status", op: "eq", value: "new" }],
                }))
              }
            >
              Add condition
            </Button>
          </div>
          <div className="automation-builder__stack">
            {draft.conditions.map((condition, index) => (
              <div className="automation-row" key={`${condition.field}-${index}`}>
                <select
                  value={condition.field}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      conditions: current.conditions.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, field: event.target.value } : item,
                      ),
                    }))
                  }
                >
                  {CONDITION_FIELDS.map((field) => (
                    <option key={field} value={field}>
                      {field}
                    </option>
                  ))}
                </select>
                <select
                  value={condition.op}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      conditions: current.conditions.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, op: event.target.value } : item,
                      ),
                    }))
                  }
                >
                  {CONDITION_OPERATORS.map((operator) => (
                    <option key={operator} value={operator}>
                      {operator}
                    </option>
                  ))}
                </select>
                <input
                  value={String(condition.value ?? "")}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      conditions: current.conditions.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, value: event.target.value } : item,
                      ),
                    }))
                  }
                  placeholder="value"
                />
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      conditions: current.conditions.filter((_, itemIndex) => itemIndex !== index),
                    }))
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="automation-builder">
          <div className="topbar-row">
            <strong>Actions</strong>
            <Button
              variant="secondary"
              size="small"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  actions: [...current.actions, { type: "create_task", task_type: "follow_up", priority: "medium" }],
                }))
              }
            >
              Add action
            </Button>
          </div>
          <div className="automation-builder__stack">
            {draft.actions.map((action, index) => (
              <div className="automation-action-card" key={`${action.type}-${index}`}>
                <div className="form-grid">
                  <Field label="Action type">
                    <select
                      value={action.type}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          actions: current.actions.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, type: event.target.value } : item,
                          ),
                        }))
                      }
                    >
                      {ACTION_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Primary value">
                    <input
                      value={action.name ?? action.task_type ?? action.reason ?? ""}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          actions: current.actions.map((item, itemIndex) =>
                            itemIndex === index
                              ? item.type === "tag"
                                ? { ...item, name: event.target.value }
                                : item.type === "score"
                                  ? { ...item, reason: event.target.value }
                                  : { ...item, task_type: event.target.value }
                              : item,
                          ),
                        }))
                      }
                      placeholder={action.type === "tag" ? "vip" : action.type === "score" ? "Scoring note" : "follow_up"}
                    />
                  </Field>

                  <Field label="Intensity">
                    <input
                      value={String(action.points ?? action.delay_hours ?? 0)}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          actions: current.actions.map((item, itemIndex) =>
                            itemIndex === index
                              ? item.type === "score"
                                ? { ...item, points: Number(event.target.value || 0) }
                                : { ...item, delay_hours: Number(event.target.value || 0) }
                              : item,
                          ),
                        }))
                      }
                      type="number"
                      min={0}
                    />
                  </Field>
                </div>

                <div className="action-row">
                  <Button
                    variant="ghost"
                    size="small"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        actions: current.actions.filter((_, itemIndex) => itemIndex !== index),
                      }))
                    }
                  >
                    Remove action
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error ? <div className="banner-error">{error}</div> : null}

        <div className="action-row">
          <Button type="submit" disabled={busy}>
            {busy ? "Saving..." : automation ? "Save changes" : "Create automation"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
