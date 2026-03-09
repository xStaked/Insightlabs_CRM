"use client";

import { useEffect, useMemo, useState } from "react";

import { AutomationForm } from "@/components/automations/automation-form";
import { AutomationRunList } from "@/components/automations/automation-run-list";
import { LeadScorePanel } from "@/components/automations/lead-score-panel";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/data-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, Field } from "@/components/ui/primitives";
import { StatCard } from "@/components/ui/stat-card";
import { useAsyncResource } from "@/lib/hooks/use-async-resource";
import type { Automation, AutomationAction, AutomationCondition, Lead } from "@/types/api";

function normalizeConditionValue(value: AutomationCondition["value"]) {
  if (typeof value === "boolean" || typeof value === "number" || value === null) {
    return value;
  }

  const normalized = value.trim();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  if (normalized === "") {
    return null;
  }

  const asNumber = Number(normalized);
  return Number.isNaN(asNumber) ? normalized : asNumber;
}

function sanitizeConditions(conditions: AutomationCondition[]) {
  return conditions
    .filter((condition) => condition.field.trim())
    .map((condition) => ({
      ...condition,
      value: normalizeConditionValue(condition.value),
    }));
}

function sanitizeActions(actions: AutomationAction[]) {
  return actions
    .filter((action) => action.type.trim())
    .map((action) => ({
      ...action,
      points: action.points == null ? undefined : Number(action.points),
      delay_hours: action.delay_hours == null ? undefined : Number(action.delay_hours),
      delay_days: action.delay_days == null ? undefined : Number(action.delay_days),
    }));
}

function countActions(automation: Automation) {
  return Array.isArray(automation.actions_json) ? automation.actions_json.length : (automation.actions_json.actions ?? []).length;
}

function countConditions(automation: Automation) {
  return automation.conditions_json.all?.length ?? 0;
}

function lastRunStatusByAutomation(runs: Array<{ automation_id: string; status: string }>) {
  return runs.reduce<Map<string, string>>((map, run) => {
    if (!map.has(run.automation_id)) {
      map.set(run.automation_id, run.status);
    }
    return map;
  }, new Map());
}

