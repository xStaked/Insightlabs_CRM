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
  const filteredLeads = (leads.data || []).filter((lead) => {
    const haystack = `${lead.name} ${lead.email || ""} ${lead.phone || ""}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query.toLowerCase());
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
    const matchesTemperature = temperatureFilter === "all" || lead.temperature === temperatureFilter;
    return matchesQuery && matchesStatus && matchesTemperature;
  });

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
      leads.reload();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Unable to create lead");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (leads.isLoading) {
    return <LoadingState title="Loading leads" copy="Pulling CRM records for the active tenant." />;
  }

  if (leads.error) {
    return <ErrorState title="Leads failed to load" copy={leads.error} action={{ label: "Retry", onClick: leads.reload }} />;
  }

  return (
    <div className="page-stack">
      <PageHeader title="Leads" description="Operational list plus a fast capture form for new inbound or manual leads." />

      <div className="two-column-grid">
        <Card title="Create lead" subtitle="Writes directly to POST /leads.">
          <form className="inline-stack" onSubmit={handleCreateLead}>
            <Field label="Name">
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </Field>
            <div className="form-grid">
              <Field label="Phone">
                <input value={phone} onChange={(event) => setPhone(event.target.value)} />
              </Field>
              <Field label="Email">
                <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
              </Field>
            </div>
            <Field label="Source channel">
              <select value={sourceChannel} onChange={(event) => setSourceChannel(event.target.value)}>
                <option value="manual">manual</option>
                <option value="whatsapp">whatsapp</option>
                <option value="instagram">instagram</option>
                <option value="web">web</option>
              </select>
            </Field>
            {mutationError ? <div className="banner-error">{mutationError}</div> : null}
            <div className="action-row">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create lead"}
              </Button>
            </div>
          </form>
        </Card>

        <Card title="Lead intake notes" subtitle="Current frontend scope for this module.">
          <div className="list-stack">
            <div>The list view is live against the backend.</div>
            <div>A read-only detail route is available now, assembled from current list endpoints.</div>
            <div>Temperature comes from backend scoring and is already exposed in list rows.</div>
          </div>
        </Card>
      </div>

      <Card title="Search and filters" subtitle="Client-side over the current lead list payload.">
        <div className="form-grid">
          <Field label="Search">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, email or phone" />
          </Field>
          <Field label="Status">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">all</option>
              <option value="new">new</option>
              <option value="won">won</option>
              <option value="lost">lost</option>
            </select>
          </Field>
          <Field label="Temperature">
            <select value={temperatureFilter} onChange={(event) => setTemperatureFilter(event.target.value)}>
              <option value="all">all</option>
              <option value="cold">cold</option>
              <option value="warm">warm</option>
              <option value="hot">hot</option>
            </select>
          </Field>
        </div>
      </Card>

      {filteredLeads.length > 0 ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Channel</th>
                <th>Contact</th>
                <th>Score</th>
                <th>Temperature</th>
                <th>Stage</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <div className="inline-stack">
                      <strong>{lead.name}</strong>
                      <span className="muted-text">{lead.status}</span>
                    </div>
                  </td>
                  <td>{lead.source_channel}</td>
                  <td>
                    <div className="inline-stack">
                      <span>{lead.email || "-"}</span>
                      <span className="muted-text">{lead.phone || "-"}</span>
                    </div>
                  </td>
                  <td>{lead.score_total}</td>
                  <td>
                    <Badge tone={lead.temperature === "hot" ? "hot" : lead.temperature === "warm" ? "warm" : "cold"}>
                      {lead.temperature}
                    </Badge>
                  </td>
                  <td>{lead.current_stage_id || "Unassigned"}</td>
                  <td>
                    <Link href={`/leads/${lead.id}`}>
                      <Button size="small" variant="secondary">
                        Open
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No leads match the current view" copy="Create the first lead or relax the current search and filter combination." />
      )}
    </div>
  );
}
