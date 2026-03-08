"use client";

import { FormEvent, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/data-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, Field } from "@/components/ui/primitives";
import { useAsyncResource } from "@/lib/hooks/use-async-resource";

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

  const visibleAppointments = (appointments.data || []).filter(
    (appointment) => statusFilter === "all" || appointment.status === statusFilter,
  );

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
    await api.updateAppointmentStatus(appointmentId, nextStatus);
    appointments.reload();
  }

  if (appointments.isLoading || leads.isLoading) {
    return <LoadingState title="Loading agenda" copy="Fetching appointment timeline and lead associations." />;
  }

  if (appointments.error || leads.error) {
    return <ErrorState title="Agenda failed to load" copy={appointments.error || leads.error || "Unknown error"} action={{ label: "Retry", onClick: () => window.location.reload() }} />;
  }

  return (
    <div className="page-stack">
      <PageHeader title="Agenda" description="Appointments, follow-up slots and meeting schedule tied to tenant leads." />

      <div className="two-column-grid">
        <Card title="Create appointment" subtitle="Backed by POST /appointments.">
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
            {mutationError ? <div className="banner-error">{mutationError}</div> : null}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create appointment"}
            </Button>
          </form>
        </Card>

        <Card title="Agenda filters" subtitle="Current client-side filter over the appointment list.">
          <Field label="Status">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">all</option>
              <option value="scheduled">scheduled</option>
              <option value="completed">completed</option>
              <option value="cancelled">cancelled</option>
            </select>
          </Field>
        </Card>
      </div>

      {visibleAppointments.length > 0 ? (
        <div className="timeline-list">
          {visibleAppointments.map((appointment) => (
            <article className="timeline-item" key={appointment.id}>
              <div className="topbar-row">
                <div className="inline-stack">
                  <strong>{appointment.location || "Appointment"}</strong>
                  <span className="muted-text">Lead: {appointment.lead_id || "unlinked"}</span>
                </div>
                <div className="action-row">
                  <Badge tone="neutral">{appointment.reminder_status}</Badge>
                  <Badge tone={appointment.status === "completed" ? "cold" : "warning"}>{appointment.status}</Badge>
                  <Button size="small" variant="secondary" onClick={() => void advanceStatus(appointment.id, appointment.status)}>
                    Mark {appointment.status === "completed" ? "scheduled" : "completed"}
                  </Button>
                </div>
              </div>
              <div className="muted-text">
                {appointment.starts_at} {"->"} {appointment.ends_at}
              </div>
              {appointment.notes ? <div className="muted-text">{appointment.notes}</div> : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="No appointments in this view" copy="Create a calendar entry or relax the active filter." />
      )}
    </div>
  );
}
