import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, buildApiHeaders, createApiClient } from "@/lib/api/client";
import type { Session } from "@/types/api";

describe("api client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("injects authorization and tenant headers", () => {
    const headers = buildApiHeaders(
      {
        accessToken: "token-123",
        refreshToken: "refresh-123",
        tenantId: "tenant-123",
      },
      { "X-Custom": "yes" },
    );

    expect(headers.get("Authorization")).toBe("Bearer token-123");
    expect(headers.get("X-Tenant-ID")).toBe("tenant-123");
    expect(headers.get("X-Custom")).toBe("yes");
  });

  it("sends login as application/json without auth headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: "a", refresh_token: "b", token_type: "bearer" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = createApiClient();
    await client.login({
      email: "owner@demo-crm.local",
      password: "demo123",
      tenant_id: "ba16bdbc-5966-4e57-8534-c44d7250bd98",
    });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(options.headers);

    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Authorization")).toBeNull();
    expect(headers.get("X-Tenant-ID")).toBeNull();
    expect(options.body).toBe(
      JSON.stringify({
        email: "owner@demo-crm.local",
        password: "demo123",
        tenant_id: "ba16bdbc-5966-4e57-8534-c44d7250bd98",
      }),
    );
  });

  it("refreshes on 401 and retries once", async () => {
    const session: Session = {
      accessToken: "expired",
      refreshToken: "refresh",
      tenantId: "tenant-1",
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "expired" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: "lead-1" }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const client = createApiClient({
      getSession: () => session,
      refreshSession: async () => ({
        accessToken: "fresh",
        refreshToken: "refresh-next",
        tenantId: "tenant-1",
      }),
    });

    const result = await client.listLeads();

    expect(result).toEqual([{ id: "lead-1" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("includes request_id from backend errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "boom" }), {
          status: 500,
          headers: {
            "content-type": "application/json",
            "X-Request-ID": "req-123",
          },
        }),
      ),
    );

    const client = createApiClient();

    await expect(client.listLeads()).rejects.toMatchObject({
      status: 500,
      requestId: "req-123",
      message: "boom (request_id: req-123)",
    });
  });
});
