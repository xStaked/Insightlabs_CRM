"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { useAuth } from "@/components/auth/auth-provider";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/data-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/primitives";
import { useAsyncResource } from "@/lib/hooks/use-async-resource";
import type { Appointment, Lead, Task } from "@/types/api";

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getTemperatureTone(temperature: Lead["temperature"]) {
  if (temperature === "hot") {
    return "hot";
  }

  if (temperature === "warm") {
    return "warm";
  }

  return "cold";
}

function getStatusTone(status: string) {
  if (status === "won") {
    return "warm";
  }

  if (status === "lost") {
    return "neutral";
  }

  return "warning";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getTaskTone(status: string) {
  return status === "done" ? "cold" : "warning";
}

function getAppointmentTone(status: string) {
  if (status === "completed") {
    return "cold";
  }

  if (status === "cancelled") {
    return "neutral";
  }

  return "warning";
}

type TimelineEntry =
  | { id: string; type: "task"; sortAt: string | null; title: string; subtitle: string; status: string; tone: "cold" | "warning" | "neutral" }
  | { id: string; type: "appointment"; sortAt: string | null; title: string; subtitle: string; status: string; tone: "cold" | "warning" | "neutral" };

function toTimeline(tasks: Task[], appointments: Appointment[]): TimelineEntry[] {
  const taskEntries: TimelineEntry[] = tasks.map((task) => ({
    id: task.id,
    type: "task",
    sortAt: task.due_at || task.created_at,
    title: task.type.replaceAll("_", " "),
    subtitle: task.due_at ? `Due ${formatDateTime(task.due_at)}` : "No due date set",
    status: task.status,
    tone: getTaskTone(task.status),
  }));

  const appointmentEntries: TimelineEntry[] = appointments.map((appointment) => ({
    id: appointment.id,
    type: "appointment",
    sortAt: appointment.starts_at || appointment.created_at,
    title: appointment.location || "Scheduled appointment",
    subtitle: `${formatDateTime(appointment.starts_at)} to ${formatDateTime(appointment.ends_at)}`,
    status: appointment.status,
    tone: getAppointmentTone(appointment.status),
  }));

  return [...taskEntries, ...appointmentEntries].sort((left, right) => {
    const leftTime = left.sortAt ? Date.parse(left.sortAt) : 0;
    const rightTime = right.sortAt ? Date.parse(right.sortAt) : 0;
    return rightTime - leftTime;
  });
}

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
  const timeline = toTimeline(leadTasks, leadAppointments);

  if (isLoading) {
    return <LoadingState title="Loading lead record" copy="Pulling profile context, tasks and appointments for this lead." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Lead record failed to load"
        copy={error}
        action={{ label: "Retry", onClick: () => window.location.reload() }}
      />
    );
  }

  if (!lead) {
    return <EmptyState title="Lead not found" copy="The requested lead is not available in the current workspace list." />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Lead record"
        description="A single workspace for identity, qualification and scheduled follow-through."
        actions={
          <Link href="/leads" className="button button--secondary">
            Back to leads
          </Link>
        }
      />

      <section className="crm-workspace crm-workspace--stack">
        <section className="crm-record-hero">
          <div className="crm-record-hero__identity">
            <div className="crm-avatar crm-avatar--large">{getInitials(lead.name)}</div>
            <div className="crm-record-hero__body">
              <div className="crm-record-hero__title-row">
                <h2>{lead.name}</h2>
                <Badge tone={getStatusTone(lead.status)}>{lead.status}</Badge>
                <Badge tone={getTemperatureTone(lead.temperature)}>{lead.temperature}</Badge>
              </div>
              <div className="crm-record-hero__meta">
                <span>{lead.email || "No email on file"}</span>
                <span>{lead.phone || "No phone on file"}</span>
                <span>{lead.source_channel}</span>
              </div>
            </div>
          </div>
          <div className="crm-kpi-grid">
            <article className="crm-kpi-card">
              <span className="crm-kpi-card__label">Score</span>
              <strong className="crm-kpi-card__value">{lead.score_total}</strong>
              <span className="crm-kpi-card__meta">Current intent signal</span>
            </article>
            <article className="crm-kpi-card">
              <span className="crm-kpi-card__label">Stage</span>
              <strong className="crm-kpi-card__value crm-kpi-card__value--text">{lead.current_stage_id || "Unassigned"}</strong>
              <span className="crm-kpi-card__meta">Latest pipeline position</span>
            </article>
            <article className="crm-kpi-card">
              <span className="crm-kpi-card__label">Linked tasks</span>
              <strong className="crm-kpi-card__value">{leadTasks.length}</strong>
              <span className="crm-kpi-card__meta">Follow-ups registered for this lead</span>
            </article>
            <article className="crm-kpi-card">
              <span className="crm-kpi-card__label">Appointments</span>
              <strong className="crm-kpi-card__value">{leadAppointments.length}</strong>
              <span className="crm-kpi-card__meta">Scheduled meetings on the record</span>
            </article>
          </div>
        </section>

        <div className="crm-detail-layout">
          <div className="crm-detail-main">
            <Card title="Overview" subtitle="Core identity, routing and contact details visible without switching modules.">
              <div className="crm-definition-grid">
                <div className="crm-definition-block">
                  <h3 className="crm-section-title">Identity</h3>
                  <div className="crm-definition-list">
                    <div className="crm-definition-row">
                      <span>Name</span>
                      <strong>{lead.name}</strong>
                    </div>
                    <div className="crm-definition-row">
                      <span>Email</span>
                      <strong>{lead.email || "Missing"}</strong>
                    </div>
                    <div className="crm-definition-row">
                      <span>Phone</span>
                      <strong>{lead.phone || "Missing"}</strong>
                    </div>
                  </div>
                </div>

                <div className="crm-definition-block">
                  <h3 className="crm-section-title">Qualification</h3>
                  <div className="crm-definition-list">
                    <div className="crm-definition-row">
                      <span>Status</span>
                      <Badge tone={getStatusTone(lead.status)}>{lead.status}</Badge>
                    </div>
                    <div className="crm-definition-row">
                      <span>Temperature</span>
                      <Badge tone={getTemperatureTone(lead.temperature)}>{lead.temperature}</Badge>
                    </div>
                    <div className="crm-definition-row">
                      <span>Score total</span>
                      <strong>{lead.score_total}</strong>
                    </div>
                  </div>
                </div>

                <div className="crm-definition-block">
                  <h3 className="crm-section-title">Lifecycle</h3>
                  <div className="crm-definition-list">
                    <div className="crm-definition-row">
                      <span>Source</span>
                      <strong>{lead.source_channel}</strong>
                    </div>
                    <div className="crm-definition-row">
                      <span>Current stage</span>
                      <strong>{lead.current_stage_id || "Needs assignment"}</strong>
                    </div>
                    <div className="crm-definition-row">
                      <span>Created</span>
                      <strong>{formatDate(lead.created_at)}</strong>
                    </div>
                    <div className="crm-definition-row">
                      <span>Last updated</span>
                      <strong>{formatDate(lead.updated_at)}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Activity timeline" subtitle="Tasks and appointments linked by lead ID presented in one operational sequence.">
              {timeline.length > 0 ? (
                <div className="crm-timeline-list">
                  {timeline.map((entry) => (
                    <article className="crm-timeline-item" key={`${entry.type}-${entry.id}`}>
                      <div className="crm-timeline-item__header">
                        <div>
                          <div className="crm-timeline-item__eyebrow">{entry.type === "task" ? "Task" : "Appointment"}</div>
                          <strong>{entry.title}</strong>
                        </div>
                        <Badge tone={entry.tone}>{entry.status}</Badge>
                      </div>
                      <p>{entry.subtitle}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="crm-inline-empty">
                  No follow-up activity is linked to this lead yet. Create tasks or appointments from their respective modules to build the record history.
                </div>
              )}
            </Card>
          </div>

          <div className="crm-detail-rail">
            <Card title="Follow-up queue" subtitle="Linked tasks already visible to the team.">
              {leadTasks.length > 0 ? (
                <div className="crm-related-list">
                  {leadTasks.map((task) => (
                    <article className="crm-related-item" key={task.id}>
                      <div className="crm-related-item__header">
                        <strong>{task.type.replaceAll("_", " ")}</strong>
                        <Badge tone={getTaskTone(task.status)}>{task.status}</Badge>
                      </div>
                      <p>Due {task.due_at ? formatDateTime(task.due_at) : "when scheduled"}</p>
                      <div className="crm-related-item__meta">
                        <span>{task.priority} priority</span>
                        <span>{task.origin}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="crm-inline-empty">No linked tasks yet.</div>
              )}
            </Card>

            <Card title="Scheduled appointments" subtitle="Upcoming or completed meetings related to this lead.">
              {leadAppointments.length > 0 ? (
                <div className="crm-related-list">
                  {leadAppointments.map((appointment) => (
                    <article className="crm-related-item" key={appointment.id}>
                      <div className="crm-related-item__header">
                        <strong>{appointment.location || "Appointment"}</strong>
                        <Badge tone={getAppointmentTone(appointment.status)}>{appointment.status}</Badge>
                      </div>
                      <p>
                        {formatDateTime(appointment.starts_at)} to {formatDateTime(appointment.ends_at)}
                      </p>
                      <div className="crm-related-item__meta">
                        <span>{appointment.reminder_status}</span>
                        <span>{appointment.notes || "No notes"}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="crm-inline-empty">No appointments linked to this lead yet.</div>
              )}
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
