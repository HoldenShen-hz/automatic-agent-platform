import { describe, expect, it, vi } from "vitest";
import {
  createTraceInterceptor,
  createContractVersionInterceptor,
  createAuthInterceptor,
  createTenantInterceptor,
  createIdempotencyKeyInterceptor,
  createCsrfInterceptor,
  createRetryInterceptor,
  createDedupeInterceptor,
  type RestClientRequest,
  type RestClientResponse,
} from "@aa/shared-api-client";

function createMockRequest(method: "GET" | "POST" = "GET", extraHeaders: Record<string, string> = {}): RestClientRequest {
  const headers = new Headers(extraHeaders);
  return {
    path: "/api/v1/test",
    method,
    headers,
    body: undefined,
  };
}

function createMockResponse<T>(status = 200, data: T = {} as T): RestClientResponse<T> {
  return { status, data };
}

async function withCsrfMetaToken(token: string, run: () => Promise<void> | void): Promise<void> {
  const meta = document.createElement("meta");
  meta.setAttribute("name", "aa-csrf-token");
  meta.setAttribute("content", token);
  document.head.appendChild(meta);
  try {
    await run();
  } finally {
    meta.remove();
  }
}

describe("createTraceInterceptor", () => {
  it("adds x-request-id header on request", async () => {
    const interceptor = createTraceInterceptor();
    const request = createMockRequest();

    const result = await interceptor.onRequest!(request);

    expect(result.headers.has("x-request-id")).toBe(true);
    expect(result.headers.get("x-request-id")!.length).toBeGreaterThan(0);
  });

  it("generates unique request IDs", async () => {
    const interceptor = createTraceInterceptor();
    const request1 = createMockRequest();
    const request2 = createMockRequest();

    const result1 = await interceptor.onRequest!(request1);
    const result2 = await interceptor.onRequest!(request2);

    expect(result1.headers.get("x-request-id")).not.toBe(result2.headers.get("x-request-id"));
  });
});

describe("createContractVersionInterceptor", () => {
  it("adds Accept-Version header on request", async () => {
    const interceptor = createContractVersionInterceptor();
    const request = createMockRequest();

    const result = await interceptor.onRequest!(request);

    expect(result.headers.get("Accept-Version")).toBe("v1");
  });

  it("supports multiple versions", async () => {
    const interceptor = createContractVersionInterceptor(["v1", "v2", "v3"]);
    const request = createMockRequest();

    const result = await interceptor.onRequest!(request);

    expect(result.headers.get("Accept-Version")).toBe("v1,v2,v3");
  });

  it("logs error on 406 response", async () => {
    const interceptor = createContractVersionInterceptor();
    const response = createMockResponse(406);

    const result = await interceptor.onResponse!(response);
    expect(result.status).toBe(406);
  });
});

describe("createAuthInterceptor - Token Refresh (Issue #2071)", () => {
  it("rejects static bearer token strings and requires a dynamic resolver", async () => {
    const interceptor = createAuthInterceptor("static-token-123" as never);
    const request = createMockRequest();

    await expect(interceptor.onRequest!(request)).rejects.toThrow(
      "auth.dynamic_token_required:Static bearer tokens are not supported",
    );
  });

  it("adds token from TokenResolver with getAccessToken", async () => {
    const resolver = {
      getAccessToken() {
        return "resolver-token-456";
      },
    };
    const interceptor = createAuthInterceptor(resolver);
    const request = createMockRequest();

    const result = await interceptor.onRequest!(request);

    expect(result.headers.get("authorization")).toBe("Bearer resolver-token-456");
  });

  it("uses synchronous getAccessToken when auto-refresh is available", async () => {
    const resolver = {
      getAccessToken() {
        return "sync-token";
      },
      getAccessTokenWithRefresh: async () => ({ accessToken: "refreshed-token", refreshToken: "new-refresh", expiresIn: 3600 }),
    };
    const interceptor = createAuthInterceptor(resolver);
    const request = createMockRequest();

    const result = await interceptor.onRequest!(request);

    expect(result.headers.get("authorization")).toBe("Bearer sync-token");
  });

  it("refreshes before request when the resolver reports refresh due", async () => {
    const resolver = {
      getAccessToken() {
        return "stale-token";
      },
      shouldRefresh() {
        return true;
      },
      getAccessTokenWithRefresh: async () => "fresh-token",
    };
    const interceptor = createAuthInterceptor(resolver);
    const request = createMockRequest();

    const result = await interceptor.onRequest!(request);

    expect(result.headers.get("authorization")).toBe("Bearer fresh-token");
  });

  it("does not add header when token is null", async () => {
    const interceptor = createAuthInterceptor(null);
    const request = createMockRequest();

    const result = await interceptor.onRequest!(request);

    expect(result.headers.has("authorization")).toBe(false);
  });

  it("handles object without getAccessTokenWithRefresh", async () => {
    const resolver = {
      getAccessToken() {
        return "direct-token";
      },
    };
    const interceptor = createAuthInterceptor(resolver);
    const request = createMockRequest();

    const result = await interceptor.onRequest!(request);

    expect(result.headers.get("authorization")).toBe("Bearer direct-token");
  });

  it("delegates 401 responses to the resolver unauthorized handler", async () => {
    const handleUnauthorized = vi.fn(async () => undefined);
    const resolver = {
      getAccessToken() {
        return "direct-token";
      },
      handleUnauthorized,
    };
    const interceptor = createAuthInterceptor(resolver);
    const response = createMockResponse(401);

    const result = await interceptor.onResponse!(response);

    expect(result.status).toBe(401);
    expect(handleUnauthorized).toHaveBeenCalledTimes(1);
  });
});

