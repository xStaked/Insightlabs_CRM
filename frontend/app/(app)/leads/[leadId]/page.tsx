"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/data-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/primitives";
import { useAsyncResource } from "@/lib/hooks/use-async-resource";

export default function LeadDetailPage() {
  const params = useParams<{ leadId: string }>();
  const { api } = useAuth();
  const leads = useAsyncResource(() => api.listLeads(), []);
  const tasks = useAsyncResource(() => api.listTasks(), []);
  const appointments = useAsyncResource(() => api.listAppointments(), []);

  const isLoading = leads.isLoading || tasks.isLoading || appointments.isLoading;
  const error = leads.error || tasks.error || appointments.error;
  const lead = leads.data?.find((item) => item.id === params.leadId);
  const leadTasks = (tasks.data || []).filter((task) => task.lead_id === params.leadId);
  const leadAppointments = (appointments.data || []).filter((appointment) => appointment.lead_id === params.leadId);

  if (isLoading) {
    return <LoadingState title="Loading lead detail" copy="Joining lead, task and appointment context." />;
  }

  if (error) {
    return <ErrorState title="Lead detail failed to load" copy={error} action={{ label: "Retry", onClick: () => window.location.reload() }} />;
  }

  if (!lead) {
    return <EmptyState title="Lead not found" copy="This tenant does not expose the requested lead id in the current list response." />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        title={lead.name}
        description="Read-only lead detail assembled from current list endpoints. Full edit route still depends on backend GET/PATCH by id."
        actions={
          <Link href="/leads">
            <Button variant="secondary">Back to leads</Button>
          </Link>
        }
      />

      <div className="card-grid">
        <Card title="Lead profile">
          <div className="list-stack">
            <div><strong>Email:</strong> {lead.email || "-"}</div>
            <div><strong>Phone:</strong> {lead.phone || "-"}</div>
            <div><strong>Source:</strong> {lead.source_channel}</div>
            <div><strong>Status:</strong> {lead.status}</div>
            <div><strong>Stage:</strong> {lead.current_stage_id || "Unassigned"}</div>
            <div>
              <strong>Temperature:</strong>{" "}
              <Badge tone={lead.temperature === "hot" ? "hot" : lead.temperature === "warm" ? "warm" : "cold"}>
                {lead.temperature}
              </Badge>
            </div>
          </div>
        </Card>

        <Card title="Operational notes">
          <div className="list-stack">
            <div>Lead edit is pending backend support for dedicated read/update endpoints.</div>
            <div>Tasks and appointments below are already real records filtered by `lead_id`.</div>
          </div>
        </Card>
      </div>

      <div className="two-column-grid">
        <Card title="Tasks linked to this lead">
          {leadTasks.length > 0 ? (
            <div className="timeline-list">
              {leadTasks.map((task) => (
                <article className="timeline-item" key={task.id}>
                  <div className="topbar-row">
                    <strong>{task.type}</strong>
                    <Badge tone="neutral">{task.status}</Badge>
                  </div>
                  <div className="muted-text">Due: {task.due_at || "No due date"}</div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="No tasks for this lead" copy="Create a task from the Tasks page and link it to this lead id." />
          )}
        </Card>

        <Card title="Appointments linked to this lead">
          {leadAppointments.length > 0 ? (
            <div className="timeline-list">
              {leadAppointments.map((appointment) => (
                <article className="timeline-item" key={appointment.id}>
                  <div className="topbar-row">
                    <strong>{appointment.location || "Appointment"}</strong>
                    <Badge tone="neutral">{appointment.status}</Badge>
                  </div>
                  <div className="muted-text">
                    {appointment.starts_at} {"->"} {appointment.ends_at}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="No appointments for this lead" copy="Create an appointment from the Agenda page and link it to this lead id." />
          )}
        </Card>
      </div>
    </div>
  );
}
