import React from "react";

import { Button } from "@/components/ui/button";

export function LoadingState({ title, copy }: { title: string; copy: string }) {
  return (
    <section className="state-card" aria-busy="true">
      <div className="skeleton" style={{ width: 160, height: 14 }} />
      <div className="skeleton" style={{ width: "100%", height: 18 }} />
      <div className="skeleton" style={{ width: "72%", height: 18 }} />
      <h2 className="state-card__title">{title}</h2>
      <div className="state-card__copy">{copy}</div>
    </section>
  );
}

export function ErrorState({
  title,
  copy,
  action,
}: {
  title: string;
  copy: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <section className="state-card state-card--error">
      <h2 className="state-card__title">{title}</h2>
      <div className="state-card__copy">{copy}</div>
      {action ? (
        <div>
          <Button variant="danger" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

export function EmptyState({
  title,
  copy,
  action,
}: {
  title: string;
  copy: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <section className="state-card">
      <h2 className="state-card__title">{title}</h2>
      <div className="state-card__copy">{copy}</div>
      {action ? (
        <div>
          <Button variant="secondary" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
