import { clearSessionStorage, loadSessionFromStorage, persistSession } from "@/lib/auth/session";

describe("session storage helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("persists and restores a session", () => {
    persistSession({
      accessToken: "access",
      refreshToken: "refresh",
      tenantId: "tenant-1",
    });

    expect(loadSessionFromStorage()).toEqual({
      accessToken: "access",
      refreshToken: "refresh",
      tenantId: "tenant-1",
    });
  });

  it("clears the session", () => {
    persistSession({
      accessToken: "access",
      refreshToken: "refresh",
      tenantId: "tenant-1",
    });

    clearSessionStorage();
    expect(loadSessionFromStorage()).toBeNull();
  });
});
