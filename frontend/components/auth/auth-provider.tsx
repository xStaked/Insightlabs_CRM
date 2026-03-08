"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

import { createApiClient } from "@/lib/api/client";
import {
  clearSessionStorage,
  loadSessionFromStorage,
  persistAuthNotice,
  persistSession,
} from "@/lib/auth/session";
import type { Session } from "@/types/api";

type AuthContextValue = {
  ready: boolean;
  session: Session | null;
  error: string | null;
  publicApi: ReturnType<typeof createApiClient>;
  api: ReturnType<typeof createApiClient>;
  login: (payload: { email: string; password: string; tenantId: string }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<Session | null>(null);

  useEffect(() => {
    const restored = loadSessionFromStorage();
    sessionRef.current = restored;
    setSession(restored);
    setReady(true);
  }, []);

  async function applySession(next: Session | null) {
    sessionRef.current = next;
    setSession(next);
    if (next) {
      persistSession(next);
    } else {
      clearSessionStorage();
    }
  }

  async function refreshSession(): Promise<Session | null> {
    const current = sessionRef.current;
    if (!current?.refreshToken) {
      await applySession(null);
      return null;
    }

    try {
      const publicApi = createApiClient();
      const refreshed = await publicApi.refresh(current.refreshToken);
      const next = {
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        tenantId: current.tenantId,
      };
      await applySession(next);
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Session refresh failed");
      persistAuthNotice("session_expired");
      await applySession(null);
      return null;
    }
  }

  async function login(payload: { email: string; password: string; tenantId: string }) {
    setError(null);
    const publicApi = createApiClient();
    const tokens = await publicApi.login({
      email: payload.email,
      password: payload.password,
      tenant_id: payload.tenantId,
    });
    await applySession({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tenantId: payload.tenantId,
    });
  }

  async function logout() {
    const current = sessionRef.current;
    setError(null);

    try {
      if (current?.refreshToken) {
        await createApiClient().logout(current.refreshToken);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout failed");
    } finally {
      persistAuthNotice("signed_out");
      await applySession(null);
    }
  }

  const publicApi = createApiClient();
  const api = createApiClient({
    getSession: () => sessionRef.current,
    refreshSession,
    clearSession: () => {
      void applySession(null);
    },
    onAuthFailure: (reason) => {
      persistAuthNotice(reason);
    },
  });

  return (
    <AuthContext.Provider
      value={{
        ready,
        session,
        error,
        publicApi,
        api,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
