"use client";

import { useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/data-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/primitives";
import { useAsyncResource } from "@/lib/hooks/use-async-resource";

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
    return <LoadingState title="Loading billing" copy="Fetching plans, checkout surface and subscription status." />;
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
  const upgradeMessage =
    subscription.data?.status === "trialing"
      ? "Tenant is still in trial. Converting to a paid plan will keep protected routes unlocked after trial."
      : subscription.data?.status === "past_due"
        ? "Subscription is past due. Start a fresh checkout to restore a clean payment cycle."
        : activePlan
          ? `Current workspace is operating on ${activePlan.name}. Use another checkout to upgrade or downgrade.`
          : "No active commercial plan resolved yet.";

  return (
    <div className="page-stack">
      <PageHeader title="Billing" description="Current subscription access, commercial plans and checkout actions." />

      <Card title="Current access" subtitle="This determines whether protected business routes stay open.">
        {subscription.data ? (
          <div className="card-grid">
            <div className="surface-card">
              <h3 className="panel-title">Status</h3>
              <div className="action-row" style={{ marginTop: 12 }}>
                <Badge tone={subscription.data.status === "active" ? "cold" : "warning"}>{subscription.data.status}</Badge>
              </div>
            </div>
            <div className="surface-card">
              <h3 className="panel-title">Plan</h3>
              <p className="panel-subtitle">{activePlan ? activePlan.name : subscription.data.plan_id}</p>
            </div>
            <div className="surface-card">
              <h3 className="panel-title">Renews at</h3>
              <p className="panel-subtitle">{subscription.data.renews_at || "No renewal date"}</p>
            </div>
          </div>
        ) : (
          <EmptyState title="No subscription returned" copy="The backend did not return a subscription payload for this tenant." />
        )}
      </Card>

      <Card title="Commercial action" subtitle="Upgrade and downgrade guidance from the current subscription state.">
        <div className="list-stack">
          <div>{upgradeMessage}</div>
          <div className="muted-text">
            A true payment history screen is still pending because the backend does not yet expose payment listing endpoints.
          </div>
        </div>
      </Card>

      {checkoutError ? <div className="banner-error">{checkoutError}</div> : null}

      {plans.data && plans.data.length > 0 ? (
        <div className="card-grid">
          {plans.data.map((plan) => (
            <Card key={plan.id} title={plan.name} subtitle={`${plan.currency} ${plan.price} / ${plan.billing_cycle}`}>
              <div className="list-stack">
                <div className="muted-text">Code: {plan.code}</div>
                <Button
                  onClick={() => void handleCheckout(plan.code)}
                  disabled={activePlanCode === plan.code}
                >
                  {activePlanCode === plan.code ? "Opening checkout..." : "Start checkout"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No plans configured" copy="Plans are expected from /billing/plans but none were returned." />
      )}
    </div>
  );
}
