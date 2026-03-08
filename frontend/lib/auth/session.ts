import type { Session } from "@/types/api";

export const SESSION_STORAGE_KEY = "insightlabs.crm.session";
export const AUTH_NOTICE_STORAGE_KEY = "insightlabs.crm.auth-notice";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadSessionFromStorage(): Session | null {
  if (!isBrowser()) {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.tenantId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function persistSession(session: Session): void {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearSessionStorage(): void {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function persistAuthNotice(reason: string): void {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(AUTH_NOTICE_STORAGE_KEY, reason);
}

export function consumeAuthNotice(): string | null {
  if (!isBrowser()) {
    return null;
  }
  const notice = window.localStorage.getItem(AUTH_NOTICE_STORAGE_KEY);
  if (notice) {
    window.localStorage.removeItem(AUTH_NOTICE_STORAGE_KEY);
  }
  return notice;
}
