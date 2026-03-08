"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/data-state";
import { PageHeader } from "@/components/ui/page-header";
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

  if (isLoading) {
    return <LoadingState title="Loading dashboard" copy="Collecting CRM, pipeline and billing context." />;
  }

  if (error) {
    return <ErrorState title="Dashboard failed to load" copy={error} action={{ label: "Retry", onClick: () => window.location.reload() }} />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Operational overview"
        description="A fast read on tenant health, pipeline coverage and the billing state behind route access."
      />

      <div className="stats-grid">
        <StatCard label="Leads" value={leads.data?.length || 0} hint="Current reachable lead records from /leads." />
        <StatCard
          label="Pipelines"
          value={pipelines.data?.length || 0}
          hint="Active pipeline definitions available for kanban and stage movement."
        />
        <StatCard
          label="Subscription"
          value={subscription.data?.status || "unavailable"}
          hint={activePlan ? `${activePlan.name} plan` : "No plan metadata resolved yet."}
        />
      </div>

      <div className="hero-grid">
        <section className="hero-panel surface-card">
          <div className="eyebrow">Frontend phase status</div>
          <h2 className="hero-title">Shell, auth and domain pages are wired to the current API.</h2>
          <p className="hero-copy">
            The remaining work is mainly domain depth: richer forms, edit flows, task and appointment UI once their
            endpoints are exposed, and automation CRUD when backend routes land.
          </p>
        </section>

        <Card title="What is live now" subtitle="Directly backed by the current backend surface.">
          <div className="list-stack">
            <div>Login per tenant with seeded admin credentials.</div>
            <div>Authenticated shell with sidebar, guards and session refresh support.</div>
            <div>Leads CRUD slice, pipelines, stage creation, kanban and billing checkout.</div>
            <div>Reports, audit trail and operational health views for admin workflows.</div>
            <div>Explicit loading, error and empty states instead of silent blank screens.</div>
          </div>
        </Card>
      </div>

      {(leads.data?.length || 0) === 0 ? (
        <EmptyState
          title="No leads yet"
          copy="The frontend is healthy, but the tenant still has no CRM activity. Create the first lead from the Leads page."
        />
      ) : null}
    </div>
  );
}
