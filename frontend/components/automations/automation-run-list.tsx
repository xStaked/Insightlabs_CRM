import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/primitives";
import type { Automation, AutomationRun } from "@/types/api";

function runTone(status: string): "default" | "neutral" | "warning" | "hot" | "warm" | "cold" {
  if (status === "completed") {
    return "cold";
  }
  if (status === "failed") {
    return "hot";
  }
  if (status === "running") {
    return "warm";
  }
  return "warning";
}

export function AutomationRunList({
  automations,
  runs,
}: {
  automations: Automation[];
  runs: AutomationRun[];
}) {
  const nameById = new Map(automations.map((automation) => [automation.id, automation.name]));

  return (
    <Card title="Execution history" subtitle="Recent automation runs across triggers and leads.">
      {runs.length > 0 ? (
        <div className="timeline-list">
          {runs.map((run) => (
            <article className="timeline-item automation-run" key={run.id}>
              <div className="topbar-row">
                <strong>{nameById.get(run.automation_id) || "Automation"}</strong>
                <Badge tone={runTone(run.status)}>{run.status}</Badge>
              </div>
              <div className="automation-run__meta">
                <span>{run.entity_type}</span>
                <span>{run.entity_id}</span>
                <span>{new Date(run.created_at).toLocaleString()}</span>
              </div>
              {run.error ? <div className="banner-error">{run.error}</div> : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="muted-text">No automation runs registered yet for this tenant.</div>
      )}
    </Card>
  );
}
