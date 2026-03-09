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
    <section className="surface-card">
      <div className="card-header">
        <div className="card-header__body">
          <h3 className="panel-title">Execution history</h3>
          <p className="panel-subtitle">Review recent runs, retries, and failures without leaving the builder.</p>
        </div>
      </div>
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
              <div className="automation-run__meta">
                <span>{run.attempts} attempt{run.attempts === 1 ? "" : "s"}</span>
                <span>ID {run.idempotency_key.slice(0, 8)}</span>
              </div>
              {run.error ? <div className="banner-error">{run.error}</div> : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="muted-text">Execution history will appear here once the first rule starts running.</div>
      )}
    </section>
  );
}
