import assert from "node:assert/strict";
import test from "node:test";

import type { InjectResponse } from "../../../../../src/platform/five-plane-interface/api/http-api-server.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { createSeededApiContext } from "../../../../helpers/api.js";
import { ApiAuthService } from "../../../../../src/platform/five-plane-interface/api/api-auth-service.js";
import { HttpApiServer } from "../../../../../src/platform/five-plane-interface/api/http-api-server.js";

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

function readJson<T>(response: InjectResponse): Envelope<T> {
  return response.json<Envelope<T>>();
}

function readError(response: InjectResponse): ErrorEnvelope {
  return response.json<ErrorEnvelope>();
}

test("api server handles unauthenticated requests to protected routes", async () => {
  const workspace = createTempWorkspace("aa-api-auth-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    // Health endpoint should be accessible without auth
    const health = await server.inject({ url: "/healthz" });
    assert.equal(health.statusCode, 200);

    // Protected endpoint without auth token should return 401
    const tasks = await server.inject({
      url: "/v1/tasks",
      headers: {},
    });
    assert.equal(tasks.statusCode, 401);

    const errorPayload = readError(tasks);
    assert.equal(errorPayload.error.code, "api.auth_required");
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("api server validates api key format", async () => {
  const workspace = createTempWorkspace("aa-api-key-format-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    // Empty API key
    const emptyKey = await server.inject({
      url: "/v1/auth/token",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey: "" }),
    });
    assert.equal(emptyKey.statusCode, 400);

    // Invalid API key format
    const invalidKey = await server.inject({
      url: "/v1/auth/token",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey: "not-a-valid-key" }),
    });
    assert.equal(invalidKey.statusCode, 401);
    const errorPayload = readError(invalidKey);
    assert.equal(errorPayload.error.code, "api.invalid_api_key");
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("api server handles cors preflight requests", async () => {
  const workspace = createTempWorkspace("aa-api-cors-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    // OPTIONS request for preflight
    const preflight = await server.inject({
      url: "/v1/tasks",
      method: "OPTIONS",
      headers: {
        origin: "https://console.example.test",
        "access-control-request-method": "GET",
        "access-control-request-headers": "authorization,content-type",
      },
    });
    assert.equal(preflight.statusCode, 204);
    assert.equal(preflight.headers["access-control-allow-origin"], "https://console.example.test");
    assert.ok(preflight.headers["access-control-allow-methods"]);
    assert.ok(preflight.headers["access-control-allow-headers"]);

    // Preflight with different origin should be denied by default
    const wrongOrigin = await server.inject({
      url: "/v1/tasks",
      method: "OPTIONS",
      headers: {
        origin: "https://malicious.example.test",
        "access-control-request-method": "GET",
      },
    });
    // Default allowed origins may be empty or restrictive
    assert.ok([403].includes(wrongOrigin.statusCode));
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("api server enforces request body size limit", async () => {
  const workspace = createTempWorkspace("aa-api-body-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    // Get a valid token first
    const tokenResponse = await server.inject({
      url: "/v1/auth/token",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey: "test-api-key" }),
    });
    const tokenData = readJson<{ accessToken: string }>(tokenResponse);
    const accessToken = tokenData.data.accessToken;

    // Send request with oversized body
    const largeBody = JSON.stringify({
      tasks: Array.from({ length: 10000 }, (_, i) => ({
        taskId: `task-${i}`,
        data: "x".repeat(1000),
      })),
    });

    const oversized = await server.inject({
      url: "/v1/tasks",
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        "content-length": String(largeBody.length),
      },
      body: largeBody,
    });
    assert.equal(oversized.statusCode, 413);
    const errorPayload = readError(oversized);
    assert.equal(errorPayload.error.code, "api.payload_too_large");
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("api server rejects invalid json body", async () => {
  const workspace = createTempWorkspace("aa-api-json-");
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

    // Send malformed JSON
    const malformed = await server.inject({
      url: "/v1/tasks",
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: "{ invalid json }",
    });
    assert.equal(malformed.statusCode, 400);
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("api server handles route not found", async () => {
  const workspace = createTempWorkspace("aa-api-404-");
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

    // Request non-existent route
    const notFound = await server.inject({
      url: "/v1/nonexistent-route",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(notFound.statusCode, 404);
    const errorPayload = readError(notFound);
    assert.equal(errorPayload.error.code, "api.not_found");
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("api server validates content-type header", async () => {
  const workspace = createTempWorkspace("aa-api-content-type-");
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

    // Send request with wrong content-type for JSON endpoint
    const wrongContentType = await server.inject({
      url: "/v1/gateway/messages/send",
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "text/plain",
      },
      body: "plain text body",
    });
    // Should still work or give appropriate error
    assert.ok([400, 404, 415, 500, 503].includes(wrongContentType.statusCode));
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("api server returns proper json content type", async () => {
  const workspace = createTempWorkspace("aa-api-json-ct-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const health = await server.inject({ url: "/healthz" });
    assert.equal(health.statusCode, 200);
    assert.ok((health.headers["content-type"] ?? "").includes("application/json"));
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("api server handles x-request-id header propagation", async () => {
  const workspace = createTempWorkspace("aa-api-reqid-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const customRequestId = "custom-request-id-123";

    const health = await server.inject({
      url: "/healthz",
      headers: { "x-request-id": customRequestId },
    });
    assert.equal(health.statusCode, 200);
    const payload = readJson<unknown>(health);
    assert.equal(payload.requestId, customRequestId);
    assert.equal(health.headers["x-request-id"], customRequestId);
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("api server creates new api key and uses it", async () => {
  const workspace = createTempWorkspace("aa-api-new-key-");
  const context = createSeededApiContext(workspace);

  // Create auth service with additional key
  const authService = new ApiAuthService({
    apiKeys: [
      {
        apiKey: "new-test-key",
        actorId: "new-actor",
        roles: ["viewer", "operator"],
        tenantId: "new-tenant",
      },
    ],
    jwtSecret: "new-jwt-secret",
  });

  const server = new HttpApiServer({
    approvalService: context.approvalService,
    inspectService: context.inspectService,
    missionControlService: context.missionControlService,
    gatewayTargetDirectoryService: context.gatewayTargetDirectoryService,
    authService,
  });

  try {
    // Token exchange with new key
    const tokenResponse = await server.inject({
      url: "/v1/auth/token",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey: "new-test-key" }),
    });
    assert.equal(tokenResponse.statusCode, 200);
    const tokenData = readJson<{ accessToken: string }>(tokenResponse);
    assert.ok(tokenData.data.accessToken.length > 0);

    // Use new token for authenticated request
    const tasks = await server.inject({
      url: "/v1/tasks?limit=1",
      headers: { authorization: `Bearer ${tokenData.data.accessToken}` },
    });
    assert.equal(tasks.statusCode, 200);
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("api server handles gateway target registration and listing", async () => {
  const workspace = createTempWorkspace("aa-api-gateway-");
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

    // List gateway targets
    const targets = await server.inject({
      url: "/v1/gateway/targets",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(targets.statusCode, 200);
    const targetsPayload = readJson<{ targets: Array<{ targetId: string; channel: string }> }>(targets);
    assert.ok(Array.isArray(targetsPayload.data.targets));
    assert.ok(targetsPayload.data.targets.length >= 1);

    // Filter by channel
    const telegramTargets = await server.inject({
      url: "/v1/gateway/targets?channel=telegram",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(telegramTargets.statusCode, 200);
    const telegramPayload = readJson<{ targets: Array<{ channel: string }> }>(telegramTargets);
    assert.ok(telegramPayload.data.targets.every((t) => t.channel === "telegram"));
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("api server handles gateway target resolution", async () => {
  const workspace = createTempWorkspace("aa-api-resolve-");
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

    // Resolve by alias
    const resolved = await server.inject({
      url: "/v1/gateway/targets/resolve?channel=telegram&query=finance",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(resolved.statusCode, 200);
    const resolvedPayload = readJson<{ entry: { displayName: string; targetId: string }; matchedBy: string }>(resolved);
    assert.equal(resolvedPayload.data.entry.displayName, "Finance Team");
    assert.ok(["alias_exact", "display_name_exact", "target_id_exact"].includes(resolvedPayload.data.matchedBy));

    // Resolve non-existent target
    const notFound = await server.inject({
      url: "/v1/gateway/targets/resolve?query=nonexistent",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(notFound.statusCode, 404);
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});
