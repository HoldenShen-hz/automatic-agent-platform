import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../../src/platform/contracts/errors.js";
import {
  buildApiUrl,
  buildAuthHeaders,
  createApiClient,
  parseCursor,
  encodeCursor,
  RetryableApiClient,
  ApiClientConfig,
  ApiRequestSpec,
} from "../../../src/sdk/client-sdk/index.js";

const mockPrincipal = {
  subject: "user-123",
  tenantId: "tenant-123",
  roles: ["operator"],
};

test("buildApiUrl constructs versioned URL with trailing slash normalization", () => {
  const config: ApiClientConfig = { baseUrl: "https://api.example.com/", apiVersion: "/v1/" };
  const request: ApiRequestSpec = { path: "/users" };
  assert.equal(buildApiUrl(config, request), "https://api.example.com/api/v1/users");
});

test("buildApiUrl appends query parameters", () => {
  const config: ApiClientConfig = { baseUrl: "https://api.example.com", apiVersion: "v1" };
  const request: ApiRequestSpec = { path: "/users", query: { page: 1, active: true, name: "Alice" } };
  const url = buildApiUrl(config, request);
  assert.ok(url.includes("page=1"));
  assert.ok(url.includes("active=true"));
  assert.ok(url.includes("name=Alice"));
});

test("buildApiUrl omits null and undefined query values", () => {
  const config: ApiClientConfig = { baseUrl: "https://api.example.com", apiVersion: "v1" };
  const request: ApiRequestSpec = { path: "/users", query: { a: null, b: undefined, c: 1 } };
  const url = buildApiUrl(config, request);
  assert.ok(url.includes("c=1"));
  assert.ok(!url.includes("a="));
  assert.ok(!url.includes("b="));
});

test("buildApiUrl adds tenantId when present", () => {
  const config: ApiClientConfig = { baseUrl: "https://api.example.com", apiVersion: "v1", tenantId: " tenant-123 " };
  const request: ApiRequestSpec = { path: "/users" };
  const url = buildApiUrl(config, request);
  assert.ok(url.includes("tenantId=tenant-123"));
});

test("buildApiUrl does not add empty tenantId", () => {
  const config: ApiClientConfig = { baseUrl: "https://api.example.com", apiVersion: "v1", tenantId: "   " };
  const request: ApiRequestSpec = { path: "/users" };
  const url = buildApiUrl(config, request);
  assert.ok(!url.includes("tenantId="));
});

test("buildAuthHeaders throws ValidationError when bearer token is missing", () => {
  const config: ApiClientConfig = { baseUrl: "https://api.example.com", apiVersion: "v1" };
  assert.throws(
    () => buildAuthHeaders(config),
    (error: unknown) => error instanceof ValidationError && error.code === "client_sdk.missing_bearer_token",
  );
});

test("buildAuthHeaders throws ValidationError when bearer token is whitespace only", () => {
  const config: ApiClientConfig = { baseUrl: "https://api.example.com", apiVersion: "v1", bearerToken: "   " };
  assert.throws(
    () => buildAuthHeaders(config),
    (error: unknown) => error instanceof ValidationError && error.code === "client_sdk.missing_bearer_token",
  );
});

test("buildAuthHeaders returns authorization header with trimmed token", () => {
  const config: ApiClientConfig = { baseUrl: "https://api.example.com", apiVersion: "v1", bearerToken: "  token-abc  " };
  const headers = buildAuthHeaders(config);
  assert.equal(headers["authorization"], "Bearer token-abc");
});

test("createApiClient throws ValidationError when baseUrl is missing", () => {
  const config: ApiClientConfig = { baseUrl: "", apiVersion: "v1" };
  assert.throws(
    () => createApiClient(config),
    (error: unknown) => error instanceof ValidationError && error.code === "client_sdk.missing_base_url",
  );
});

test("createApiClient throws ValidationError when baseUrl is whitespace only", () => {
  const config: ApiClientConfig = { baseUrl: "   ", apiVersion: "v1" };
  assert.throws(
    () => createApiClient(config),
    (error: unknown) => error instanceof ValidationError && error.code === "client_sdk.missing_base_url",
  );
});

