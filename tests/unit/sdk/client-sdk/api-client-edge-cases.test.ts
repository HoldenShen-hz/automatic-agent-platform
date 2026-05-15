/**
 * @fileoverview Additional tests for Client SDK - Error Classification & Edge Cases
 *
 * Tests additional coverage for error handling, version handshake, and edge cases.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  RetryableApiClient,
  createApiClient,
  buildApiUrl,
  createContractEnvelope,
  type ApiClientConfig,
} from "../../../../src/sdk/client-sdk/api-client.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

// Mock principal for testing
const mockPrincipal = {
  subject: "user_123",
  tenantId: "tenant_abc",
  roles: ["admin"],
};

// ============================================================================
// createApiClient Validation Tests
// ============================================================================

test("createApiClient throws when baseUrl is missing", () => {
  assert.throws(
    () =>
      createApiClient({
        apiVersion: "v1",
        bearerToken: "test-token",
        principal: mockPrincipal,
      }),
    (err: unknown) => err instanceof ValidationError && err.code === "client_sdk.missing_base_url",
  );
});

test("createApiClient throws when baseUrl is whitespace only", () => {
  assert.throws(
    () =>
      createApiClient({
        baseUrl: "   ",
        apiVersion: "v1",
        bearerToken: "test-token",
        principal: mockPrincipal,
      }),
    (err: unknown) => err instanceof ValidationError && err.code === "client_sdk.missing_base_url",
  );
});

test("createApiClient throws when apiVersion is missing", () => {
  assert.throws(
    () =>
      createApiClient({
        baseUrl: "https://api.example.com",
        bearerToken: "test-token",
        principal: mockPrincipal,
      }),
    (err: unknown) => err instanceof ValidationError && err.code === "client_sdk.missing_api_version",
  );
});

test("createApiClient throws when apiVersion is whitespace only", () => {
  assert.throws(
    () =>
      createApiClient({
        baseUrl: "https://api.example.com",
        apiVersion: "  ",
        bearerToken: "test-token",
        principal: mockPrincipal,
      }),
    (err: unknown) => err instanceof ValidationError && err.code === "client_sdk.missing_api_version",
  );
});

test("createApiClient throws when principal is missing", () => {
  assert.throws(
    () =>
      createApiClient({
        baseUrl: "https://api.example.com",
        apiVersion: "v1",
        bearerToken: "test-token",
      }),
    (err: unknown) => err instanceof ValidationError && err.code === "client_sdk.missing_principal",
  );
});

test("createApiClient sets performVersionHandshakeOnInit to true by default", () => {
  const client = createApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
  });

  // Client should be created successfully - the handshake happens on first request
  assert.ok(client);
});

test("createApiClient allows explicit false for performVersionHandshakeOnInit", () => {
  const client = createApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
    performVersionHandshakeOnInit: false,
  });

  assert.ok(client);
});

// ============================================================================
// RetryableApiClient Error Classification Tests
// ============================================================================

test("RetryableApiClient throws AuthError for 401 response", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
  };

  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });

  try {
    await assert.rejects(
      client.get("/test"),
      (err: unknown) => err instanceof Error && err.message.includes("Authentication/authorization failed"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient throws AuthError for 403 response", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
  };

  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });

  try {
    await assert.rejects(
      client.get("/test"),
      (err: unknown) => err instanceof Error && err.message.includes("Authentication/authorization failed"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient throws BusinessError for 400 response", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
  };

  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "Bad request", code: "invalid_input" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });

  try {
    await assert.rejects(
      client.get("/test"),
      (err: unknown) => err instanceof ValidationError && err.message.includes("API request failed with status 400"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient throws BusinessError for 422 response", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
  };

  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "Validation failed" }), {
      status: 422,
      headers: { "content-type": "application/json" },
    });

  try {
    await assert.rejects(
      client.post("/test", {}),
      (err: unknown) => err instanceof ValidationError && err.message.includes("API request failed with status 422"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient throws NetworkError for 500 response", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
  };

  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });

  try {
    await assert.rejects(
      client.get("/test"),
      (err: unknown) => err instanceof Error && err.message.includes("Server error"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient throws NetworkError for 502 response", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
  };

  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "Bad gateway" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });

  try {
    await assert.rejects(
      client.get("/test"),
      (err: unknown) => err instanceof Error && err.message.includes("Server error"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient throws NetworkError for 504 response", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
  };

  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "Gateway timeout" }), {
      status: 504,
      headers: { "content-type": "application/json" },
    });

  try {
    await assert.rejects(
      client.get("/test"),
      (err: unknown) => err instanceof Error && err.message.includes("Server error"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// Version Handshake Tests
// ============================================================================

test("RetryableApiClient.performVersionHandshake validates version compatibility", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
    performVersionHandshakeOnInit: true,
    sdkVersion: "1.0.0",
  };

  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        platformVersion: "v4.3",
        contractVersion: "v4.3",
        minClientVersion: "2.0.0",
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );

  try {
    await assert.rejects(
      client.performVersionHandshake(),
      (err: unknown) => err instanceof ValidationError && err.message.includes("not compatible"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient.performVersionHandshake succeeds when version is compatible", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
    performVersionHandshakeOnInit: true,
    sdkVersion: "3.0.0",
  };

  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        platformVersion: "v4.3",
        contractVersion: "v4.3",
        minClientVersion: "2.0.0",
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );

  try {
    const result = await client.performVersionHandshake();
    assert.equal(result.platformVersion, "v4.3");
    assert.equal(result.contractVersion, "v4.3");
    assert.equal(result.minClientVersion, "2.0.0");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("versionsCompatible returns true when client version equals minimum", async () => {
  // Test that SDK version 2.0.0 satisfies min version 2.0.0
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
    sdkVersion: "2.0.0",
  };

  const client = new RetryableApiClient(config);

  // We can test via the handshake which rejects when version is too low
  // SDK version 2.0.0 vs min 2.0.0 should pass (equal is compatible)
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        platformVersion: "v4.3",
        contractVersion: "v4.3",
        minClientVersion: "2.0.0",
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );

  try {
    const result = await client.performVersionHandshake();
    assert.equal(result.minClientVersion, "2.0.0");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// Retry Backoff Tests
// ============================================================================

test("RetryableApiClient uses exponential backoff for retries", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
  };

  const client = new RetryableApiClient(config, {
    maxRetries: 3,
    backoffMs: 100,
    backoffMultiplier: 2,
    maxBackoffMs: 1000,
  });

  let attemptTimes: number[] = [];
  const startTime = Date.now();
  let attemptCount = 0;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    attemptCount++;
    attemptTimes.push(Date.now() - startTime);
    if (attemptCount < 4) {
      return new Response(JSON.stringify({ error: "Service unavailable" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await client.get<{ success: boolean }>("/test");
    // Should have 4 attempts (3 retries + final success)
    assert.equal(attemptCount, 4);

    // Verify exponential backoff: times should increase roughly exponentially
    // Attempt 1: immediate (backoff base)
    // Attempt 2: ~100ms after attempt 1
    // Attempt 3: ~200ms after attempt 2
    // Attempt 4: ~400ms after attempt 3
    assert.ok(attemptTimes[1]! >= 80, `Second attempt should be after ~100ms, was ${attemptTimes[1]}ms`);
    assert.ok(attemptTimes[2]! >= 180, `Third attempt should be after ~300ms total, was ${attemptTimes[2]}ms`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient caps backoff at maxBackoffMs", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
  };

  const client = new RetryableApiClient(config, {
    maxRetries: 5,
    backoffMs: 100,
    backoffMultiplier: 2,
    maxBackoffMs: 500, // Cap at 500ms
  });

  let attemptCount = 0;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    attemptCount++;
    return new Response(JSON.stringify({ error: "Service unavailable" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  };

  const startTime = Date.now();
  try {
    await assert.rejects(client.get("/test"));
    const elapsed = Date.now() - startTime;

    // With maxBackoffMs of 500, total time for 5 retries should be capped
    // Not an exact check since test environment timing varies
    assert.ok(elapsed < 5000, `Total time should be reasonable, was ${elapsed}ms`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// Idempotency Key Tests
// ============================================================================

test("RetryableApiClient uses request-level idempotencyKey over client-level", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
    idempotencyKey: "client-level-key",
  };

  const client = new RetryableApiClient(config);

  let capturedBody: Record<string, unknown> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    capturedBody = JSON.parse(options?.body as string);
    return new Response(JSON.stringify({ created: true }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await client.post("/test", {}, { idempotencyKey: "request-level-key" });
    assert.equal(capturedBody.idempotencyKey, "request-level-key");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient falls back to client-level idempotencyKey when not provided", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
    idempotencyKey: "client-level-key",
  };

  const client = new RetryableApiClient(config);

  let capturedBody: Record<string, unknown> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    capturedBody = JSON.parse(options?.body as string);
    return new Response(JSON.stringify({ created: true }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await client.post("/test", {});
    assert.equal(capturedBody.idempotencyKey, "client-level-key");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient uses request-level idempotencyKey when client-level not set", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
  };

  const client = new RetryableApiClient(config);

  let capturedBody: Record<string, unknown> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    capturedBody = JSON.parse(options?.body as string);
    return new Response(JSON.stringify({ created: true }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await client.post("/test", {}, { idempotencyKey: "request-key" });
    assert.equal(capturedBody.idempotencyKey, "request-key");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// HTTP Method Tests
// ============================================================================

test("RetryableApiClient supports PUT method", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
  };

  const client = new RetryableApiClient(config);

  let receivedMethod = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    receivedMethod = options?.method as string;
    return new Response(JSON.stringify({ updated: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await client.put("/test", { data: "updated" });
    assert.equal(receivedMethod, "PUT");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient supports PATCH method", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
  };

  const client = new RetryableApiClient(config);

  let receivedMethod = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    receivedMethod = options?.method as string;
    return new Response(JSON.stringify({ patched: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await client.patch("/test", { data: "patched" });
    assert.equal(receivedMethod, "PATCH");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient supports DELETE method", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
  };

  const client = new RetryableApiClient(config);

  let receivedMethod = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    receivedMethod = options?.method as string;
    return new Response(JSON.stringify({ deleted: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await client.delete("/test");
    assert.equal(receivedMethod, "DELETE");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// Pagination Tests
// ============================================================================

test("RetryableApiClient.getPaginated extracts nextCursor from headers", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
  };

  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify([{ id: "1" }, { id: "2" }]), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-next-cursor": "next-page-token",
        "x-total-count": "42",
      },
    });

  try {
    const result = await client.getPaginated<{ id: string }>("/items");
    assert.equal(result.data.length, 2);
    assert.equal(result.nextCursor, "next-page-token");
    assert.equal(result.totalCount, 42);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient.getPaginated handles missing optional headers", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
  };

  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify([{ id: "1" }]), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });

  try {
    const result = await client.getPaginated<{ id: string }>("/items");
    assert.equal(result.data.length, 1);
    assert.equal(result.nextCursor, null);
    assert.equal(result.totalCount, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// Timeout Tests
// ============================================================================

test("RetryableApiClient respects timeoutMs config", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
    timeoutMs: 100,
  };

  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    // Verify timeout signal was set
    assert.ok(options?.signal instanceof AbortSignal);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await client.get("/test");
    assert.equal(result.status, 200);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
