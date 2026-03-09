"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
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

  const workspaceCount = companies.data?.length || 0;
  const selectedWorkspace = companies.data?.find((company) => company.id === tenantId);
  const workspaceCreated = Boolean(companySuccess);

  return (
    <main className="auth-layout">
      <div className="auth-grid">
        <section className="hero-panel surface-card">
          <div className="eyebrow">Workspace access</div>
          <h1 className="hero-title">Sign in to the team workspace that runs your pipeline.</h1>
          <p className="hero-copy">
            Keep sales, conversations, and billing in one place. Choose the workspace you manage, confirm the tenant
            context, and continue where the team left off.
          </p>

          <div className="card-grid" style={{ marginTop: 24 }}>
            <article className="surface-card" style={{ minHeight: "unset", padding: 18 }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>What you can do here</div>
              <div className="list-stack">
                <div>Review leads, inbox activity, and operational queues from one authenticated shell.</div>
                <div>Switch between tenant workspaces without leaving the product context behind.</div>
                <div>Provision a new workspace when onboarding a fresh team or business unit.</div>
              </div>
            </article>

            <article className="surface-card" style={{ minHeight: "unset", padding: 18 }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Access defaults</div>
              <div className="list-stack">
                <div>Seeded admin email: <strong>admin@insightlabscrm.com</strong></div>
                <div>Seeded password: <strong>admin123</strong></div>
                <div>{workspaceCount} workspace{workspaceCount === 1 ? "" : "s"} currently available for sign-in.</div>
              </div>
            </article>
          </div>
        </section>

        <div className="inline-stack">
          <Card
            title="Sign in"
            subtitle={
              selectedWorkspace
                ? `Entering ${selectedWorkspace.name}. Authentication stays scoped to this workspace.`
                : "Select the workspace first, then continue with your account credentials."
            }
          >
            <form className="inline-stack" onSubmit={handleLogin}>
              <Field label="Workspace">
                <select value={tenantId} onChange={(event) => setTenantId(event.target.value)} required>
                  <option value="">Select workspace</option>
                  {(companies.data || []).map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name} - {company.slug}
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
                  {isSubmitting ? "Signing in..." : "Open workspace"}
                </Button>
                <Link href="/" className="muted-text" style={{ alignSelf: "center" }}>
                  Back to overview
                </Link>
              </div>
            </form>
          </Card>

          <Card
            title="Create workspace"
            subtitle={
              workspaceCreated
                ? "The new workspace is ready. You can sign in with the seeded admin account right away."
                : "Use this when onboarding a new client, team, or region into its own tenant."
            }
          >
            <form className="inline-stack" onSubmit={handleCompanyCreate}>
              <Field label="Workspace name">
                <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} required />
              </Field>
              <Field label="Workspace slug">
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
                  {isSubmitting ? "Creating..." : "Create workspace"}
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
              title="No workspaces yet"
              copy="Create the first workspace to provision tenant access and unlock sign-in."
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