function formatTrigger(trigger: string) {
  return trigger
    .replace("lead.", "")
    .replaceAll("_", " ")
    .replaceAll(".", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function AutomationsPage() {
  const { api } = useAuth();
  const automations = useAsyncResource(() => api.listAutomations(), []);
  const leads = useAsyncResource(() => api.listLeads(), []);
  const runs = useAsyncResource(() => api.listAutomationRuns(), []);
  const suggestions = useAsyncResource(() => api.listAutomationTagSuggestions(), []);

  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!selectedLeadId && leads.data?.length) {
      setSelectedLeadId(leads.data[0].id);
    }
  }, [leads.data, selectedLeadId]);

  const scoreEvents = useAsyncResource(() => api.listLeadScores(selectedLeadId), [selectedLeadId], Boolean(selectedLeadId));
  const leadTags = useAsyncResource(() => api.listLeadTags(selectedLeadId), [selectedLeadId], Boolean(selectedLeadId));

  const selectedLead = useMemo(
    () => leads.data?.find((lead) => lead.id === selectedLeadId) ?? null,
    [leads.data, selectedLeadId],
  );

  async function handleSubmit(payload: {
    name: string;
    trigger_type: string;
    is_active: boolean;
    conditions: AutomationCondition[];
    actions: AutomationAction[];
  }) {
    setIsSubmitting(true);
    setMutationError(null);

    try {
      const request = {
        name: payload.name,
        trigger_type: payload.trigger_type,
        is_active: payload.is_active,
        conditions: sanitizeConditions(payload.conditions),
        actions: sanitizeActions(payload.actions),
      };

      if (editingAutomation) {
        await api.updateAutomation(editingAutomation.id, request);
      } else {
        await api.createAutomation(request);
      }

      setEditingAutomation(null);
      automations.reload();
      runs.reload();
      suggestions.reload();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Unable to save automation");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggle(automation: Automation) {
    setMutationError(null);
    try {
      await api.updateAutomation(automation.id, { is_active: !automation.is_active });
      automations.reload();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Unable to change automation state");
    }
  }

  if (automations.isLoading || leads.isLoading || runs.isLoading || suggestions.isLoading) {
    return <LoadingState title="Loading automations" copy="Pulling automation rules, leads and execution history." />;
  }

  if (automations.error || leads.error || runs.error || suggestions.error) {
    return (
      <ErrorState
        title="Automation console failed to load"
        copy={automations.error || leads.error || runs.error || suggestions.error || "Unexpected error"}
        action={{ label: "Retry", onClick: () => {
          automations.reload();
          leads.reload();
          runs.reload();
          suggestions.reload();
        } }}
      />
    );
  }

  const automationList = automations.data ?? [];
  const leadList = leads.data ?? [];
  const runList = runs.data ?? [];
  const activeAutomations = automationList.filter((item) => item.is_active).length;
  const pausedAutomations = automationList.length - activeAutomations;
  const scoringActions = automationList.filter((item) => {
    const actions = Array.isArray(item.actions_json) ? item.actions_json : (item.actions_json.actions ?? []);
    return actions.some((action) => action.type === "score");
  }).length;
  const failedRuns = runList.filter((item) => item.status === "failed").length;
  const runningRuns = runList.filter((item) => item.status === "running").length;
  const lastStatusByAutomation = lastRunStatusByAutomation(runList);

  return (
    <div className="page-stack automation-console">
      <PageHeader
        eyebrow="Revenue Ops"
        title="Automations"
        description="Manage follow-up logic, lead scoring, and execution health from one operational console."
        actions={
          <div className="action-row">
            <Button variant={editingAutomation ? "secondary" : "primary"} onClick={() => setEditingAutomation(null)}>
              {editingAutomation ? "Create new rule" : "New automation"}
            </Button>
          </div>
        }
        meta={
          <div className="pill-row">
            <Badge tone="cold">{activeAutomations} live</Badge>
            <Badge tone={failedRuns > 0 ? "warning" : "neutral"}>{failedRuns} failures</Badge>
            <Badge tone="neutral">{leadList.length} leads in scoring view</Badge>
          </div>
        }
      />

      <div className="stats-grid">
        <StatCard label="Rules live" value={activeAutomations} hint={`${pausedAutomations} paused rules remain available in the registry.`} />
        <StatCard label="Execution issues" value={failedRuns} hint={runningRuns > 0 ? `${runningRuns} runs are still processing.` : "No runs are currently in progress."} />
        <StatCard label="Scoring coverage" value={scoringActions} hint="Rules that add or adjust points on lead records." />
      </div>

      <div className="automation-console__summary surface-card">
        <div>
          <p className="automation-console__kicker">Console coverage</p>
          <h2 className="automation-console__summary-title">Builder, registry, and lead context stay on the same screen.</h2>
        </div>
        <div className="automation-console__summary-metrics">
          <div>
            <span className="muted-text">Recent runs</span>
            <strong>{runList.length}</strong>
          </div>
          <div>
            <span className="muted-text">Tag suggestions</span>
            <strong>{suggestions.data?.length ?? 0}</strong>
          </div>
          <div>
            <span className="muted-text">Selected lead</span>
            <strong>{selectedLead?.name ?? "None"}</strong>
          </div>
        </div>
      </div>

      <div className="automation-console__layout">
        <div className="automation-console__main">
          <Card
            title="Rule builder"
            subtitle={
              editingAutomation
                ? "Update trigger logic, conditions, and downstream actions without leaving the console."
                : "Create operational rules for qualification, routing, follow-up, and score changes."
            }
          >
            <AutomationForm
              automation={editingAutomation}
              busy={isSubmitting}
              error={mutationError}
              onSubmit={handleSubmit}
              onCancel={editingAutomation ? () => setEditingAutomation(null) : undefined}
            />
          </Card>

          <AutomationRunList automations={automationList} runs={runList} />
        </div>

        <div className="automation-console__rail">
          <Card title="Automation registry" subtitle="Review rule coverage, reopen drafts, and pause policies without leaving the console.">
            <div className="automation-registry__summary">
              <div>
                <span className="muted-text">Total rules</span>
                <strong>{automationList.length}</strong>
              </div>
              <div>
                <span className="muted-text">Live</span>
                <strong>{activeAutomations}</strong>
              </div>
              <div>
                <span className="muted-text">Paused</span>
                <strong>{pausedAutomations}</strong>
              </div>
            </div>

            <div className="timeline-list">
          {automationList.length > 0 ? (
              automationList.map((automation) => (
                <article className="timeline-item automation-item" key={automation.id}>
                  <div className="topbar-row">
                    <div className="inline-stack">
                      <strong>{automation.name}</strong>
                      <span className="muted-text">{formatTrigger(automation.trigger_type)}</span>
                    </div>
                    <Badge tone={automation.is_active ? "cold" : "warning"}>
                      {automation.is_active ? "live" : "paused"}
                    </Badge>
                  </div>
                  <div className="automation-run__meta">
                    <span>{countConditions(automation)} conditions</span>
                    <span>{countActions(automation)} actions</span>
                    <span>Last run: {lastStatusByAutomation.get(automation.id) ?? "not yet executed"}</span>
                  </div>
                  <div className="automation-run__meta">
                    <span>Updated {new Date(automation.updated_at).toLocaleDateString()}</span>
                  </div>
                  <div className="action-row">
                    <Button variant="secondary" size="small" onClick={() => setEditingAutomation(automation)}>
                      Open builder
                    </Button>
                    <Button variant="ghost" size="small" onClick={() => handleToggle(automation)}>
                      {automation.is_active ? "Pause" : "Activate"}
                    </Button>
                  </div>
                </article>
              ))
          ) : (
              <div className="muted-text">No automations are configured yet. Start with a rule for stage changes, inactivity, or score updates.</div>
          )}
            </div>
          </Card>

          <Card title="Lead scoring context" subtitle="Inspect score movement, automatic tags, and tag suggestions for a single record.">
            <div className="inline-stack">
              <Field label="Lead">
                <select value={selectedLeadId} onChange={(event) => setSelectedLeadId(event.target.value)}>
                  {leadList.map((lead: Lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.name}
                    </option>
                  ))}
                </select>
              </Field>

              {scoreEvents.isLoading || leadTags.isLoading ? (
                <div className="muted-text">Loading scoring context...</div>
              ) : scoreEvents.error || leadTags.error ? (
                <div className="banner-error">{scoreEvents.error || leadTags.error}</div>
              ) : (
                <LeadScorePanel
                  lead={selectedLead}
                  events={scoreEvents.data ?? []}
                  tags={leadTags.data ?? []}
                  suggestions={suggestions.data ?? []}
                />
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
