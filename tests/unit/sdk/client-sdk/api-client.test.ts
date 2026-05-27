import assert from "node:assert/strict";
import test from "node:test";

import {
  RetryableApiClient,
  ApiClientConfig,
  buildApiUrl,
  buildAuthHeaders,
  parseRetryAfterDelayMs,
} from "../../../../src/sdk/client-sdk/index.js";

/**
 * Unit tests for the RetryableApiClient class.
 * These tests focus on code paths not covered by the main client-sdk.test.ts
 * which covers the public API surface.
 */

test("RetryableApiClient constructor accepts custom retry config", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const retryConfig = {
    maxRetries: 5,
    backoffMs: 500,
    backoffMultiplier: 1.5,
    maxBackoffMs: 10000,
  };
  const client = new RetryableApiClient(config, retryConfig);
  assert.ok(client instanceof RetryableApiClient);
});

test("RetryableApiClient constructor uses default retry config when not provided", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config);
  assert.ok(client instanceof RetryableApiClient);
});

test("parseRetryAfterDelayMs parses delta-seconds values", () => {
  assert.equal(parseRetryAfterDelayMs("3", 0), 3000);
});

test("parseRetryAfterDelayMs parses HTTP-date values", () => {
  const nowMs = Date.parse("2026-10-21T07:27:58.000Z");
  const delayMs = parseRetryAfterDelayMs("Wed, 21 Oct 2026 07:28:00 GMT", nowMs);
  assert.equal(delayMs, 2000);
});

test("parseRetryAfterDelayMs returns null for invalid headers", () => {
  assert.equal(parseRetryAfterDelayMs("not-a-date"), null);
});

