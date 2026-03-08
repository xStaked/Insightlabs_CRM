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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, session, publicApi } = useAuth();
  const companies = useAsyncResource(() => publicApi.listCompanies(), []);
  const [selectedTenant, setSelectedTenant] = useState(session?.tenantId || "");
  const currentCompany = companies.data?.find((company) => company.id === session?.tenantId);

  const breadcrumb = pathname.split("/").filter(Boolean);

  function handleWorkspaceSwitch() {
    persistAuthNotice("switch_workspace");
    router.push(`/login?tenant=${encodeURIComponent(selectedTenant || session?.tenantId || "")}`);
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar__brand">
          <span className="app-sidebar__eyebrow">Insightlabs CRM</span>
          <span className="app-sidebar__title">Revenue cockpit for advisors</span>
        </div>

        <nav className="app-sidebar__nav" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`app-sidebar__link${active ? " app-sidebar__link--active" : ""}`}
              >
                <span>{item.label}</span>
                <span aria-hidden="true">{active ? "01" : "->"}</span>
              </Link>
            );
          })}
        </nav>

        <div className="app-sidebar__meta">
          <Badge tone="neutral">Tenant</Badge>
          <div className="muted-text">{currentCompany?.name || "Workspace"}</div>
          <div className="muted-text">{session?.tenantId || "No tenant loaded"}</div>
          <Button variant="ghost" onClick={() => void logout()}>
            Log out
          </Button>
        </div>
      </aside>

      <main className="app-main">
        <header className="app-topbar">
          <div className="app-topbar__meta">
            <div className="breadcrumb">
              {breadcrumb.map((item, index) => (
                <span key={`${item}-${index}`}>
                  {index === breadcrumb.length - 1 ? <strong>{item}</strong> : item}
                </span>
              ))}
            </div>
            <div className="muted-text">
              {currentCompany ? `${currentCompany.name} · ${currentCompany.slug}` : "Workspace context loading"}
            </div>
          </div>

          <div className="action-row">
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
