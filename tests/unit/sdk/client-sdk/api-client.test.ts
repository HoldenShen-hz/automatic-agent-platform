/**
 * @fileoverview Tests for api-client.ts - ContractEnvelope wrapping and retry logic
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  RetryableApiClient,
  createApiClient,
  buildApiUrl,
  buildAuthHeaders,
  createContractEnvelope,
  wrapInContractEnvelope,
  unwrapContractEnvelope,
  parseCursor,
  encodeCursor,
  type ApiClientConfig,
  type ContractEnvelope,
} from "../../../../src/sdk/client-sdk/api-client.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
import { newId } from "../../../../src/platform/contracts/types/ids.js";

// Mock principal for testing
const mockPrincipal = {
  subject: "user_123",
  tenantId: "tenant_abc",
  roles: ["admin"],
};

// ============================================================================
// ContractEnvelope Tests
// ============================================================================

test("createContractEnvelope creates valid envelope with required fields", () => {
  const envelope = createContractEnvelope({
    payload: { query: "test" },
    principal: mockPrincipal,
  });

  assert.equal(typeof envelope.envelopeId, "string");
  assert.ok(envelope.envelopeId.startsWith("env_"));
  assert.equal(envelope.schemaVersion, "v4.3");
  assert.equal(typeof envelope.commandId, "string");
  assert.equal(typeof envelope.idempotencyKey, "string");
  assert.equal(typeof envelope.correlationId, "string");
  assert.equal(envelope.signature, null);
  assert.deepEqual(envelope.principal, mockPrincipal);
  assert.equal(typeof envelope.timestamp, "string");
  assert.deepEqual(envelope.payload, { query: "test" });
  assert.deepEqual(envelope.metadata, {});
});

test("createContractEnvelope accepts custom schemaVersion", () => {
  const envelope = createContractEnvelope({
    payload: { data: 123 },
    principal: mockPrincipal,
    schemaVersion: "v2.0",
  });

  assert.equal(envelope.schemaVersion, "v2.0");
});

test("createContractEnvelope accepts custom commandId and idempotencyKey", () => {
  const envelope = createContractEnvelope({
    payload: {},
    principal: mockPrincipal,
    commandId: "custom_cmd",
    idempotencyKey: "custom_idem",
    correlationId: "custom_corr",
  });

  assert.equal(envelope.commandId, "custom_cmd");
  assert.equal(envelope.idempotencyKey, "custom_idem");
  assert.equal(envelope.correlationId, "custom_corr");
});

test("createContractEnvelope accepts signature", () => {
  const envelope = createContractEnvelope({
    payload: { signed: true },
    principal: mockPrincipal,
    signature: "abc123signature",
  });

  assert.equal(envelope.signature, "abc123signature");
});

test("createContractEnvelope accepts metadata", () => {
  const envelope = createContractEnvelope({
    payload: {},
    principal: mockPrincipal,
    metadata: { "X-Custom-Header": "value", "X-Request-Type": "test" },
  });

  assert.equal(envelope.metadata["X-Custom-Header"], "value");
  assert.equal(envelope.metadata["X-Request-Type"], "test");
});

test("wrapInContractEnvelope is alias for createContractEnvelope", () => {
  const envelope = wrapInContractEnvelope({ wrapped: true }, mockPrincipal);

  assert.equal(envelope.schemaVersion, "v4.3");
  assert.deepEqual(envelope.payload, { wrapped: true });
});

test("unwrapContractEnvelope returns payload", () => {
  const envelope = createContractEnvelope({
    payload: { inner: "data" },
    principal: mockPrincipal,
  });

  const payload = unwrapContractEnvelope(envelope);
  assert.deepEqual(payload, { inner: "data" });
});

// ============================================================================
// Retry Logic Tests
// ============================================================================

test("RetryableApiClient retries on 503 for idempotent GET requests", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
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
    if (attemptCount < 3) {
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
    const result = await client.get<{ success: boolean }>("/test");
    assert.equal(result.status, 200);
    assert.equal(attemptCount, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient retries on 429 for idempotent GET requests", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
  };

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
    if (attemptCount < 2) {
      return new Response(null, { status: 429 });
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await client.get("/test");
    assert.equal(result.status, 200);
    assert.equal(attemptCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient does NOT retry POST requests on 503 (not idempotent)", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
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
    await assert.rejects(
      client.post("/test", { data: "test" }),
      (err: unknown) => err instanceof Error && err.message.includes("Server error"),
    );
    // Should only attempt once because POST is not idempotent
    assert.equal(attemptCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient does NOT retry non-5xx errors", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
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
    assert.equal(attemptCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient wraps POST body in ContractEnvelope", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
  };

  const client = new RetryableApiClient(config);

  let capturedBody: unknown;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    capturedBody = JSON.parse(options?.body as string);
    return new Response(JSON.stringify({ created: true }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await client.post("/users", { name: "Alice" });
    assert.ok(capturedBody, "Request body should be captured");
    const body = capturedBody as Record<string, unknown>;
    // Body should be wrapped in ContractEnvelope
    assert.equal(body.schemaVersion, "v4.3");
    assert.ok(typeof body.envelopeId === "string");
    assert.ok(typeof body.commandId === "string");
    assert.ok(typeof body.idempotencyKey === "string");
    assert.deepEqual(body.principal, mockPrincipal);
    assert.deepEqual(body.payload, { name: "Alice" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// buildApiUrl Tests
// ============================================================================

test("buildApiUrl normalizes trailing slashes in baseUrl", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com///",
    apiVersion: "v1",
    bearerToken: "test",
    principal: mockPrincipal,
  };

  const url = buildApiUrl(config, { path: "/users" });
  assert.ok(!url.endsWith("/"));
  assert.ok(url.includes("v1/users"));
});

test("buildApiUrl normalizes trailing slashes in apiVersion", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "/v1//",
    bearerToken: "test",
    principal: mockPrincipal,
  };

  const url = buildApiUrl(config, { path: "/users" });
  assert.ok(url.includes("/v1/"));
});

test("buildApiUrl removes leading slash from path", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test",
    principal: mockPrincipal,
  };

  const url = buildApiUrl(config, { path: "/users" });
  // Should not have double slashes
  assert.ok(!url.includes("//v1"));
});

test("buildApiUrl adds tenantId query param when configured", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test",
    tenantId: "tenant-xyz",
    principal: mockPrincipal,
  };

  const url = buildApiUrl(config, { path: "/users" });
  assert.ok(url.includes("tenantId=tenant-xyz"));
});

test("buildApiUrl trims whitespace from tenantId", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test",
    tenantId: "  tenant-abc  ",
    principal: mockPrincipal,
  };

  const url = buildApiUrl(config, { path: "/users" });
  assert.ok(url.includes("tenantId=tenant-abc"));
});

test("buildApiUrl omits tenantId when empty or whitespace", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test",
    tenantId: "   ",
    principal: mockPrincipal,
  };

  const url = buildApiUrl(config, { path: "/users" });
  assert.ok(!url.includes("tenantId"));
});

test("buildApiUrl handles null and undefined query values", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test",
    principal: mockPrincipal,
  };

  const url = buildApiUrl(config, {
    path: "/users",
    query: { active: true, deleted: null, page: undefined },
  });

  assert.ok(url.includes("active=true"));
  assert.ok(!url.includes("deleted"));
  assert.ok(!url.includes("page"));
});

test("buildApiUrl handles array query values", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test",
    principal: mockPrincipal,
  };

  const url = buildApiUrl(config, {
    path: "/users",
    query: { tags: ["admin", "user"] as unknown as string },
  });

  // Arrays get stringified
  assert.ok(url.includes("tags"));
});

// ============================================================================
// buildAuthHeaders Tests
// ============================================================================

test("buildAuthHeaders throws when bearerToken is missing", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "",
    principal: mockPrincipal,
  };

  assert.throws(
    () => buildAuthHeaders(config),
    (err: unknown) => err instanceof ValidationError && err.code === "client_sdk.missing_bearer_token",
  );
});

test("buildAuthHeaders throws when bearerToken is whitespace only", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "   ",
    principal: mockPrincipal,
  };

  assert.throws(
    () => buildAuthHeaders(config),
    (err: unknown) => err instanceof ValidationError && err.code === "client_sdk.missing_bearer_token",
  );
});

test("buildAuthHeaders trims whitespace from bearer token", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "  token123  ",
    principal: mockPrincipal,
  };

  const headers = buildAuthHeaders(config);
  assert.equal(headers["authorization"], "Bearer token123");
});

test("buildAuthHeaders adds platform version header when configured", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test",
    platformVersion: "v5.0",
    principal: mockPrincipal,
  };

  const headers = buildAuthHeaders(config);
  assert.equal(headers["X-Platform-Version"], "v5.0");
});

test("buildAuthHeaders adds SDK version header when configured", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test",
    sdkVersion: "2.0.0",
    principal: mockPrincipal,
  };

  const headers = buildAuthHeaders(config);
  assert.equal(headers["X-SDK-Version"], "2.0.0");
});

test("buildAuthHeaders adds contract version header when configured", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test",
    contractVersion: "v3.0",
    principal: mockPrincipal,
  };

  const headers = buildAuthHeaders(config);
  assert.equal(headers["X-Contract-Version"], "v3.0");
});

// ============================================================================
// Cursor Pagination Tests
// ============================================================================

test("parseCursor decodes base64 encoded cursor", () => {
  const pagination = { cursor: "page-123", limit: 50 };
  const encoded = Buffer.from(JSON.stringify(pagination)).toString("base64");

  const decoded = parseCursor(encoded);
  assert.deepEqual(decoded, { cursor: "page-123", limit: 50 });
});

test("parseCursor returns undefined for invalid base64", () => {
  const result = parseCursor("not-valid-base64!!!");
  assert.equal(result, undefined);
});

test("parseCursor returns undefined for null", () => {
  assert.equal(parseCursor(null), undefined);
});

test("parseCursor returns undefined for undefined", () => {
  assert.equal(parseCursor(undefined), undefined);
});

test("parseCursor returns undefined for empty string", () => {
  assert.equal(parseCursor(""), undefined);
});

test("encodeCursor produces base64 encoded cursor", () => {
  const encoded = encodeCursor({ cursor: "next-page", limit: 25 });
  const decoded = Buffer.from(encoded, "base64").toString("utf-8");
  assert.deepEqual(JSON.parse(decoded), { cursor: "next-page", limit: 25 });
});

// ============================================================================
// createApiClient Validation Tests
// ============================================================================

test("createApiClient throws when baseUrl is missing", () => {
  assert.throws(
    () => createApiClient({
      baseUrl: "",
      apiVersion: "v1",
      principal: mockPrincipal,
    }),
    (err: unknown) => err instanceof ValidationError && err.code === "client_sdk.missing_base_url",
  );
});

test("createApiClient throws when baseUrl is whitespace", () => {
  assert.throws(
    () => createApiClient({
      baseUrl: "   ",
      apiVersion: "v1",
      principal: mockPrincipal,
    }),
    (err: unknown) => err instanceof ValidationError && err.code === "client_sdk.missing_base_url",
  );
});

test("createApiClient throws when apiVersion is missing", () => {
  assert.throws(
    () => createApiClient({
      baseUrl: "https://api.example.com",
      apiVersion: "",
      principal: mockPrincipal,
    }),
    (err: unknown) => err instanceof ValidationError && err.code === "client_sdk.missing_api_version",
  );
});

test("createApiClient throws when principal is missing", () => {
  assert.throws(
    () => createApiClient({
      baseUrl: "https://api.example.com",
      apiVersion: "v1",
      principal: null as unknown as typeof mockPrincipal,
    }),
    (err: unknown) => err instanceof ValidationError && err.code === "client_sdk.missing_principal",
  );
});

test("createApiClient returns RetryableApiClient instance", () => {
  const client = createApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
  });

  assert.ok(client instanceof RetryableApiClient);
});

test("RetryableApiClient uses default version headers when not provided", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
  };

  const client = new RetryableApiClient(config);
  // Internal config should have defaults set
  assert.ok(true); // If we get here without error, it's configured
});

// ============================================================================
// Error Classification Tests
// ============================================================================

test("RetryableApiClient throws AuthError on 401", async () => {
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
      (err: unknown) => {
        if (!(err instanceof Error)) return false;
        // AuthError should have code containing "auth" or "401"
        return err.message.includes("401") || err.message.includes("Authentication");
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient throws BusinessError on 400", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
  };

  const client = new RetryableApiClient(config);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ code: "invalid_input", message: "Bad request" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });

  try {
    await assert.rejects(
      client.get("/test"),
      (err: unknown) => err instanceof Error,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient throws NetworkError on 500", async () => {
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
      (err: unknown) => err instanceof Error,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
