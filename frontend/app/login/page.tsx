"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/data-state";
import { Field } from "@/components/ui/primitives";
import { consumeAuthNotice } from "@/lib/auth/session";
import { useAsyncResource } from "@/lib/hooks/use-async-resource";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, publicApi, ready, session, error } = useAuth();

  const companies = useAsyncResource(() => publicApi.listCompanies(), [], ready);
  const [tenantId, setTenantId] = useState("");
  const [email, setEmail] = useState("admin@insightlabscrm.com");
  const [password, setPassword] = useState("admin123");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [companySuccess, setCompanySuccess] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [industry, setIndustry] = useState("");
  const [timezone, setTimezone] = useState("UTC");

  useEffect(() => {
    if (session) {
      router.replace(searchParams.get("next") || "/dashboard");
    }
  }, [router, searchParams, session]);

  useEffect(() => {
    if (companies.data && companies.data.length > 0 && !tenantId) {
      setTenantId(companies.data[0].id);
    }
  }, [companies.data, tenantId]);

  useEffect(() => {
    const queryTenant = searchParams.get("tenant");
    if (queryTenant) {
      setTenantId(queryTenant);
    }

    const notice = consumeAuthNotice();
    if (!notice) {
      return;
    }

    const messageMap: Record<string, string> = {
      session_expired: "Your session expired. Sign in again to continue.",
      tenant_mismatch: "The token did not match the selected tenant. Pick the correct workspace and sign in again.",
      signed_out: "You signed out of the current workspace.",
      switch_workspace: "Choose the target workspace and sign in with the corresponding tenant context.",
    };
    setAuthNotice(messageMap[notice] || notice);
  }, [searchParams]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    try {
      await login({ email, password, tenantId });
      router.replace(searchParams.get("next") || "/dashboard");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to sign in");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCompanyCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setCompanySuccess(null);
    setIsSubmitting(true);
    try {
      const company = await publicApi.createCompany({
        name: companyName,
        slug: companySlug,
        timezone,
        industry: industry || undefined,
      });
      setCompanySuccess(`Workspace created. Use tenant ${company.id} with admin@insightlabscrm.com / admin123.`);
      setTenantId(company.id);
      setCompanyName("");
      setCompanySlug("");
      setIndustry("");
      companies.reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to create workspace");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!ready) {
    return <LoadingState title="Loading access layer" copy="Preparing login, session storage and tenant context." />;
  }

  return (
    <main className="auth-layout">
      <div className="auth-grid">
        <section className="hero-panel surface-card">
          <div className="eyebrow">Pipeline command center</div>
          <h1 className="hero-title">Operate leads, billing and automations from one shell.</h1>
          <p className="hero-copy">
            This frontend is aligned to the current API surface. Auth, CRM core and billing are connected to real
            endpoints. Automations and reports are staged with explicit empty states where backend contracts are still
            pending.
          </p>
        </section>

        <div className="inline-stack">
          <Card title="Sign in" subtitle="Use the seeded admin user for the selected tenant.">
            <form className="inline-stack" onSubmit={handleLogin}>
              <Field label="Tenant">
                <select value={tenantId} onChange={(event) => setTenantId(event.target.value)} required>
                  <option value="">Select workspace</option>
                  {(companies.data || []).map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name} - {company.id}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Email">
                <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
              </Field>
              <Field label="Password">
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </Field>
              <div className="action-row">
                <Button type="submit" disabled={isSubmitting || !tenantId}>
                  {isSubmitting ? "Signing in..." : "Enter workspace"}
                </Button>
              </div>
            </form>
          </Card>

          <Card title="Create workspace" subtitle="Provision a tenant first if you do not have one yet.">
            <form className="inline-stack" onSubmit={handleCompanyCreate}>
              <Field label="Company name">
                <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} required />
              </Field>
              <Field label="Slug">
                <input value={companySlug} onChange={(event) => setCompanySlug(event.target.value)} required />
              </Field>
              <div className="form-grid">
                <Field label="Timezone">
                  <input value={timezone} onChange={(event) => setTimezone(event.target.value)} />
                </Field>
                <Field label="Industry">
                  <input value={industry} onChange={(event) => setIndustry(event.target.value)} />
                </Field>
              </div>
              <div className="action-row">
                <Button type="submit" variant="secondary" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create company"}
                </Button>
              </div>
            </form>
          </Card>

          {companies.isLoading ? (
            <LoadingState title="Loading tenants" copy="Fetching available workspaces for sign in." />
          ) : null}

          {companies.error ? (
            <ErrorState title="Unable to load companies" copy={companies.error} action={{ label: "Retry", onClick: companies.reload }} />
          ) : null}

          {!companies.isLoading && !companies.error && (companies.data || []).length === 0 ? (
            <EmptyState
              title="No companies yet"
              copy="Create the first workspace to get a tenant id and unlock login."
            />
          ) : null}

          {authNotice ? <div className="banner-success">{authNotice}</div> : null}
          {formError || error ? <div className="banner-error">{formError || error}</div> : null}
          {companySuccess ? <div className="banner-success">{companySuccess}</div> : null}
        </div>
      </div>
    </main>
  );
}
