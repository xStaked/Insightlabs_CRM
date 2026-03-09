import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header__body">
        {eyebrow ? <div className="page-header__eyebrow">{eyebrow}</div> : null}
        <div className="page-header__title-group">
          <h1 className="page-header__title">{title}</h1>
          <p className="page-header__description">{description}</p>
        </div>
        {meta ? <div className="page-header__meta">{meta}</div> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}
