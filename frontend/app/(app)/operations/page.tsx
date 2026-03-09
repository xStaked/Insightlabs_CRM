"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/data-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/primitives";
import { StatCard } from "@/components/ui/stat-card";
import { useAsyncResource } from "@/lib/hooks/use-async-resource";

function summarizePayload(payload: Record<string, unknown>) {
  const entries = Object.entries(payload);
  if (!entries.length) {
    return "No metadata";
  }

  return entries
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(" · ");
}

function auditTone(action: string): "neutral" | "warning" | "cold" {
  if (action.includes("failed") || action.includes("denied")) {
    return "warning";
  }
  if (action.includes("created") || action.includes("processed")) {
    return "cold";
  }
  return "neutral";
}

export default function OperationsPage() {
  const { api } = useAuth();
  const operations = useAsyncResource(() => api.getOperationsStatus(), []);
  const audit = useAsyncResource(() => api.listAuditLogs({ limit: 50 }), []);

  if (operations.isLoading || audit.isLoading) {
    return <LoadingState title="Loading operations" copy="Collecting rate-limit state, failed webhooks, and recent audit activity." />;
  }

  if (operations.error || audit.error) {
    return (
      <ErrorState
        title="Operations failed to load"
        copy={operations.error || audit.error || "Unknown error"}
        action={{ label: "Retry", onClick: () => window.location.reload() }}
      />
    );
  }

  const rateLimits = operations.data?.rate_limits || [];
  const failedWebhooks = operations.data?.failed_webhooks || [];
  const authIncidents = (audit.data || []).filter((item) => item.entity === "auth" || item.action.includes("auth"));
  const saturatedNamespaces = rateLimits.filter((item) => item.saturated).length;

  return (
    <div className="page-stack ops-console">
      <PageHeader
        eyebrow="Admin Console"
        title="Operations"
        description="Monitor rate limits, delivery failures, and audit activity from one internal operations view."
        meta={
          <div className="pill-row">
            <Badge tone={saturatedNamespaces > 0 ? "warning" : "cold"}>{saturatedNamespaces} constrained namespaces</Badge>
            <Badge tone={failedWebhooks.length > 0 ? "warning" : "neutral"}>{failedWebhooks.length} failed webhooks</Badge>
            <Badge tone="neutral">{authIncidents.length} auth incidents</Badge>
          </div>
        }
      />

      <div className="stats-grid">
        <StatCard label="Rate limit pressure" value={saturatedNamespaces} hint={`${rateLimits.length} namespaces are currently being tracked.`} />
        <StatCard label="Webhook failures" value={failedWebhooks.length} hint={failedWebhooks.length ? "Providers requiring attention are listed below." : "No failed deliveries are pending review."} />
        <StatCard label="Audit events" value={audit.data?.length ?? 0} hint="Recent high-signal events across the CRM and background services." />
      </div>

      <div className="ops-console__summary surface-card">
        <div>
          <p className="automation-console__kicker">Operational visibility</p>
          <h2 className="automation-console__summary-title">Health signals, incidents, and audit context stay readable under load.</h2>
        </div>
        <div className="automation-console__summary-metrics">
          <div>
            <span className="muted-text">Retry queues</span>
            <strong>{failedWebhooks.filter((item) => item.status !== "processed").length}</strong>
          </div>
          <div>
            <span className="muted-text">Auth-related events</span>
            <strong>{authIncidents.length}</strong>
          </div>
          <div>
            <span className="muted-text">Highest pressure</span>
            <strong>{rateLimits[0]?.namespace ?? "None"}</strong>
          </div>
        </div>
      </div>

      <div className="card-grid">
        {rateLimits.map((item) => (
          <Card
            key={item.namespace}
            title={item.namespace}
            subtitle={`Window ${item.window_seconds}s · limit ${item.limit} requests`}
            actions={<Badge tone={item.saturated ? "warning" : "cold"}>{item.saturated ? "attention" : "healthy"}</Badge>}
          >
            <div className="list-stack ops-console__metric-stack">
              <div className="topbar-row">
                <span className="muted-text">Active buckets</span>
                <strong>{item.active_keys}</strong>
              </div>
              <div className="topbar-row">
                <span className="muted-text">Max hits</span>
                <strong>{item.max_hits}</strong>
              </div>
              <div className="topbar-row">
                <span className="muted-text">Retry after</span>
                <strong>{item.retry_after_seconds}s</strong>
              </div>
              <div className={`meter${item.saturated ? " meter--warning" : " meter--accent"}`}>
                <span style={{ width: `${Math.min((item.max_hits / item.limit) * 100, 100)}%` }} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="two-column-grid">
        <Card title="Failed webhook events" subtitle="Providers, event identifiers, and errors that require operational review.">
          {failedWebhooks.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Provider</th>
                    <th>Event</th>
                    <th>Status</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {failedWebhooks.map((item) => (
                    <tr key={item.id}>
                      <td>{new Date(item.created_at).toLocaleString()}</td>
                      <td>{item.provider}</td>
                      <td>
                        <div className="inline-stack">
                          <strong>{item.event_type}</strong>
                          <span className="muted-text">{item.event_id}</span>
                        </div>
                      </td>
                      <td>
                        <Badge tone="warning">{item.status}</Badge>
                      </td>
                      <td>{item.error || "No error body"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No failed webhooks" copy="Delivery failures will appear here when asynchronous processing marks a provider event for follow-up." />
          )}
        </Card>

        <Card title="Recent auth incidents" subtitle="Authentication and access-control events surfaced from the audit log.">
          {authIncidents.length ? (
            <div className="timeline-list">
              {authIncidents.slice(0, 12).map((item) => (
                <article className="timeline-item" key={item.id}>
                  <div className="topbar-row">
                    <strong>{item.action}</strong>
                    <Badge tone={auditTone(item.action)}>{new Date(item.created_at).toLocaleString()}</Badge>
                  </div>
                  <div className="muted-text">Entity: {item.entity} · Actor: {item.actor_user_id || "anonymous"}</div>
                  <div className="muted-text">Metadata: {summarizePayload(item.payload_json)}</div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="No auth incidents" copy="Failed sign-ins and access exceptions will appear in this stream when the backend records them." />
          )}
        </Card>
      </div>

      <Card title="Audit trail" subtitle="Recent owner and admin actions across CRM workflows, automation changes, and backend services.">
        {(audit.data || []).length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Actor</th>
                  <th>Metadata</th>
                </tr>
              </thead>
              <tbody>
                {(audit.data || []).map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.created_at).toLocaleString()}</td>
                    <td>
                      <div className="inline-stack">
                        <strong>{item.action}</strong>
                        <Badge tone={auditTone(item.action)}>{item.entity}</Badge>
                      </div>
                    </td>
                    <td>
                      <div>{item.entity}</div>
                      <div className="muted-text">{item.entity_id}</div>
                    </td>
                    <td>{item.actor_user_id || "system"}</td>
                    <td>{summarizePayload(item.payload_json)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No audit rows yet" copy="Sensitive writes from CRM, billing, messaging, and automations will populate this table automatically." />
        )}
      </Card>
    </div>
  );
}
