"use client";

import Link from "next/link";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/data-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/primitives";
import { StatCard } from "@/components/ui/stat-card";
import { useAsyncResource } from "@/lib/hooks/use-async-resource";

export default function DashboardPage() {
  const { api } = useAuth();
  const leads = useAsyncResource(() => api.listLeads(), []);
  const pipelines = useAsyncResource(() => api.listPipelines(), []);
  const subscription = useAsyncResource(() => api.getSubscriptionStatus(), []);
  const plans = useAsyncResource(() => api.listPlans(), []);

  const isLoading = leads.isLoading || pipelines.isLoading || subscription.isLoading || plans.isLoading;
  const error = leads.error || pipelines.error || subscription.error || plans.error;
  const activePlan = plans.data?.find((plan) => plan.id === subscription.data?.plan_id);
  const leadRecords = leads.data || [];
  const pipelineRecords = pipelines.data || [];

  const hotLeads = leadRecords.filter((lead) => lead.temperature === "hot").length;
  const warmLeads = leadRecords.filter((lead) => lead.temperature === "warm").length;
  const leadsWithoutStage = leadRecords.filter((lead) => !lead.current_stage_id).length;
  const openLeads = leadRecords.filter((lead) => !["won", "lost"].includes(lead.status)).length;
  const activePipelines = pipelineRecords.filter((pipeline) => pipeline.is_active).length;
  const recentLeads = leadRecords.filter((lead) => {
    const createdAt = Date.parse(lead.created_at);
    if (Number.isNaN(createdAt)) {
      return false;
    }
    return Date.now() - createdAt <= 1000 * 60 * 60 * 24 * 7;
  }).length;

  const channelBreakdown = Object.entries(
    leadRecords.reduce<Record<string, number>>((acc, lead) => {
      acc[lead.source_channel] = (acc[lead.source_channel] || 0) + 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const statusBreakdown = Object.entries(
    leadRecords.reduce<Record<string, number>>((acc, lead) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  if (isLoading) {
    return <LoadingState title="Loading dashboard" copy="Collecting CRM, pipeline and billing context." />;
  }

  if (error) {
    return <ErrorState title="Dashboard failed to load" copy={error} action={{ label: "Retry", onClick: () => window.location.reload() }} />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Dashboard"
        description="A working read on pipeline demand, subscription health, and where the team needs attention first."
        actions={
          <div className="action-row">
            <Link href="/leads">
              <Button size="small">Review leads</Button>
            </Link>
            <Link href="/pipelines">
              <Button size="small" variant="secondary">
                Open pipelines
              </Button>
            </Link>
          </div>
        }
      />

      <div className="stats-grid">
        <StatCard label="Open leads" value={openLeads} hint={`${hotLeads} hot and ${warmLeads} warm leads currently in play.`} />
        <StatCard label="Recent intake" value={recentLeads} hint="Leads created in the last 7 days across all active channels." />
        <StatCard
          label="Pipeline coverage"
          value={activePipelines}
          hint={`${pipelineRecords.length} configured pipeline${pipelineRecords.length === 1 ? "" : "s"} in this workspace.`}
        />
        <StatCard
          label="Subscription"
          value={subscription.data?.status || "unavailable"}
          hint={
            activePlan
              ? `${activePlan.name} plan${subscription.data?.renews_at ? ` renews ${new Date(subscription.data.renews_at).toLocaleDateString()}` : ""}`
              : "Plan details are not available yet."
          }
        />
      </div>

      <div className="hero-grid">
        <section className="hero-panel surface-card">
          <div className="eyebrow">Today at a glance</div>
          <h2 className="hero-title">Keep the queue moving, protect response time, and close cleanly.</h2>
          <p className="hero-copy">
            This home view is built to answer three questions fast: how much demand is active, which leads need human
            attention now, and whether billing or pipeline setup is slowing the team down.
          </p>

          <div className="pill-row" style={{ marginTop: 20 }}>
            <Badge tone={hotLeads > 0 ? "hot" : "neutral"}>{hotLeads} hot leads</Badge>
            <Badge tone={leadsWithoutStage > 0 ? "warning" : "neutral"}>{leadsWithoutStage} unassigned</Badge>
            <Badge tone="neutral">{activePipelines} active pipelines</Badge>
          </div>
        </section>

        <Card title="Watchlist" subtitle="The items that usually need cleanup before conversion slows down.">
          <div className="list-stack">
            <div>{leadsWithoutStage} leads are still outside a pipeline stage and may need routing.</div>
            <div>{openLeads} leads remain active; prioritize the {hotLeads} marked hot before they cool down.</div>
            <div>{activePipelines === 0 ? "No active pipelines are configured yet." : `${activePipelines} active pipeline${activePipelines === 1 ? "" : "s"} are available for daily work.`}</div>
            <div>
              Billing is currently <strong>{subscription.data?.status || "unavailable"}</strong>
              {activePlan ? ` on ${activePlan.name}.` : "."}
            </div>
          </div>
        </Card>
      </div>

      <div className="two-column-grid">
        <Card title="Lead distribution" subtitle="Use this to see where current demand is arriving from.">
          {channelBreakdown.length > 0 ? (
            <div className="list-stack">
              {channelBreakdown.map(([channel, total]) => (
                <div
                  key={channel}
                  className="topbar-row"
                  style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)" }}
                >
                  <span style={{ textTransform: "capitalize" }}>{channel}</span>
                  <strong>{total}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted-text">Lead source distribution will appear once the workspace starts receiving records.</div>
          )}
        </Card>

        <Card title="Pipeline outcomes" subtitle="Status mix across all available lead records.">
          {statusBreakdown.length > 0 ? (
            <div className="pill-row">
              {statusBreakdown.map(([status, total]) => (
                <Badge key={status} tone={status === "won" ? "cold" : status === "lost" ? "neutral" : "warning"}>
                  {status} {total}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="muted-text">Status breakdown will populate after the first lead is created.</div>
          )}

          <div className="list-stack" style={{ marginTop: 16 }}>
            <div>{leadRecords.length} total lead records are currently available in the workspace.</div>
            <div>{pipelineRecords.filter((pipeline) => pipeline.is_default).length} pipeline marked as default for new routing.</div>
          </div>
        </Card>
      </div>

      {leadRecords.length === 0 ? (
        <EmptyState
          title="No leads yet"
          copy="Create the first lead to populate the dashboard, route work into pipelines, and give the team a real operating queue."
        />
      ) : (
        <Card title="Next actions" subtitle="Recommended paths based on the current workspace state.">
          <div className="action-row">
            <Link href="/leads">
              <Button variant="secondary">Open lead queue</Button>
            </Link>
            <Link href="/pipelines">
              <Button variant="secondary">Adjust pipeline setup</Button>
            </Link>
            <Link href="/billing">
              <Button variant="ghost">Review billing</Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