test("createApiClient throws ValidationError when apiVersion is missing", () => {
  const config: ApiClientConfig = { baseUrl: "https://api.example.com", apiVersion: "" };
  assert.throws(
    () => createApiClient(config),
    (error: unknown) => error instanceof ValidationError && error.code === "client_sdk.missing_api_version",
  );
});

test("createApiClient throws ValidationError when apiVersion is whitespace only", () => {
  const config: ApiClientConfig = { baseUrl: "https://api.example.com", apiVersion: "   " };
  assert.throws(
    () => createApiClient(config),
    (error: unknown) => error instanceof ValidationError && error.code === "client_sdk.missing_api_version",
  );
});

test("createApiClient returns RetryableApiClient with valid config", () => {
  const config: ApiClientConfig = { baseUrl: "https://api.example.com", apiVersion: "v1", principal: mockPrincipal };
  const client = createApiClient(config);
  assert.ok(client instanceof RetryableApiClient);
});

test("parseCursor returns undefined for null input", () => {
  assert.equal(parseCursor(null), undefined);
});

test("parseCursor returns undefined for undefined input", () => {
  assert.equal(parseCursor(undefined), undefined);
});

test("parseCursor returns undefined for empty string", () => {
  assert.equal(parseCursor(""), undefined);
});

test("parseCursor returns undefined for whitespace string", () => {
  assert.equal(parseCursor("   "), undefined);
});

test("parseCursor returns undefined for invalid base64", () => {
  assert.equal(parseCursor("not-valid-base64!!!"), undefined);
});

test("parseCursor returns undefined for valid base64 that is not JSON", () => {
  assert.equal(parseCursor("bm90LWpzb24="), undefined); // "not-json" base64 encoded
});

test("parseCursor decodes valid base64 encoded JSON cursor", () => {
  const pagination = { cursor: "abc123", limit: 50 };
  const encoded = Buffer.from(JSON.stringify(pagination)).toString("base64");
  const result = parseCursor(encoded);
  assert.deepEqual(result, pagination);
});

test("parseCursor decodes cursor-only pagination spec", () => {
  const pagination = { cursor: "page-2" };
  const encoded = Buffer.from(JSON.stringify(pagination)).toString("base64");
  const result = parseCursor(encoded);
  assert.deepEqual(result, pagination);
});

test("parseCursor decodes limit-only pagination spec", () => {
  const pagination = { limit: 25 };
  const encoded = Buffer.from(JSON.stringify(pagination)).toString("base64");
  const result = parseCursor(encoded);
  assert.deepEqual(result, pagination);
});

test("encodeCursor encodes pagination spec to base64", () => {
  const pagination = { cursor: "xyz", limit: 100 };
  const encoded = encodeCursor(pagination);
  const decoded = Buffer.from(encoded, "base64").toString("utf-8");
  assert.deepEqual(JSON.parse(decoded), pagination);
});

test("encodeCursor and parseCursor are inverses", () => {
  const original: { cursor?: string; limit?: number } = { cursor: "cursor-abc", limit: 50 };
  const encoded = encodeCursor(original);
  const decoded = parseCursor(encoded);
  assert.deepEqual(decoded, original);
});

test("encodeCursor with only cursor roundtrips correctly", () => {
  const original = { cursor: "next-page" };
  const encoded = encodeCursor(original);
  const decoded = parseCursor(encoded);
  assert.deepEqual(decoded, original);
});

test("encodeCursor with only limit roundtrips correctly", () => {
  const original = { limit: 10 };
  const encoded = encodeCursor(original);
  const decoded = parseCursor(encoded);
  assert.deepEqual(decoded, original);
});

