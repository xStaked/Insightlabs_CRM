"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="auth-layout">
      <section className="state-card state-card--error">
        <h1 className="state-card__title">The frontend crashed before rendering cleanly</h1>
        <div className="state-card__copy">{error.message}</div>
        <div className="action-row">
          <Button onClick={reset}>Retry render</Button>
        </div>
      </section>
    </main>
  );
}
