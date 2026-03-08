"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { loadSessionFromStorage } from "@/lib/auth/session";

export default function IndexPage() {
  const router = useRouter();

  useEffect(() => {
    const session = loadSessionFromStorage();
    router.replace(session ? "/dashboard" : "/login");
  }, [router]);

  return null;
}