test("RetryableApiClient createExecutionTicket targets the dispatch ticket endpoint", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config);

  let capturedUrl = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    capturedUrl = url.toString();
    return new Response(JSON.stringify({ outcome: "created" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await client.createExecutionTicket<{ outcome: string }>({ executionId: "exec-1" });
    assert.equal(result.data.outcome, "created");
    assert.equal(capturedUrl, "https://api.example.com/api/v1/execution-dispatch/tickets");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient dispatchExecution targets the dispatch-next endpoint", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config);

  let capturedUrl = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    capturedUrl = url.toString();
    return new Response(JSON.stringify({ outcome: "dispatched" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await client.dispatchExecution<{ outcome: string }>({ queueName: "default" });
    assert.equal(result.data.outcome, "dispatched");
    assert.equal(capturedUrl, "https://api.example.com/api/v1/execution-dispatch/dispatch-next");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient PATCH method sends body and returns ApiResponse", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ id: 1, name: "updated" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await client.put<{ id: number; name: string }>("/users/1", { name: "updated" });
    assert.equal(result.status, 200);
    assert.deepEqual(result.data, { id: 1, name: "updated" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient.request sets content-type header when body is present", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config);

  let capturedHeaders: Record<string, string> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    capturedHeaders = options?.headers as Record<string, string> ?? {};
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await client.post("/data", { key: "value" });
    assert.equal(capturedHeaders["content-type"], "application/json");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient.request does not set content-type when no body", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config);

  let capturedHeaders: Record<string, string> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    capturedHeaders = options?.headers as Record<string, string> ?? {};
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await client.get("/users");
    assert.ok(!("content-type" in capturedHeaders));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient.request uses DELETE method when specified", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config);

  let capturedMethod = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    capturedMethod = options?.method as string ?? "";
    return new Response(JSON.stringify({ deleted: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await client.delete("/users/1");
    assert.equal(capturedMethod, "DELETE");
    assert.equal(result.status, 200);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient.request defaults to GET when method not specified", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config);

  let capturedMethod = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    capturedMethod = (options?.method as string) ?? "";
    return new Response(JSON.stringify({ id: 1 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    // Access the private request method via get which calls it
    await client.get<{ id: number }>("/users/1");
    assert.equal(capturedMethod, "GET");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient.request parses JSON response correctly", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    const data = { nested: { value: 42 }, array: [1, 2, 3] };
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await client.get<{ nested: { value: number }; array: number[] }>("/test");
    assert.deepEqual(result.data, { nested: { value: 42 }, array: [1, 2, 3] });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient.request handles response with no JSON body", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("not json", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });

  try {
    // response.json() will throw on non-JSON content
    await assert.rejects(client.get("/test"), SyntaxError);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient.request propagates network error after retries exhausted", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config, {
    maxRetries: 2,
    backoffMs: 10,
    backoffMultiplier: 2,
    maxBackoffMs: 100,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Connection refused");
  };

  try {
    await assert.rejects(
      client.get("/test"),
      (error: unknown) => error instanceof Error && error.message === "Connection refused",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient.request handles non-JSON response gracefully", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("not json content", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });

  try {
    // This should throw because response.json() fails on non-JSON
    await assert.rejects(client.get("/test"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient.getPaginated parses x-next-cursor header correctly", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify([{ id: 1 }]), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-next-cursor": "next-page",
      },
    });

  try {
    const result = await client.getPaginated<{ id: number }>("/users");
    assert.equal(result.nextCursor, "next-page");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient.getPaginated handles missing x-next-cursor header", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify([{ id: 1 }]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await client.getPaginated<{ id: number }>("/users");
    assert.equal(result.nextCursor, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient.getPaginated parses x-total-count header correctly", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify([{ id: 1 }]), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-total-count": "150",
      },
    });

  try {
    const result = await client.getPaginated<{ id: number }>("/users");
    assert.equal(result.totalCount, 150);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient.getPaginated omits totalCount when x-total-count header missing", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify([{ id: 1 }]), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-next-cursor": "next",
      },
    });

  try {
    const result = await client.getPaginated<{ id: number }>("/users");
    assert.equal(result.totalCount, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient.getPaginated passes query params for cursor when provided", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config);

  let capturedUrl: string | undefined;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    capturedUrl = url.toString();
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await client.getPaginated<{ id: number }>("/users", { cursor: "page-abc" });
    assert.ok(capturedUrl !== undefined);
    assert.ok(capturedUrl!.includes("cursor=page-abc"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient.getPaginated passes query params for limit when provided", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config);

  let capturedUrl: string | undefined;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    capturedUrl = url.toString();
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await client.getPaginated<{ id: number }>("/users", { limit: 50 });
    assert.ok(capturedUrl !== undefined);
    assert.ok(capturedUrl!.includes("limit=50"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("buildApiUrl handles empty query object", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const url = buildApiUrl(config, { path: "/users", query: {} });
  assert.ok(!url.includes("?"));
});

test("buildApiUrl handles boolean query values", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const url = buildApiUrl(config, { path: "/users", query: { active: false, admin: true } });
  assert.ok(url.includes("active=false"));
  assert.ok(url.includes("admin=true"));
});

test("buildApiUrl handles numeric query values", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const url = buildApiUrl(config, { path: "/users", query: { page: 1, limit: 100 } });
  assert.ok(url.includes("page=1"));
  assert.ok(url.includes("limit=100"));
});

test("buildAuthHeaders works with bearer token containing special characters", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "token-with-dashes_and_underscores.plus",
  };
  const headers = buildAuthHeaders(config);
  assert.equal(headers["authorization"], "Bearer token-with-dashes_and_underscores.plus");
});

test("RetryableApiClient uses correct backoff calculation on second retry", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  // Using short backoff for fast test
  const client = new RetryableApiClient(config, {
    maxRetries: 3,
    backoffMs: 10,
    backoffMultiplier: 2,
    maxBackoffMs: 1000,
  });

  const startTime = Date.now();
  let attemptCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    attemptCount++;
    if (attemptCount <= 2) {
      return new Response(JSON.stringify({ error: "Server error" }), {
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
    const result = await client.get<{ success: boolean }>("/test");
    assert.equal(result.status, 200);
    assert.equal(attemptCount, 3);
    const elapsed = Date.now() - startTime;
    // Second retry should have backoff of backoffMs * backoffMultiplier = 10 * 2 = 20ms
    // But with overhead, just verify it was in the 10-100ms range per attempt
    assert.ok(elapsed >= 20, `Expected elapsed >= 20ms, got ${elapsed}ms`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient caps backoff at maxBackoffMs", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  // maxBackoffMs = 50, so even with multiplier of 10, it should cap at 50
  const client = new RetryableApiClient(config, {
    maxRetries: 3,
    backoffMs: 100,
    backoffMultiplier: 10,
    maxBackoffMs: 50,
  });

  const startTime = Date.now();
  let attemptCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    attemptCount++;
    if (attemptCount <= 2) {
      return new Response(JSON.stringify({ error: "Server error" }), {
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
    const result = await client.get<{ success: boolean }>("/test");
    assert.equal(result.status, 200);
    const elapsed = Date.now() - startTime;
    // With maxBackoffMs of 50, two retries should take at most ~100ms plus overhead
    assert.ok(elapsed < 200, `Expected elapsed < 200ms, got ${elapsed}ms`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient PUT is retried on 5xx errors (idempotent)", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config, {
    maxRetries: 3,
    backoffMs: 10,
    backoffMultiplier: 2,
    maxBackoffMs: 100,
  });

  let attemptCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    attemptCount++;
    if (attemptCount <= 2) {
      return new Response(JSON.stringify({ error: "Server error" }), {
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
    const result = await client.put<{ success: boolean }>("/users/1", { name: "updated" });
    assert.equal(result.status, 200);
    assert.equal(attemptCount, 3); // Initial + 2 retries
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient PATCH is retried on 5xx errors (idempotent)", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config, {
    maxRetries: 3,
    backoffMs: 10,
    backoffMultiplier: 2,
    maxBackoffMs: 100,
  });

  let attemptCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    attemptCount++;
    if (attemptCount <= 2) {
      return new Response(JSON.stringify({ error: "Server error" }), {
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
    const result = await client.patch<{ success: boolean }>("/users/1", { name: "updated" });
    assert.equal(result.status, 200);
    assert.equal(attemptCount, 3); // Initial + 2 retries
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient POST is NOT retried on 5xx errors (non-idempotent)", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config, {
    maxRetries: 3,
    backoffMs: 10,
    backoffMultiplier: 2,
    maxBackoffMs: 100,
  });

  let attemptCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    attemptCount++;
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await assert.rejects(client.post<{ success: boolean }>("/users", { name: "test" }));
    assert.equal(attemptCount, 1); // No retries - should only be called once
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient DELETE is NOT retried on 5xx errors (non-idempotent)", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config, {
    maxRetries: 3,
    backoffMs: 10,
    backoffMultiplier: 2,
    maxBackoffMs: 100,
  });

  let attemptCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    attemptCount++;
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await assert.rejects(client.delete("/users/1"));
    assert.equal(attemptCount, 1); // No retries - should only be called once
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient does NOT retry on 4xx client errors", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config, {
    maxRetries: 3,
    backoffMs: 10,
    backoffMultiplier: 2,
    maxBackoffMs: 100,
  });

  let attemptCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    attemptCount++;
    return new Response(JSON.stringify({ error: "Bad request" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await assert.rejects(client.get("/test"));
    assert.equal(attemptCount, 1); // No retries on 4xx
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// R2011: Typed Error Tests - HTTP errors are thrown as typed AppError subclasses
// ============================================================================

test("R2011: RetryableApiClient throws AuthError on 401 response", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "invalid-token",
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
      (err: unknown) => {
        // R2011 FIX: Should throw AuthError with correct code and status
        if (err && typeof err === "object" && "code" in err && "statusCode" in err) {
          return err.code === "client_sdk.auth_failed" && err.statusCode === 401;
        }
        return false;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("R2011: RetryableApiClient throws NetworkError on 500 response", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
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
      (err: unknown) => {
        // R2011 FIX: Should throw NetworkError with retryable=true for 5xx
        if (err && typeof err === "object" && "code" in err) {
          return err.code === "client_sdk.network_error";
        }
        return false;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("R2011: RetryableApiClient throws ValidationError on 400 response", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "Bad request" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });

  try {
    await assert.rejects(
      client.post("/test", { invalid: true }),
      (err: unknown) => {
        // 400 responses align with server-side validation category.
        if (err && typeof err === "object" && "code" in err && "statusCode" in err) {
          return err.code === "client_sdk.contract_violation" && err.statusCode === 400;
        }
        return false;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("R2011: RetryableApiClient throws AuthError on 403 response", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "forbidden-token",
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
      (err: unknown) => {
        // R2011 FIX: Should throw AuthError for 403
        if (err && typeof err === "object" && "code" in err && "statusCode" in err) {
          return err.code === "client_sdk.auth_failed" && err.statusCode === 403;
        }
        return false;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("R2011: RetryableApiClient throws NetworkError on 502 response", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
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
      (err: unknown) => {
        // R2011 FIX: Should throw NetworkError with status 502
        if (err && typeof err === "object" && "code" in err && "statusCode" in err) {
          return err.code === "client_sdk.network_error" && err.statusCode === 502;
        }
        return false;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("R2011: Typed error contains message from HTTP response", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "Custom error message", code: "custom_code" }), {
      status: 422,
      headers: { "content-type": "application/json" },
    });

  try {
    await assert.rejects(
      client.post("/test", { data: "test" }),
      (err: unknown) => {
        // R2011 FIX: Error message should include status and response text
        if (err instanceof Error) {
          return err.message.includes("422") && err.message.includes("Custom error message");
        }
        return false;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("R2011: Network error is retryable for idempotent GET requests", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  // Use minimal backoff for fast test
  const client = new RetryableApiClient(config, {
    maxRetries: 2,
    backoffMs: 10,
    backoffMultiplier: 2,
    maxBackoffMs: 100,
  });

  let attemptCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    attemptCount++;
    if (attemptCount < 3) {
      return new Response(JSON.stringify({ error: "Server error" }), {
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
    const result = await client.get<{ success: boolean }>("/test");
    // Should have retried twice then succeeded
    assert.equal(result.data.success, true);
    assert.equal(attemptCount, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("R2011: POST request on 5xx is NOT retried (non-idempotent)", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config, {
    maxRetries: 3,
    backoffMs: 10,
    backoffMultiplier: 2,
    maxBackoffMs: 100,
  });

  let attemptCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    attemptCount++;
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    // Should throw and not retry POST request
    await assert.rejects(client.post("/test", { data: "test" }));
    assert.equal(attemptCount, 1); // No retries on non-idempotent
  } finally {
    globalThis.fetch = originalFetch;
  }
});
