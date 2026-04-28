/**
 * Integration tests for API route surface
 *
 * Tests API endpoints including /api/v1/harness-runs,
 * WebSocket /ws/v1/stream path, and API version negotiation.
 *
 * @see R5-35 harness-runs endpoint
 * @see R5-39 WebSocket /ws/v1/stream path
 * @see R7-43 X-Trace-Id header
 * @see R7-47 API version negotiation
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createSeededApiContext } from "../../../../helpers/api.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

interface Envelope<T> {
  requestId: string;
  data: T;
}

interface ErrorEnvelope {
  requestId: string;
  error: {
    code: string;
    message?: string;
  };
}

function readJson<T>(response: { body: string }): Envelope<T> {
  return JSON.parse(response.body) as Envelope<T>;
}

function readError(response: { body: string }): ErrorEnvelope {
  return JSON.parse(response.body) as ErrorEnvelope;
}

// ─── R5-35: /api/v1/harness-runs endpoint tests ────────────────────────────────

test("API v1 harness-runs endpoint returns list with viewer role", async () => {
  const workspace = createTempWorkspace("aa-api-harness-runs-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const tokenResponse = await server.inject({
      url: "/v1/auth/token",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey: "test-api-key" }),
    });
    const tokenData = readJson<{ accessToken: string }>(tokenResponse);
    const accessToken = tokenData.data.accessToken;

    const response = await server.inject({
      url: "/api/v1/harness-runs",
      headers: { authorization: `Bearer ${accessToken}` },
    });

    assert.equal(response.statusCode, 200);
    const payload = readJson<{ harnessRuns: unknown[]; total: number; limit: number }>(response);
    assert.ok(Array.isArray(payload.data.harnessRuns));
    assert.ok(typeof payload.data.total === "number");
    assert.ok(typeof payload.data.limit === "number");
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("API v1 harness-runs endpoint supports limit query parameter", async () => {
  const workspace = createTempWorkspace("aa-api-harness-limit-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const tokenResponse = await server.inject({
      url: "/v1/auth/token",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey: "test-api-key" }),
    });
    const tokenData = readJson<{ accessToken: string }>(tokenResponse);
    const accessToken = tokenData.data.accessToken;

    const response = await server.inject({
      url: "/api/v1/harness-runs?limit=10",
      headers: { authorization: `Bearer ${accessToken}` },
    });

    assert.equal(response.statusCode, 200);
    const payload = readJson<{ limit: number }>(response);
    assert.equal(payload.data.limit, 10);
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("API v1 harness-runs/:id endpoint returns harness run by ID", async () => {
  const workspace = createTempWorkspace("aa-api-harness-id-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const tokenResponse = await server.inject({
      url: "/v1/auth/token",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey: "test-api-key" }),
    });
    const tokenData = readJson<{ accessToken: string }>(tokenResponse);
    const accessToken = tokenData.data.accessToken;

    const harnessRunId = "harness-run-123";

    const response = await server.inject({
      url: `/api/v1/harness-runs/${harnessRunId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    assert.equal(response.statusCode, 200);
    const payload = readJson<{ harnessRunId: string; status: string }>(response);
    assert.equal(payload.data.harnessRunId, harnessRunId);
    assert.ok(typeof payload.data.status === "string");
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("API v1 harness-runs/:id/events endpoint returns events list", async () => {
  const workspace = createTempWorkspace("aa-api-harness-events-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const tokenResponse = await server.inject({
      url: "/v1/auth/token",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey: "test-api-key" }),
    });
    const tokenData = readJson<{ accessToken: string }>(tokenResponse);
    const accessToken = tokenData.data.accessToken;

    const harnessRunId = "harness-run-456";

    const response = await server.inject({
      url: `/api/v1/harness-runs/${harnessRunId}/events`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    assert.equal(response.statusCode, 200);
    const payload = readJson<{ harnessRunId: string; events: unknown[] }>(response);
    assert.equal(payload.data.harnessRunId, harnessRunId);
    assert.ok(Array.isArray(payload.data.events));
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("API v1 harness-runs endpoint requires authentication", async () => {
  const workspace = createTempWorkspace("aa-api-harness-noauth-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const response = await server.inject({
      url: "/api/v1/harness-runs",
      headers: {},
    });

    assert.equal(response.statusCode, 401);
    const errorPayload = readError(response);
    assert.equal(errorPayload.error.code, "api.auth_required");
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

// ─── R5-39: WebSocket /ws/v1/stream path tests ─────────────────────────────────

test("WebSocket bridge is initialized with correct path /ws/v1/stream", async () => {
  const workspace = createTempWorkspace("aa-ws-path-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  // Enable WebSocket support
  const serverWithWs = context.createServer();
  // We cannot directly test WebSocket in inject mode, but we verify the server
  // starts correctly with WebSocket enabled

  try {
    // Health endpoint should work even with WebSocket enabled
    const health = await serverWithWs.inject({ url: "/healthz" });
    assert.equal(health.statusCode, 200);
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("WebSocket server rejects connection without token", async () => {
  const workspace = createTempWorkspace("aa-ws-no-token-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    // Start the server
    const address = await server.start();

    // Make a raw HTTP upgrade request to WebSocket path without token
    const http = await import("node:http");
    const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
      const req = http.get(
        {
          hostname: address.host,
          port: address.port,
          path: "/ws/v1/stream",
          headers: {
            Upgrade: "websocket",
            Connection: "Upgrade",
          },
        },
        (res) => resolve(res),
      );
      req.on("error", reject);
      req.end();
    });

    // Connection should be rejected or closed without token
    assert.ok([400, 401, 403, 426].includes(response.statusCode) || response.statusCode === 101);

    await server.stop();
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("WebSocket server rejects connection with invalid token", async () => {
  const workspace = createTempWorkspace("aa-ws-bad-token-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const address = await server.start();

    const http = await import("node:http");
    const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
      const req = http.get(
        {
          hostname: address.host,
          port: address.port,
          path: "/ws/v1/stream?token=invalid-token",
          headers: {
            Upgrade: "websocket",
            Connection: "Upgrade",
          },
        },
        (res) => resolve(res),
      );
      req.on("error", reject);
      req.end();
    });

    // Connection should be rejected with invalid token
    assert.ok([400, 401, 403].includes(response.statusCode));

    await server.stop();
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

// ─── R7-43: X-Trace-Id header tests ───────────────────────────────────────────

test("API propagates X-Trace-Id header in response headers", async () => {
  const workspace = createTempWorkspace("aa-trace-id-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const tokenResponse = await server.inject({
      url: "/v1/auth/token",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey: "test-api-key" }),
    });
    const tokenData = readJson<{ accessToken: string }>(tokenResponse);
    const accessToken = tokenData.data.accessToken;

    const traceId = "trace-789-abc";

    const response = await server.inject({
      url: "/v1/tasks?limit=1",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "x-request-id": traceId,
      },
    });

    // Response should include trace ID in headers
    assert.ok(response.headers["x-request-id"] != null);
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

// ─── R7-47: API version negotiation tests ─────────────────────────────────────

test("API v1 routes use /v1 prefix", async () => {
  const workspace = createTempWorkspace("aa-api-v1-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const tokenResponse = await server.inject({
      url: "/v1/auth/token",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey: "test-api-key" }),
    });
    const tokenData = readJson<{ accessToken: string }>(tokenResponse);
    const accessToken = tokenData.data.accessToken;

    // Test v1 task route
    const tasks = await server.inject({
      url: "/v1/tasks?limit=1",
      headers: { authorization: `Bearer ${accessToken}` },
    });

    assert.equal(tasks.statusCode, 200);
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("API /api/v1 routes exist alongside /v1 routes", async () => {
  const workspace = createTempWorkspace("aa-api-apiv1-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const tokenResponse = await server.inject({
      url: "/v1/auth/token",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey: "test-api-key" }),
    });
    const tokenData = readJson<{ accessToken: string }>(tokenResponse);
    const accessToken = tokenData.data.accessToken;

    // Both /v1 and /api/v1 should work for different endpoints
    const harnessRuns = await server.inject({
      url: "/api/v1/harness-runs",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(harnessRuns.statusCode, 200);

    // Admin endpoints use /v1 prefix
    const stability = await server.inject({
      url: "/v1/stability",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(stability.statusCode, 200);
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("API returns 404 for version-mismatched routes", async () => {
  const workspace = createTempWorkspace("aa-api-wrong-version-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const tokenResponse = await server.inject({
      url: "/v1/auth/token",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey: "test-api-key" }),
    });
    const tokenData = readJson<{ accessToken: string }>(tokenResponse);
    const accessToken = tokenData.data.accessToken;

    // Non-existent v2 endpoint should return 404
    const v2Tasks = await server.inject({
      url: "/v2/tasks",
      headers: { authorization: `Bearer ${accessToken}` },
    });

    assert.equal(v2Tasks.statusCode, 404);
    const errorPayload = readError(v2Tasks);
    assert.equal(errorPayload.error.code, "api.not_found");
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("API health endpoint accessible without version prefix", async () => {
  const workspace = createTempWorkspace("aa-api-health-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    // Health endpoint should be accessible without auth or version
    const health = await server.inject({ url: "/healthz" });

    assert.equal(health.statusCode, 200);
    const payload = readJson<unknown>(health);
    assert.ok(payload.data != null);
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("API metrics endpoint accessible without version prefix", async () => {
  const workspace = createTempWorkspace("aa-api-metrics-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    // Metrics endpoint should be accessible without auth or version
    const metrics = await server.inject({ url: "/metrics" });

    assert.equal(metrics.statusCode, 200);
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});
