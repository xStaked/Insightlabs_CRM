"use client";

import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/data-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/primitives";
import type { Plan, Subscription } from "@/types/api";
import { useAsyncResource } from "@/lib/hooks/use-async-resource";

const pageTheme = {
  "--text": "#10233f",
  "--text-muted": "#5f7188",
  "--border": "#d8e1ea",
} as CSSProperties;

const shellStyle: CSSProperties = {
  display: "grid",
  gap: 24,
  padding: "24px",
  borderRadius: 28,
  border: "1px solid #d8e1ea",
  background: "linear-gradient(180deg, #f8fbff 0%, #f3f6fb 100%)",
  boxShadow: "0 18px 44px rgba(15, 23, 42, 0.12)",
};

const sectionGridStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const cardStyle: CSSProperties = {
  display: "grid",
  gap: 14,
  padding: "20px",
  borderRadius: 20,
  border: "1px solid #d8e1ea",
  background: "#ffffff",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.06)",
};

const labelStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.78rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#71839a",
};

const valueStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.8rem",
  fontWeight: 700,
  letterSpacing: "-0.04em",
  color: "#10233f",
};

const subValueStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.95rem",
  lineHeight: 1.6,
  color: "#5f7188",
};

const sectionStyle: CSSProperties = {
  ...cardStyle,
  gap: 18,
};

const splitSectionStyle: CSSProperties = {
  display: "grid",
  gap: 18,
  gridTemplateColumns: "minmax(0, 1.25fr) minmax(280px, 0.75fr)",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "14px 0",
  borderBottom: "1px solid #e7edf3",
};

const buttonStyle: CSSProperties = {
  minHeight: 44,
  padding: "0 16px",
  borderRadius: 12,
  border: "1px solid #cfd8e3",
  background: "#ffffff",
  color: "#10233f",
  fontWeight: 600,
  transition: "background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease",
};

const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  borderColor: "#1d4ed8",
  background: "#1d4ed8",
  color: "#ffffff",
  boxShadow: "0 10px 24px rgba(29, 78, 216, 0.18)",
};

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatMoney(plan: Plan) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: plan.currency, maximumFractionDigits: 0 }).format(
      plan.price,
    );
  } catch {
    return `${plan.currency} ${plan.price}`;
  }
}

function statusTone(status: string): "cold" | "warning" | "hot" | "neutral" {
  if (status === "active") return "cold";
  if (status === "trialing") return "warning";
  if (status === "past_due") return "hot";
  return "neutral";
}

function statusCopy(status: string | undefined, activePlan: Plan | undefined, subscription: Subscription | null | undefined) {
  if (!status || !subscription) {
    return {
      title: "No active contract",
      summary: "No subscription payload is currently attached to this workspace.",
      nextStep: "Review plan configuration and start a checkout when commercial access should be enabled.",
    };
  }

  if (status === "trialing") {
    return {
      title: "Trial workspace",
      summary: `The workspace is evaluating ${activePlan?.name || subscription.plan_id} before commercial billing starts.`,
      nextStep: "Schedule conversion before the trial ends to avoid disruption for the sales team.",
    };
  }

  if (status === "past_due") {
    return {
      title: "Payment attention required",
      summary: `The ${activePlan?.name || subscription.plan_id} plan is overdue and could restrict protected routes.`,
      nextStep: "Launch a fresh checkout to restore a clean billing cycle and confirm renewal dates.",
    };
  }

  if (status === "active") {
    return {
      title: "Billing is in good standing",
      summary: `The workspace is operating on ${activePlan?.name || subscription.plan_id} with an active subscription.`,
      nextStep: "Use plan comparison below when the team needs more seats or a different billing cadence.",
    };
  }

  return {
    title: "Subscription status received",
    summary: `The backend returned a ${status} subscription state for ${activePlan?.name || subscription.plan_id}.`,
    nextStep: "Confirm whether the current state matches the workspace's commercial agreement.",
  };
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={rowStyle}>
      <div>
        <p style={labelStyle}>{label}</p>
      </div>
      <div style={{ textAlign: "right", color: "#10233f", fontWeight: 600 }}>{value}</div>
    </div>
  );
}

