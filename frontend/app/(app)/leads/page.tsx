"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/data-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, Field } from "@/components/ui/primitives";
import { useAsyncResource } from "@/lib/hooks/use-async-resource";
import type { Lead } from "@/types/api";

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

function getChannelLabel(channel: string) {
  if (channel === "whatsapp") {
    return "WhatsApp";
  }

  if (channel === "instagram") {
    return "Instagram";
  }

  if (channel === "web") {
    return "Website";
  }

  return "Manual";
}

export default function LeadsPage() {
  const { api } = useAuth();
  const leads = useAsyncResource(() => api.listLeads(), []);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [sourceChannel, setSourceChannel] = useState("manual");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [temperatureFilter, setTemperatureFilter] = useState("all");
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sortedLeads = useMemo(
    () => [...(leads.data || [])].sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at)),
    [leads.data],
  );

  const filteredLeads = sortedLeads.filter((lead) => {
    const haystack = `${lead.name} ${lead.email || ""} ${lead.phone || ""} ${lead.source_channel}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query.toLowerCase());
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
    const matchesTemperature = temperatureFilter === "all" || lead.temperature === temperatureFilter;
    return matchesQuery && matchesStatus && matchesTemperature;
  });

  const summary = {
    total: leads.data?.length || 0,
    hot: (leads.data || []).filter((lead) => lead.temperature === "hot").length,
    open: (leads.data || []).filter((lead) => lead.status === "new").length,
    unassigned: (leads.data || []).filter((lead) => !lead.current_stage_id).length,
  };

  async function handleCreateLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMutationError(null);

    try {
      await api.createLead({
        name,
        phone: phone || undefined,
        email: email || undefined,
        source_channel: sourceChannel,
      });
      setName("");
      setPhone("");
      setEmail("");
      setSourceChannel("manual");
      leads.reload();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Unable to create lead");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (leads.isLoading) {
    return <LoadingState title="Loading leads" copy="Pulling CRM records for the active workspace." />;
  }

  if (leads.error) {
    return <ErrorState title="Leads failed to load" copy={leads.error} action={{ label: "Retry", onClick: leads.reload }} />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Leads"
        description="Track new demand, qualification status and owner follow-up from one operating view."
      />

      <section className="crm-workspace crm-workspace--stack">
        <div className="crm-summary-grid">
          <article className="crm-summary-card">
            <span className="crm-summary-card__label">Reachable records</span>
            <strong className="crm-summary-card__value">{summary.total}</strong>
            <span className="crm-summary-card__meta">All leads currently exposed by the CRM list endpoint.</span>
          </article>
          <article className="crm-summary-card">
            <span className="crm-summary-card__label">Needs attention</span>
            <strong className="crm-summary-card__value">{summary.hot}</strong>
            <span className="crm-summary-card__meta">High-intent leads with the hottest score profile.</span>
          </article>
          <article className="crm-summary-card">
            <span className="crm-summary-card__label">Open intake</span>
            <strong className="crm-summary-card__value">{summary.open}</strong>
            <span className="crm-summary-card__meta">Leads still sitting in the initial status bucket.</span>
          </article>
          <article className="crm-summary-card">
            <span className="crm-summary-card__label">Stage not set</span>
            <strong className="crm-summary-card__value">{summary.unassigned}</strong>
            <span className="crm-summary-card__meta">Records that still need routing into a pipeline stage.</span>
          </article>
        </div>

        <div className="crm-leads-layout">
          <Card
            title="Lead queue"
            subtitle="Most recently updated records first so the team can scan what changed without leaving the page."
            actions={
              <div className="crm-results-meta">
                <strong>{filteredLeads.length}</strong>
                <span>in view</span>
              </div>
            }
          >
            <div className="crm-filter-grid">
              <Field label="Search">
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, email, phone or source" />
              </Field>
              <Field label="Status">
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="new">New</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                </select>
              </Field>
              <Field label="Temperature">
                <select value={temperatureFilter} onChange={(event) => setTemperatureFilter(event.target.value)}>
                  <option value="all">All temperatures</option>
                  <option value="cold">Cold</option>
                  <option value="warm">Warm</option>
                  <option value="hot">Hot</option>
                </select>
              </Field>
            </div>

            {filteredLeads.length > 0 ? (
              <div className="table-wrap crm-table-wrap">
                <table className="table crm-leads-table">
                  <thead>
                    <tr>
                      <th>Lead</th>
                      <th>Contact</th>
                      <th>Source</th>
                      <th>Score</th>
                      <th>Stage</th>
                      <th>Updated</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id}>
                        <td>
                          <div className="crm-lead-cell">
                            <div className="crm-avatar">{getInitials(lead.name)}</div>
                            <div className="crm-lead-cell__body">
                              <div className="crm-lead-cell__title-row">
                                <Link href={`/leads/${lead.id}`} className="crm-record-link">
                                  {lead.name}
                                </Link>
                                <Badge tone={getStatusTone(lead.status)}>{lead.status}</Badge>
                                <Badge tone={getTemperatureTone(lead.temperature)}>{lead.temperature}</Badge>
                              </div>
                              <div className="crm-lead-cell__meta">
                                <span>ID {lead.id.slice(0, 8)}</span>
                                <span>Created {formatDate(lead.created_at)}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="crm-cell-stack">
                            <span>{lead.email || "No email on file"}</span>
                            <span className="muted-text">{lead.phone || "No phone on file"}</span>
                          </div>
                        </td>
                        <td>{getChannelLabel(lead.source_channel)}</td>
                        <td>
                          <div className="crm-cell-stack">
                            <strong>{lead.score_total}</strong>
                            <span className="muted-text">Intent score</span>
                          </div>
                        </td>
                        <td>{lead.current_stage_id || "Needs stage assignment"}</td>
                        <td>{formatDate(lead.updated_at)}</td>
                        <td>
                          <Link href={`/leads/${lead.id}`} className="crm-open-link">
                            Open record
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No leads match the current view"
                copy="Clear one of the filters or add a new lead to bring records back into the queue."
              />
            )}
          </Card>

          <div className="crm-sidebar-stack">
            <Card
              title="New lead intake"
              subtitle="Keep capture lightweight so the list remains the primary place to work the pipeline."
            >
              <form className="inline-stack" id="lead-intake-form" onSubmit={handleCreateLead}>
                <Field label="Full name">
                  <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Camila Rojas" required />
                </Field>
                <div className="form-grid">
                  <Field label="Phone">
                    <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+57 300 000 0000" />
                  </Field>
                  <Field label="Email">
                    <input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="camila@company.com"
                      type="email"
                    />
                  </Field>
                </div>
                <Field label="Source channel">
                  <select value={sourceChannel} onChange={(event) => setSourceChannel(event.target.value)}>
                    <option value="manual">Manual entry</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="instagram">Instagram</option>
                    <option value="web">Website</option>
                  </select>
                </Field>
                {mutationError ? <div className="banner-error">{mutationError}</div> : null}
                <div className="action-row">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Saving lead..." : "Create lead"}
                  </Button>
                </div>
              </form>
            </Card>

            <Card title="Qualification cues" subtitle="The current payload already supports a tighter operating rhythm.">
              <div className="crm-guidance-list">
                <div className="crm-guidance-item">
                  <strong>Prioritize hot leads first</strong>
                  <span>Temperature and score are visible in the queue, so triage can happen before opening the record.</span>
                </div>
                <div className="crm-guidance-item">
                  <strong>Route unassigned records quickly</strong>
                  <span>Missing stage assignment is surfaced directly in the table to reduce hidden backlog.</span>
                </div>
                <div className="crm-guidance-item">
                  <strong>Use the detail page for follow-through</strong>
                  <span>Tasks and appointments linked by lead ID are consolidated on the record page.</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
