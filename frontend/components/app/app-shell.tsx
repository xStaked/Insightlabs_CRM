"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { useAsyncResource } from "@/lib/hooks/use-async-resource";
import { persistAuthNotice } from "@/lib/auth/session";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
  { href: "/pipelines", label: "Pipelines" },
  { href: "/inbox", label: "Inbox" },
  { href: "/tasks", label: "Tasks" },
  { href: "/appointments", label: "Agenda" },
  { href: "/billing", label: "Billing" },
  { href: "/automations", label: "Automations" },
  { href: "/reports", label: "Reports" },
  { href: "/operations", label: "Operations" },
];

const NAV_GROUPS = [
  {
    label: "Workspace",
    items: ["/dashboard", "/leads", "/pipelines", "/inbox"],
  },
  {
    label: "Execution",
    items: ["/tasks", "/appointments", "/billing", "/automations"],
  },
  {
    label: "Management",
    items: ["/reports", "/operations"],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, session, publicApi } = useAuth();
  const companies = useAsyncResource(() => publicApi.listCompanies(), []);
  const [selectedTenant, setSelectedTenant] = useState(session?.tenantId || "");
  const currentCompany = companies.data?.find((company) => company.id === session?.tenantId);

  const breadcrumb = pathname.split("/").filter(Boolean);

  function formatBreadcrumb(item: string) {
    return item
      .replace(/-/g, " ")
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }

  function handleWorkspaceSwitch() {
    persistAuthNotice("switch_workspace");
    router.push(`/login?tenant=${encodeURIComponent(selectedTenant || session?.tenantId || "")}`);
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar__brand">
          <div className="app-sidebar__brand-lockup">
            <span className="app-sidebar__brand-mark" aria-hidden="true">
              SN8
            </span>
            <div className="app-sidebar__brand-copy">
              <span className="app-sidebar__eyebrow">SN8 CRM</span>
              <span className="app-sidebar__title">Sales operations workspace</span>
            </div>
          </div>
          <p className="app-sidebar__summary">Leads, conversations, pipeline execution and operating cadence in one place.</p>
        </div>

        <nav className="app-sidebar__nav" aria-label="Primary">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="app-sidebar__group">
              <div className="app-sidebar__section-label">{group.label}</div>
              {NAV_ITEMS.filter((item) => group.items.includes(item.href)).map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`app-sidebar__link${active ? " app-sidebar__link--active" : ""}`}
                  >
                    <span>{item.label}</span>
                    {active ? <span className="app-sidebar__link-indicator" aria-hidden="true" /> : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="app-sidebar__footer">
          <div className="app-sidebar__workspace">
            <Badge tone="neutral">Workspace</Badge>
            <div className="app-sidebar__workspace-name">{currentCompany?.name || "Workspace context"}</div>
            <div className="app-sidebar__workspace-id">{session?.tenantId || "No workspace selected"}</div>
          </div>
          <Button variant="ghost" className="app-sidebar__logout" onClick={() => void logout()}>
            Log out
          </Button>
        </div>
      </aside>

      <main className="app-main">
        <header className="app-topbar">
          <div className="app-topbar__context">
            <div className="app-topbar__meta">
              <div className="breadcrumb" aria-label="Breadcrumb">
                <span className="breadcrumb__item">Workspace</span>
                {breadcrumb.map((item, index) => (
                  <span key={`${item}-${index}`} className="breadcrumb__item">
                    {formatBreadcrumb(item)}
                  </span>
                ))}
              </div>
              <div className="muted-text">
                {currentCompany ? `${currentCompany.name} · ${currentCompany.slug}` : "Loading workspace context"}
              </div>
            </div>
          </div>

          <div className="app-topbar__actions">
            <Badge tone="neutral">Tenant switch</Badge>
            <select
              className="select-inline"
              value={selectedTenant}
              onChange={(event) => setSelectedTenant(event.target.value)}
            >
              <option value={session?.tenantId || ""}>Current workspace</option>
              {(companies.data || []).map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            <Button variant="secondary" onClick={handleWorkspaceSwitch} disabled={!selectedTenant}>
              Switch workspace
            </Button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