export default function BillingPage() {
  const { api } = useAuth();
  const plans = useAsyncResource(() => api.listPlans(), []);
  const subscription = useAsyncResource(() => api.getSubscriptionStatus(), []);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [activePlanCode, setActivePlanCode] = useState<string | null>(null);

  async function handleCheckout(planCode: string) {
    setCheckoutError(null);
    setActivePlanCode(planCode);
    try {
      const checkout = await api.createCheckout({ plan_code: planCode });
      window.open(checkout.checkout_url, "_blank", "noopener,noreferrer");
      subscription.reload();
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setActivePlanCode(null);
    }
  }

  if (plans.isLoading || subscription.isLoading) {
    return <LoadingState title="Loading billing" copy="Preparing subscription health, plan options, and checkout actions." />;
  }

  if (plans.error || subscription.error) {
    return (
      <ErrorState
        title="Billing failed to load"
        copy={plans.error || subscription.error || "Unknown error"}
        action={{
          label: "Retry",
          onClick: () => {
            plans.reload();
            subscription.reload();
          },
        }}
      />
    );
  }

  const activePlan = plans.data?.find((plan) => plan.id === subscription.data?.plan_id);
  const statusSummary = statusCopy(subscription.data?.status, activePlan, subscription.data);

  return (
    <div className="page-stack" style={pageTheme}>
      <div style={shellStyle}>
        <PageHeader
          eyebrow="Revenue Operations"
          title="Billing"
          description="Monitor workspace commercial status, compare plan coverage, and launch checkout without exposing raw payment plumbing."
          meta={
            subscription.data ? (
              <Badge tone={statusTone(subscription.data.status)}>{subscription.data.status.replace("_", " ")}</Badge>
            ) : undefined
          }
        />

        {subscription.data ? (
          <div style={sectionGridStyle}>
            <div style={cardStyle}>
              <p style={labelStyle}>Plan in service</p>
              <p style={valueStyle}>{activePlan?.name || subscription.data.plan_id}</p>
              <p style={subValueStyle}>The plan currently controlling protected billing-aware routes for this workspace.</p>
            </div>
            <div style={cardStyle}>
              <p style={labelStyle}>Next renewal</p>
              <p style={valueStyle}>{formatDate(subscription.data.renews_at)}</p>
              <p style={subValueStyle}>Use this date to coordinate finance approvals before the next billing event.</p>
            </div>
            <div style={cardStyle}>
              <p style={labelStyle}>Grace coverage</p>
              <p style={valueStyle}>{formatDate(subscription.data.grace_until)}</p>
              <p style={subValueStyle}>Fallback time available if the provider reports a delayed or failed collection cycle.</p>
            </div>
          </div>
        ) : (
          <EmptyState title="No subscription returned" copy="The backend did not return a subscription payload for this workspace." />
        )}

        <div style={splitSectionStyle}>
          <section style={sectionStyle}>
            <div className="list-stack">
              <div>
                <p style={labelStyle}>Commercial posture</p>
                <h2 style={{ margin: "8px 0 0", fontSize: "1.45rem", letterSpacing: "-0.04em", color: "#10233f" }}>
                  {statusSummary.title}
                </h2>
              </div>
              <p style={{ margin: 0, color: "#40546d", lineHeight: 1.7 }}>{statusSummary.summary}</p>
              <div
                style={{
                  padding: 16,
                  borderRadius: 16,
                  background: "#f5f8fc",
                  border: "1px solid #e1e8f0",
                  color: "#40546d",
                  lineHeight: 1.7,
                }}
              >
                {statusSummary.nextStep}
              </div>
              {checkoutError ? (
                <div
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    border: "1px solid #f0c3be",
                    background: "#fff5f3",
                    color: "#9f2d20",
                  }}
                >
                  {checkoutError}
                </div>
              ) : null}
            </div>
          </section>

          <section style={sectionStyle}>
            <div>
              <p style={labelStyle}>Subscription record</p>
              <h2 style={{ margin: "8px 0 0", fontSize: "1.25rem", letterSpacing: "-0.04em", color: "#10233f" }}>
                Workspace lifecycle details
              </h2>
            </div>
            {subscription.data ? (
              <div>
                <DetailRow label="Subscription ID" value={subscription.data.id} />
                <DetailRow label="Starts on" value={formatDate(subscription.data.starts_at)} />
                <DetailRow label="Renews on" value={formatDate(subscription.data.renews_at)} />
                <DetailRow label="Grace until" value={formatDate(subscription.data.grace_until)} />
              </div>
            ) : (
              <EmptyState title="No lifecycle data" copy="Subscription metadata is required to render the workspace contract summary." />
            )}
          </section>
        </div>

        {plans.data && plans.data.length > 0 ? (
          <section style={sectionStyle}>
            <div className="topbar-row">
              <div className="list-stack" style={{ gap: 6 }}>
                <p style={labelStyle}>Plans</p>
                <h2 style={{ margin: 0, fontSize: "1.3rem", letterSpacing: "-0.04em", color: "#10233f" }}>
                  Compare commercial options
                </h2>
              </div>
              <p style={{ margin: 0, maxWidth: 420, color: "#5f7188", lineHeight: 1.6 }}>
                Payment history is not yet exposed by the backend, so this page focuses on status control and the next checkout action.
              </p>
            </div>

            <div style={sectionGridStyle}>
              {plans.data.map((plan) => {
                const isActive = subscription.data?.plan_id === plan.id;
                const isBusy = activePlanCode === plan.code;
                return (
                  <article
                    key={plan.id}
                    style={{
                      ...cardStyle,
                      gap: 16,
                      borderColor: isActive ? "#93c5fd" : "#d8e1ea",
                      boxShadow: isActive ? "0 16px 34px rgba(37, 99, 235, 0.12)" : cardStyle.boxShadow,
                    }}
                  >
                    <div className="topbar-row">
                      <div className="list-stack" style={{ gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <h3 style={{ margin: 0, fontSize: "1.15rem", color: "#10233f" }}>{plan.name}</h3>
                          {isActive ? <Badge tone="cold">Current plan</Badge> : null}
                        </div>
                        <p style={{ margin: 0, color: "#5f7188" }}>Code: {plan.code}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ margin: 0, fontSize: "1.6rem", fontWeight: 700, color: "#10233f" }}>{formatMoney(plan)}</p>
                        <p style={{ margin: "4px 0 0", color: "#5f7188" }}>per {plan.billing_cycle}</p>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: 10,
                        padding: 16,
                        borderRadius: 16,
                        background: "#f7f9fc",
                        border: "1px solid #e6ecf2",
                      }}
                    >
                      <p style={{ margin: 0, color: "#40546d", lineHeight: 1.65 }}>
                        Best for teams that need a clear contract record and a direct path into checkout without contacting support.
                      </p>
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ color: "#10233f", fontWeight: 600 }}>Includes:</div>
                        <div style={{ color: "#5f7188", lineHeight: 1.6 }}>Protected route access, subscription state handling, and provider checkout activation.</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleCheckout(plan.code)}
                      disabled={isBusy}
                      style={isActive ? buttonStyle : primaryButtonStyle}
                    >
                      {isBusy ? "Opening checkout..." : isActive ? "Refresh current checkout" : "Launch checkout"}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        ) : (
          <EmptyState title="No plans configured" copy="Plans are expected from `/billing/plans` but none were returned." />
        )}
      </div>
    </div>
  );
}
