import type { PropsWithChildren, ReactNode } from "react";

export function Card({
  title,
  subtitle,
  children,
  actions,
}: PropsWithChildren<{ title?: string; subtitle?: string; actions?: ReactNode }>) {
  return (
    <section className="surface-card">
      {(title || subtitle || actions) && (
        <div className="card-header">
          <div className="card-header__body">
            {title ? <h3 className="panel-title">{title}</h3> : null}
            {subtitle ? <p className="panel-subtitle">{subtitle}</p> : null}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