describe("createTenantInterceptor", () => {
  it("adds x-tenant-id header when tenantId is provided", async () => {
    const interceptor = createTenantInterceptor("tenant-abc-123");
    const request = createMockRequest();

    const result = await interceptor.onRequest!(request);

    expect(result.headers.get("x-tenant-id")).toBe("tenant-abc-123");
  });

  it("does not add header when tenantId is null", async () => {
    const interceptor = createTenantInterceptor(null);
    const request = createMockRequest();

    const result = await interceptor.onRequest!(request);

    expect(result.headers.has("x-tenant-id")).toBe(false);
  });
});

describe("createIdempotencyKeyInterceptor", () => {
  it("adds idempotency headers to mutating requests", async () => {
    const interceptor = createIdempotencyKeyInterceptor();
    const request = createMockRequest("POST");

    const result = await interceptor.onRequest!(request);

    expect(result.headers.get("Idempotency-Key")).toBeTruthy();
    expect(result.headers.get("x-idempotency-key")).toBe(result.headers.get("Idempotency-Key"));
  });

  it("preserves an existing idempotency key", async () => {
    const interceptor = createIdempotencyKeyInterceptor();
    const request = createMockRequest("PATCH", { "Idempotency-Key": "existing-key-123" });

    const result = await interceptor.onRequest!(request);

    expect(result.headers.get("Idempotency-Key")).toBe("existing-key-123");
    expect(result.headers.get("x-idempotency-key")).toBe("existing-key-123");
  });

  it("does not add idempotency headers to GET requests", async () => {
    const interceptor = createIdempotencyKeyInterceptor();
    const request = createMockRequest("GET");

    const result = await interceptor.onRequest!(request);

    expect(result.headers.has("Idempotency-Key")).toBe(false);
    expect(result.headers.has("x-idempotency-key")).toBe(false);
  });
});

describe("createCsrfInterceptor (Issue #2072)", () => {
  it("adds token for non-GET requests", async () => {
    await withCsrfMetaToken("csrf-token-789", async () => {
      const interceptor = createCsrfInterceptor("csrf-token-789");
      const request = createMockRequest("POST");

      const result = await interceptor.onRequest!(request);

      expect(result.headers.get("x-csrf-token")).toBe("csrf-token-789");
    });
  });

  it("does NOT add token for GET requests", async () => {
    const interceptor = createCsrfInterceptor("csrf-token-789");
    const request = createMockRequest("GET");

    const result = await interceptor.onRequest!(request);

    expect(result.headers.has("x-csrf-token")).toBe(false);
  });

  it("does not add header when token is null", async () => {
    const interceptor = createCsrfInterceptor(null);
    const request = createMockRequest("POST");

    const result = await interceptor.onRequest!(request);

    expect(result.headers.has("x-csrf-token")).toBe(false);
  });

  it("is applied to all non-GET methods (PUT, PATCH, DELETE)", async () => {
    await withCsrfMetaToken("token-for-write", async () => {
      const interceptor = createCsrfInterceptor("token-for-write");
      const methods: Array<"POST" | "PUT" | "PATCH" | "DELETE"> = ["POST", "PUT", "PATCH", "DELETE"];

      for (const method of methods) {
        const request = createMockRequest(method);
        const result = await interceptor.onRequest!(request);
        expect(result.headers.get("x-csrf-token")).toBe("token-for-write");
      }
    });
  });
});

describe("createRetryInterceptor", () => {
  it("passes through non-retryable status codes", async () => {
    const interceptor = createRetryInterceptor();
    const response = createMockResponse(200);

    const result = await interceptor.onResponse!(response);

    expect(result.status).toBe(200);
  });

  it("passes through retryable status codes (logs warning)", async () => {
    const interceptor = createRetryInterceptor();
    const response = createMockResponse(429);

    const result = await interceptor.onResponse!(response);

    expect(result.status).toBe(429);
  });
});

describe("createDedupeInterceptor", () => {
  it("attaches dedupe key to duplicate requests", async () => {
    const interceptor = createDedupeInterceptor();
    const request1 = createMockRequest("POST", { "content-type": "application/json" });
    const request2 = createMockRequest("POST", { "content-type": "application/json" });

    await interceptor.onRequest!(request1);
    const result2 = await interceptor.onRequest!(request2);

    expect((result2 as any).dedupeKey).toBeDefined();
  });

  it("clears dedupe key on response", async () => {
    const interceptor = createDedupeInterceptor();
    const request = createMockRequest("GET");

    await interceptor.onRequest!(request);
    const response = createMockResponse(200);

    const result = await interceptor.onResponse!(response);

    expect((result as any).dedupeKey).toBeUndefined();
  });

  it("differentiates by method", async () => {
    const interceptor = createDedupeInterceptor();

    // Make two identical POST requests - second should get dedupeKey
    const postRequest1 = createMockRequest("POST", { "content-type": "application/json" });
    const postRequest2 = createMockRequest("POST", { "content-type": "application/json" });

    const result1 = await interceptor.onRequest!(postRequest1);
    const result2 = await interceptor.onRequest!(postRequest2);

    // First request doesn't get dedupeKey (it's the original)
    // Second request (duplicate) gets dedupeKey attached
    expect((result1 as any).dedupeKey).toBeUndefined();
    expect((result2 as any).dedupeKey).toBeDefined();
    expect((result2 as any).dedupeKey).toContain("POST:/api/v1/test");
  });
});
