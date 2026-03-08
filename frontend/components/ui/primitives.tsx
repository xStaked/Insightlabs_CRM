import type { PropsWithChildren } from "react";

export function Badge({
  children,
  tone = "default",
}: PropsWithChildren<{ tone?: "default" | "neutral" | "warning" | "hot" | "warm" | "cold" }>) {
  return <span className={`badge${tone === "default" ? "" : ` badge--${tone}`}`}>{children}</span>;
}

export function Field({
  label,
  children,
}: PropsWithChildren<{ label: string }>) {
  return (
    <label className="field-label">
      <span>{label}</span>
      {children}
    </label>
  );
}
