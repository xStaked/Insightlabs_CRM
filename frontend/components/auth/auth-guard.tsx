"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/auth-provider";
import { LoadingState } from "@/components/ui/data-state";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { ready, session } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (!session) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, ready, router, session]);

  if (!ready || !session) {
    return <LoadingState title="Preparing workspace" copy="Checking your session and tenant context." />;
  }

  return <>{children}</>;
}