test("RetryableApiClient get method returns ApiResponse", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config);

  // Mock fetch globally
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ id: 1, name: "test" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await client.get<{ id: number; name: string }>("/users/1");
    assert.equal(result.status, 200);
    assert.deepEqual(result.data, { id: 1, name: "test" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient post method sends body and returns ApiResponse", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ id: 1 }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await client.post<{ id: number }>("/users", { name: "Alice" });
    assert.equal(result.status, 201);
    assert.deepEqual(result.data, { id: 1 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient put method sends body and returns ApiResponse", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ id: 1, name: "Bob" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await client.put<{ id: number; name: string }>("/users/1", { name: "Bob" });
    assert.equal(result.status, 200);
    assert.deepEqual(result.data, { id: 1, name: "Bob" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient delete method returns ApiResponse", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("null", { status: 200, headers: { "content-type": "application/json" } });

  try {
    const result = await client.delete<null>("/users/1");
    assert.equal(result.status, 200);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient getPaginated returns PaginatedResponse", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify([{ id: 1 }, { id: 2 }]), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-next-cursor": "next-page-token",
        "x-total-count": "42",
      },
    });

  try {
    const result = await client.getPaginated<{ id: number }>("/users", { cursor: "abc", limit: 20 });
    assert.deepEqual(result.data, [{ id: 1 }, { id: 2 }]);
    assert.equal(result.status, 200);
    assert.equal(result.nextCursor, "next-page-token");
    assert.equal(result.totalCount, 42);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient getPaginated with no pagination spec omits query params", async () => {
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
    await client.getPaginated<{ id: number }>("/users");
    assert.ok(capturedUrl !== undefined);
    assert.ok(!capturedUrl!.includes("cursor="));
    assert.ok(!capturedUrl!.includes("limit="));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient response headers are captured correctly", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-request-id": "req-123",
        "x-rate-limit": "100",
      },
    });

  try {
    const result = await client.get<{ success: boolean }>("/test");
    assert.equal(result.headers["x-request-id"], "req-123");
    assert.equal(result.headers["x-rate-limit"], "100");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient throws on network error when max retries exhausted", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    maxRetries: 0,
  };
  const client = new RetryableApiClient(config, { maxRetries: 0, backoffMs: 10, backoffMultiplier: 2, maxBackoffMs: 100 });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Network failure");
  };

  try {
    await assert.rejects(client.get("/test"), (error: unknown) => error instanceof Error && error.message === "Network failure");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient retries on HTTP 5xx and succeeds on subsequent attempt", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config, { maxRetries: 3, backoffMs: 10, backoffMultiplier: 2, maxBackoffMs: 100 });

  let attemptCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    attemptCount++;
    if (attemptCount === 1) {
      return new Response(JSON.stringify({ error: "Server error" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ id: 1, name: "test" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await client.get<{ id: number; name: string }>("/users/1");
    assert.equal(result.status, 200);
    assert.deepEqual(result.data, { id: 1, name: "test" });
    assert.equal(attemptCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient throws after max retries exhausted on persistent 5xx", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config, { maxRetries: 2, backoffMs: 10, backoffMultiplier: 2, maxBackoffMs: 100 });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "Server error" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });

  try {
    await assert.rejects(
      client.get("/users/1"),
      (error: unknown) => error instanceof Error && "code" in error && error.code === "client_sdk.network_error",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient applies timeout signal when timeoutMs configured", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    timeoutMs: 5000,
  };
  const client = new RetryableApiClient(config);

  let capturedSignal: AbortSignal | undefined;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    capturedSignal = options?.signal as AbortSignal | undefined;
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await client.get<{ success: boolean }>("/test");
    assert.ok(capturedSignal instanceof AbortSignal);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient does NOT retry POST on 5xx errors", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config, { maxRetries: 3, backoffMs: 10, backoffMultiplier: 2, maxBackoffMs: 100 });

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
    await assert.rejects(client.post("/users", { name: "Alice" }));
    // POST should not be retried, so only 1 attempt
    assert.equal(attemptCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient does NOT retry DELETE on 5xx errors", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config, { maxRetries: 3, backoffMs: 10, backoffMultiplier: 2, maxBackoffMs: 100 });

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
    // DELETE should not be retried, so only 1 attempt
    assert.equal(attemptCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient does NOT retry PUT on 5xx errors", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config, { maxRetries: 3, backoffMs: 10, backoffMultiplier: 2, maxBackoffMs: 100 });

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
    await assert.rejects(client.put("/users/1", { name: "Bob" }));
    assert.equal(attemptCount, 4);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient does NOT retry PATCH on 5xx errors", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config, { maxRetries: 3, backoffMs: 10, backoffMultiplier: 2, maxBackoffMs: 100 });

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
    await assert.rejects(client.patch("/users/1", { name: "Charlie" }));
    assert.equal(attemptCount, 4);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient does NOT retry POST on network errors", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config, { maxRetries: 3, backoffMs: 10, backoffMultiplier: 2, maxBackoffMs: 100 });

  let attemptCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    attemptCount++;
    throw new Error("Transient network error");
  };

  try {
    await assert.rejects(client.post("/users", { name: "Alice" }), (error: unknown) => error instanceof Error && error.message === "Transient network error");
    // POST should not be retried on network errors, so only 1 attempt
    assert.equal(attemptCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient does NOT retry DELETE on network errors", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config, { maxRetries: 3, backoffMs: 10, backoffMultiplier: 2, maxBackoffMs: 100 });

  let attemptCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    attemptCount++;
    throw new Error("Transient network error");
  };

  try {
    await assert.rejects(client.delete("/users/1"), (error: unknown) => error instanceof Error && error.message === "Transient network error");
    // DELETE should not be retried on network errors, so only 1 attempt
    assert.equal(attemptCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient does NOT retry PUT on network errors", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config, { maxRetries: 3, backoffMs: 10, backoffMultiplier: 2, maxBackoffMs: 100 });

  let attemptCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    attemptCount++;
    throw new Error("Transient network error");
  };

  try {
    await assert.rejects(client.put("/users/1", { name: "Bob" }), (error: unknown) => error instanceof Error && error.message === "Transient network error");
    assert.equal(attemptCount, 4);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient does NOT retry PATCH on network errors", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config, { maxRetries: 3, backoffMs: 10, backoffMultiplier: 2, maxBackoffMs: 100 });

  let attemptCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    attemptCount++;
    throw new Error("Transient network error");
  };

  try {
    await assert.rejects(client.patch("/users/1", { name: "Charlie" }), (error: unknown) => error instanceof Error && error.message === "Transient network error");
    assert.equal(attemptCount, 4);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient retries GET on 5xx errors", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config, { maxRetries: 3, backoffMs: 10, backoffMultiplier: 2, maxBackoffMs: 100 });

  let attemptCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    attemptCount++;
    if (attemptCount === 1) {
      return new Response(JSON.stringify({ error: "Server error" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ id: 1, name: "test" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await client.get<{ id: number; name: string }>("/users/1");
    assert.equal(result.status, 200);
    assert.deepEqual(result.data, { id: 1, name: "test" });
    assert.equal(attemptCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient retries GET on network errors", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config, { maxRetries: 3, backoffMs: 10, backoffMultiplier: 2, maxBackoffMs: 100 });

  let attemptCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    attemptCount++;
    if (attemptCount === 1) {
      throw new Error("Transient network error");
    }
    return new Response(JSON.stringify({ id: 1 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await client.get<{ id: number }>("/users/1");
    assert.equal(result.status, 200);
    assert.deepEqual(result.data, { id: 1 });
    assert.equal(attemptCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient retries on network error and succeeds on subsequent attempt", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
  };
  const client = new RetryableApiClient(config, { maxRetries: 3, backoffMs: 10, backoffMultiplier: 2, maxBackoffMs: 100 });

  let attemptCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    attemptCount++;
    if (attemptCount === 1) {
      throw new Error("Transient network error");
    }
    return new Response(JSON.stringify({ id: 1 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await client.get<{ id: number }>("/users/1");
    assert.equal(result.status, 200);
    assert.deepEqual(result.data, { id: 1 });
    assert.equal(attemptCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("buildApiUrl normalizes multiple slashes in path", () => {
  const config: ApiClientConfig = { baseUrl: "https://api.example.com/", apiVersion: "/v1/" };
  const request: ApiRequestSpec = { path: "/users/posts" };
  const url = buildApiUrl(config, request);
  assert.equal(url, "https://api.example.com/api/v1/users/posts");
});

test("buildApiUrl normalizes baseUrl and apiVersion with extra slashes", () => {
  const config: ApiClientConfig = { baseUrl: "https://api.example.com///", apiVersion: "///v1///" };
  const request: ApiRequestSpec = { path: "/users" };
  const url = buildApiUrl(config, request);
  assert.equal(url, "https://api.example.com/api/v1/users");
});
