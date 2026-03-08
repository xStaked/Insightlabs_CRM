"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/data-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/primitives";
import { useAsyncResource } from "@/lib/hooks/use-async-resource";

export default function OperationsPage() {
  const { api } = useAuth();
  const operations = useAsyncResource(() => api.getOperationsStatus(), []);
  const audit = useAsyncResource(() => api.listAuditLogs({ limit: 50 }), []);

  if (operations.isLoading || audit.isLoading) {
    return <LoadingState title="Loading operations" copy="Collecting rate-limit state, failed webhooks and recent audit activity." />;
  }

  if (operations.error || audit.error) {
    return <ErrorState title="Operations failed to load" copy={operations.error || audit.error || "Unknown error"} action={{ label: "Retry", onClick: () => window.location.reload() }} />;
  }

  const authIncidents = (audit.data || []).filter((item) => item.entity === "auth" || item.action.includes("auth"));

  return (
    <div className="page-stack">
      <PageHeader
        title="Operations"
        description="Administrative visibility for rate limiting, webhook failures, audit trail and backend-issued request identifiers in error payloads."
      />

      <div className="card-grid">
        {(operations.data?.rate_limits || []).map((item) => (
          <Card
            key={item.namespace}
            title={item.namespace}
            subtitle={`Window ${item.window_seconds}s · limit ${item.limit}`}
            actions={<Badge tone={item.saturated ? "warning" : "cold"}>{item.saturated ? "saturated" : "healthy"}</Badge>}
          >
            <div className="list-stack">
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
        <Card title="Failed webhook events" subtitle="Backed by GET /operations/status.">
          {(operations.data?.failed_webhooks || []).length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Event</th>
                    <th>Status</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {operations.data?.failed_webhooks.map((item) => (
                    <tr key={item.id}>
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
            <EmptyState title="No failed webhooks" copy="Webhook processing failures will appear here when async handling marks an event as failed." />
          )}
        </Card>

        <Card title="Recent auth incidents" subtitle="Derived from GET /audit/logs.">
          {authIncidents.length ? (
            <div className="timeline-list">
              {authIncidents.slice(0, 12).map((item) => (
                <article className="timeline-item" key={item.id}>
                  <div className="topbar-row">
                    <strong>{item.action}</strong>
                    <Badge tone="warning">{new Date(item.created_at).toLocaleString()}</Badge>
                  </div>
                  <div className="muted-text">Entity: {item.entity} · Actor: {item.actor_user_id || "anonymous"}</div>
                  <div className="muted-text">Payload: {JSON.stringify(item.payload_json)}</div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="No auth incidents" copy="Failed login attempts logged by the backend will appear in this stream." />
          )}
        </Card>
      </div>

      <Card title="Audit trail" subtitle="Backed by GET /audit/logs for owner/admin roles.">
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
                    <td>{item.action}</td>
                    <td>
                      {item.entity}
                      <div className="muted-text">{item.entity_id}</div>
                    </td>
                    <td>{item.actor_user_id || "system"}</td>
                    <td>{JSON.stringify(item.payload_json)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No audit rows yet" copy="Sensitive writes from core CRM, billing, messaging and automations are logged automatically." />
        )}
      </Card>
    </div>
  );
}
