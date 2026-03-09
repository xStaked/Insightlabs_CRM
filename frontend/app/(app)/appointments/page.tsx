"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/data-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, Field } from "@/components/ui/primitives";
import { useAsyncResource } from "@/lib/hooks/use-async-resource";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getAppointmentStatusTone(status: string): "cold" | "warning" | "hot" {
  if (status === "completed") {
    return "cold";
  }
  if (status === "cancelled") {
    return "hot";
  }
  return "warning";
}

export default function AppointmentsPage() {
  const { api } = useAuth();
  const appointments = useAsyncResource(() => api.listAppointments(), []);
  const leads = useAsyncResource(() => api.listLeads(), []);

  const [leadId, setLeadId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const leadNameById = new Map((leads.data || []).map((lead) => [lead.id, lead.name]));
  const visibleAppointments = [...(appointments.data || [])]
    .filter((appointment) => statusFilter === "all" || appointment.status === statusFilter)
    .sort((left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime());
  const scheduledCount = (appointments.data || []).filter((appointment) => appointment.status === "scheduled").length;
  const completedCount = (appointments.data || []).filter((appointment) => appointment.status === "completed").length;
  const cancelledCount = (appointments.data || []).filter((appointment) => appointment.status === "cancelled").length;
  const upcomingCount = (appointments.data || []).filter(
    (appointment) => appointment.status === "scheduled" && new Date(appointment.starts_at).getTime() >= Date.now(),
  ).length;

  async function handleCreateAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMutationError(null);
    setIsSubmitting(true);
    try {
      await api.createAppointment({
        lead_id: leadId || null,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        location: location || null,
        notes: notes || null,
      });
      setLeadId("");
      setStartsAt("");
      setEndsAt("");
      setLocation("");
      setNotes("");
      appointments.reload();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Unable to create appointment");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function advanceStatus(appointmentId: string, currentStatus: string) {
    const nextStatus = currentStatus === "scheduled" ? "completed" : "scheduled";
    setMutationError(null);
    try {
      await api.updateAppointmentStatus(appointmentId, nextStatus);
      appointments.reload();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Unable to update appointment status");
    }
  }

  if (appointments.isLoading || leads.isLoading) {
    return <LoadingState title="Loading agenda" copy="Fetching appointment timeline and lead associations." />;
  }

  if (appointments.error || leads.error) {
    return <ErrorState title="Agenda failed to load" copy={appointments.error || leads.error || "Unknown error"} action={{ label: "Retry", onClick: () => window.location.reload() }} />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Appointments"
        description="Keep meetings, visits, and scheduled follow-ups visible in one operational schedule."
        actions={
          <div className="pill-row">
            <Badge tone="neutral">{visibleAppointments.length} in view</Badge>
            <Badge tone="warning">{scheduledCount} scheduled</Badge>
          </div>
        }
      />

      <section className="ops-summary-grid" aria-label="Appointment overview">
        <article className="ops-metric-card">
          <span className="ops-metric-card__label">Upcoming</span>
          <strong className="ops-metric-card__value">{upcomingCount}</strong>
          <span className="muted-text">Scheduled appointments still ahead on the calendar.</span>
        </article>
        <article className="ops-metric-card">
          <span className="ops-metric-card__label">Scheduled</span>
          <strong className="ops-metric-card__value">{scheduledCount}</strong>
          <span className="muted-text">Current appointments that still need execution or confirmation.</span>
        </article>
        <article className="ops-metric-card">
          <span className="ops-metric-card__label">Completed</span>
          <strong className="ops-metric-card__value">{completedCount}</strong>
          <span className="muted-text">Meetings already completed and retained as part of the record.</span>
        </article>
        <article className="ops-metric-card">
          <span className="ops-metric-card__label">Cancelled</span>
          <strong className="ops-metric-card__value">{cancelledCount}</strong>
          <span className="muted-text">Appointments that need rescheduling or follow-up recovery.</span>
        </article>
      </section>

      {mutationError ? <div className="banner-error">{mutationError}</div> : null}

      <section className="ops-main-grid">
        <div className="page-stack">
          <Card title="Schedule" subtitle="Use the appointment list as the operating view for upcoming meetings and completed visits.">
            <div className="ops-toolbar">
              <div className="ops-toolbar__search">
                <Field label="Status filter">
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="all">All statuses</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </Field>
              </div>
            </div>

            {visibleAppointments.length > 0 ? (
              <div className="table-wrap ops-table-wrap">
                <table className="table ops-table">
                  <thead>
                    <tr>
                      <th>Appointment</th>
                      <th>Lead</th>
                      <th>Start</th>
                      <th>End</th>
                      <th>Status</th>
                      <th>Reminder</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAppointments.map((appointment) => {
                      const linkedLeadName = appointment.lead_id ? leadNameById.get(appointment.lead_id) || appointment.lead_id : null;
                      return (
                        <tr key={appointment.id}>
                          <td>
                            <div className="inline-stack">
                              <strong>{appointment.location || "Scheduled appointment"}</strong>
                              <span className="muted-text">{appointment.notes || "No internal notes added."}</span>
                            </div>
                          </td>
                          <td>
                            {appointment.lead_id ? (
                              <Link className="ops-inline-link" href={`/leads/${appointment.lead_id}`}>
                                {linkedLeadName}
                              </Link>
                            ) : (
                              <span className="muted-text">Standalone</span>
                            )}
                          </td>
                          <td>{formatDateTime(appointment.starts_at)}</td>
                          <td>{formatDateTime(appointment.ends_at)}</td>
                          <td>
                            <Badge tone={getAppointmentStatusTone(appointment.status)}>{appointment.status}</Badge>
                          </td>
                          <td>
                            <Badge tone="neutral">{appointment.reminder_status}</Badge>
                          </td>
                          <td>
                            {appointment.status === "cancelled" ? (
                              <span className="muted-text">Cancelled</span>
                            ) : (
                              <Button size="small" variant="secondary" onClick={() => void advanceStatus(appointment.id, appointment.status)}>
                                Mark {appointment.status === "completed" ? "scheduled" : "completed"}
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No appointments in this view" copy="Create a calendar entry or relax the active filter." />
            )}
          </Card>
        </div>

        <div className="ops-sidebar-stack">
          <Card title="Create appointment" subtitle="Schedule a meeting, site visit, or follow-up slot directly from the agenda.">
            <form className="inline-stack" onSubmit={handleCreateAppointment}>
              <Field label="Lead">
                <select value={leadId} onChange={(event) => setLeadId(event.target.value)}>
                  <option value="">No linked lead</option>
                  {(leads.data || []).map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="form-grid">
                <Field label="Starts at">
                  <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required />
                </Field>
                <Field label="Ends at">
                  <input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} required />
                </Field>
              </div>
              <Field label="Location">
                <input value={location} onChange={(event) => setLocation(event.target.value)} />
              </Field>
              <Field label="Notes">
                <textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
              </Field>
              <div className="action-row">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create appointment"}
                </Button>
              </div>
            </form>
          </Card>

          <Card title="Scheduling notes" subtitle="Keep the calendar clean and operational for reps, advisors, and coordinators.">
            <div className="ops-note-list">
              <div>
                <strong>Location matters.</strong>
                <span className="muted-text">Use the location field to distinguish calls, visits, and in-person meetings at a glance.</span>
              </div>
              <div>
                <strong>Close the loop.</strong>
                <span className="muted-text">Mark completed meetings quickly so the remaining schedule reflects actual pending work.</span>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
