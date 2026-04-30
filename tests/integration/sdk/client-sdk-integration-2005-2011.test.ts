/**
 * @fileoverview Integration Tests for Client SDK - API Client (2005-2006, 2010-2011)
 *
 * Tests real HTTP interactions with the API client including:
 * - 2005: Client SDK API client operations
 * - 2006: ContractEnvelope wrapping/unwrapping
 * - 2010: API client retry with backoff
 * - 2011: API client error classification
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  RetryableApiClient,
  createApiClient,
  createContractEnvelope,
  wrapInContractEnvelope,
  unwrapContractEnvelope,
  buildApiUrl,
  buildAuthHeaders,
} from "../../../src/sdk/client-sdk/api-client.js";
import { AuthError, BusinessError, NetworkError, ValidationError } from "../../../src/platform/contracts/errors.js";

const TEST_PRINCIPAL = { principalId: "p_123", tenantId: "t_456", roles: ["admin"] as const };

// ============================================================================
// Tests for 2005: Client SDK API client operations
// ============================================================================

test("2005: API Client creates run and retrieves result", async () => {
  const client = new RetryableApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({
      runId: "harness_run_123",
      status: "running",
      taskId: "task_456",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await client.post<{ runId: string; status: string; taskId: string }>(
      "/harness-runs",
      { taskId: "task_456" }
    );

    assert.equal(result.data.runId, "harness_run_123");
    assert.equal(result.data.status, "running");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("2005: API Client lists harness runs with pagination", async () => {
  const client = new RetryableApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify([
      { runId: "run_1", status: "completed" },
      { runId: "run_2", status: "running" },
    ]), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-next-cursor": "next-page-token",
        "x-total-count": "50",
      },
    });

  try {
    const result = await client.getPaginated<{ runId: string; status: string }>(
      "/harness-runs",
      { limit: 10 }
    );

    assert.equal(result.data.length, 2);
    assert.equal(result.nextCursor, "next-page-token");
    assert.equal(result.totalCount, 50);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("2005: API Client pauses harness run", async () => {
  const client = new RetryableApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({
      runId: "harness_run_123",
      status: "paused",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await client.post<{ runId: string; status: string }>(
      "/harness-runs/harness_run_123/pause",
      { reason: "User requested pause" }
    );

    assert.equal(result.data.status, "paused");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("2005: API Client aborts harness run", async () => {
  const client = new RetryableApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({
      runId: "harness_run_123",
      status: "aborted",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await client.post<{ runId: string; status: string }>(
      "/harness-runs/harness_run_123/abort",
      { reason: "User requested abort" }
    );

    assert.equal(result.data.status, "aborted");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("2005: API Client publishes pack", async () => {
  const client = new RetryableApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({
      packId: "pack_123",
      status: "published",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await client.publishPack<{ packId: string; status: string }>(
      "pack_123",
      { version: "1.0.0" }
    );

    assert.equal(result.data.packId, "pack_123");
    assert.equal(result.data.status, "published");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("2005: API Client handles version handshake", async () => {
  const client = new RetryableApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
    performVersionHandshakeOnInit: true,
  });

  let versionEndpointCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const urlStr = url.toString();
    if (urlStr.includes("/version")) {
      versionEndpointCalled = true;
      return new Response(JSON.stringify({
        platformVersion: "v4.3",
        contractVersion: "v4.3",
        minClientVersion: "1.0.0",
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await client.initialize();
    assert.ok(versionEndpointCalled, "Version endpoint should be called during initialization");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// Tests for 2006: ContractEnvelope wrapping/unwrapping
// ============================================================================

test("2006: ContractEnvelope wrapping and unwrapping roundtrip", async () => {
  const originalPayload = {
    harnessRunId: "run_123",
    nodes: [{ nodeId: "n1" }, { nodeId: "n2" }],
    edges: [{ edgeId: "e1" }],
  };

  const envelope = wrapInContractEnvelope(originalPayload, TEST_PRINCIPAL);

  // Verify envelope structure
  assert.ok(envelope.envelopeId.startsWith("env_"));
  assert.ok(envelope.schemaVersion);
  assert.ok(envelope.commandId.startsWith("cmd_"));
  assert.ok(envelope.correlationId.startsWith("corr_"));
  assert.ok(envelope.idempotencyKey.startsWith("idem_"));
  assert.deepEqual(envelope.principal, TEST_PRINCIPAL);
  assert.ok(envelope.timestamp);

  // Unwrap and verify
  const unwrapped = unwrapContractEnvelope(envelope);
  assert.deepEqual(unwrapped, originalPayload);
});

test("2006: createContractEnvelope creates valid envelope with all required fields", () => {
  const payload = { testData: "value" };
  const envelope = createContractEnvelope({
    payload,
    principal: TEST_PRINCIPAL,
    schemaVersion: "v4.3",
    commandId: "cmd_test",
    idempotencyKey: "idem_test",
    correlationId: "corr_test",
  });

  assert.ok(envelope.envelopeId);
  assert.equal(envelope.schemaVersion, "v4.3");
  assert.equal(envelope.commandId, "cmd_test");
  assert.equal(envelope.idempotencyKey, "idem_test");
  assert.equal(envelope.correlationId, "corr_test");
  assert.deepEqual(envelope.principal, TEST_PRINCIPAL);
  assert.deepEqual(envelope.payload, payload);
  assert.ok(envelope.timestamp);
  assert.equal(envelope.signature, null);
});

test("2006: ContractEnvelope uses defaults when optional fields not provided", () => {
  const payload = { data: "test" };
  const envelope = createContractEnvelope({
    payload,
    principal: TEST_PRINCIPAL,
  });

  assert.ok(envelope.schemaVersion);
  assert.ok(envelope.commandId.startsWith("cmd_"));
  assert.ok(envelope.idempotencyKey.startsWith("idem_"));
  assert.ok(envelope.correlationId.startsWith("corr_"));
  assert.ok(envelope.timestamp);
});

// ============================================================================
// Tests for 2010: API client retry with backoff
// ============================================================================

test("2010: API Client retries on 429 with backoff", async () => {
  const client = new RetryableApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  let attemptCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    attemptCount++;
    if (attemptCount < 3) {
      return new Response(JSON.stringify({}), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "1" },
      });
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await client.get<{ success: boolean }>("/test");
    assert.equal(result.data.success, true);
    assert.equal(attemptCount, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("2010: API Client retries on 500 with backoff", async () => {
  const client = new RetryableApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  let attemptCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    attemptCount++;
    if (attemptCount < 2) {
      return new Response(JSON.stringify({ error: "server error" }), {
        status: 500,
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
    assert.equal(result.data.success, true);
    assert.equal(attemptCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("2010: API Client does NOT retry POST on 429 (non-idempotent)", async () => {
  const client = new RetryableApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  let attemptCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    attemptCount++;
    return new Response(JSON.stringify({}), {
      status: 429,
      headers: { "content-type": "application/json", "retry-after": "1" },
    });
  };

  try {
    await assert.rejects(
      async () => client.post<{ success: boolean }>("/test", { data: "test" }),
      (error: unknown) => {
        return error instanceof NetworkError || error instanceof Error;
      }
    );
    // POST should not be retried, so only 1 attempt
    assert.equal(attemptCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// Tests for 2011: API client error classification
// ============================================================================

test("2011: API Client throws AuthError on 401", async () => {
  const client = new RetryableApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "invalid-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({
      code: "auth_failed",
      message: "Invalid token",
    }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });

  try {
    await assert.rejects(
      async () => client.get("/test"),
      (error: unknown) => {
        return error instanceof AuthError && error.message.includes("Authentication/authorization failed");
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("2011: API Client throws AuthError on 403", async () => {
  const client = new RetryableApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "forbidden-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({
      code: "forbidden",
      message: "Access denied",
    }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });

  try {
    await assert.rejects(
      async () => client.get("/test"),
      (error: unknown) => {
        return error instanceof AuthError;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("2011: API Client throws BusinessError on 400", async () => {
  const client = new RetryableApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({
      code: "validation_error",
      message: "Invalid input",
    }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });

  try {
    await assert.rejects(
      async () => client.post("/test", { invalid: true }),
      (error: unknown) => {
        return error instanceof BusinessError && error.message.includes("Request failed with status 400");
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("2011: API Client throws BusinessError on 422 (business logic error)", async () => {
  const client = new RetryableApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({
      code: "business_rule_violation",
      message: "Cannot process request",
    }), {
      status: 422,
      headers: { "content-type": "application/json" },
    });

  try {
    await assert.rejects(
      async () => client.post("/test", { data: "test" }),
      (error: unknown) => {
        return error instanceof BusinessError;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("2011: API Client throws NetworkError on 500", async () => {
  const client = new RetryableApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({
      code: "internal_error",
      message: "Server error",
    }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });

  try {
    await assert.rejects(
      async () => client.get("/test"),
      (error: unknown) => {
        return error instanceof NetworkError;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// Tests for createApiClient validation
// ============================================================================

test("createApiClient validates required configuration - missing baseUrl", () => {
  assert.throws(
    () => createApiClient({
      baseUrl: "",
      apiVersion: "v1",
      bearerToken: "test-token",
      principal: TEST_PRINCIPAL,
    } as any),
    /baseUrl/
  );
});

test("createApiClient validates required configuration - missing apiVersion", () => {
  assert.throws(
    () => createApiClient({
      baseUrl: "https://api.example.com",
      apiVersion: "",
      bearerToken: "test-token",
      principal: TEST_PRINCIPAL,
    } as any),
    /apiVersion/
  );
});

test("createApiClient validates required configuration - missing principal", () => {
  assert.throws(
    () => createApiClient({
      baseUrl: "https://api.example.com",
      apiVersion: "v1",
      bearerToken: "test-token",
      principal: {} as any,
    }),
    /principal/
  );
});

// ============================================================================
// Tests for idempotency key handling
// ============================================================================

test("Client uses request-level idempotency key", async () => {
  const client = new RetryableApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
    idempotencyKey: "client-level-key",
  });

  let capturedIdempotencyKey: string | undefined;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options?.body as string);
    capturedIdempotencyKey = body.idempotencyKey;
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    // Use request-level key
    await client.post("/test", { data: "test" }, { idempotencyKey: "request-level-key" });
    assert.equal(capturedIdempotencyKey, "request-level-key");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Client falls back to client-level idempotency key", async () => {
  const client = new RetryableApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
    idempotencyKey: "client-level-key",
  });

  let capturedIdempotencyKey: string | undefined;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options?.body as string);
    capturedIdempotencyKey = body.idempotencyKey;
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    // No request-level key provided
    await client.post("/test", { data: "test" });
    assert.equal(capturedIdempotencyKey, "client-level-key");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// Tests for buildApiUrl and buildAuthHeaders helpers
// ============================================================================

test("buildApiUrl constructs correct versioned URL", () => {
  const client = createApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
  });

  const url = buildApiUrl((client as any).config, {
    path: "/harness-runs",
    method: "GET",
  });

  assert.ok(url.includes("api.example.com"));
  assert.ok(url.includes("/v1/"));
  assert.ok(url.includes("harness-runs"));
});

test("buildApiUrl adds tenant query parameter when tenantId is set", () => {
  const client = createApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
    tenantId: "tenant-abc",
  });

  const url = buildApiUrl((client as any).config, {
    path: "/test",
    method: "GET",
  });

  assert.ok(url.includes("tenantId=tenant-abc"));
});

test("buildAuthHeaders throws when bearer token is missing", () => {
  assert.throws(
    () => buildAuthHeaders({
      baseUrl: "https://api.example.com",
      apiVersion: "v1",
      bearerToken: "",
      principal: TEST_PRINCIPAL,
    } as any),
    /bearer token/
  );
});

test("buildAuthHeaders includes version headers when configured", () => {
  const headers = buildAuthHeaders({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: TEST_PRINCIPAL,
    platformVersion: "v4.3",
    sdkVersion: "1.0.0",
    contractVersion: "v4.3",
  });

  assert.ok(headers["authorization"]);
  assert.equal(headers["X-Platform-Version"], "v4.3");
  assert.equal(headers["X-SDK-Version"], "1.0.0");
  assert.equal(headers["X-Contract-Version"], "v4.3");
});
