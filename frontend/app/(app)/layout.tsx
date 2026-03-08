"use client";

import type { ReactNode } from "react";

import { AppShell } from "@/components/app/app-shell";
import { AuthGuard } from "@/components/auth/auth-guard";

export default function PrivateLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
