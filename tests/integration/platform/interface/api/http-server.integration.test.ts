/**
 * Integration tests for HTTP server surface
 *
 * Tests HTTP server behavior including request ID propagation,
 * CORS handling, body size limits, and JSON error handling.
 *
 * @see R7-43 X-Trace-Id header propagation
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

test("HTTP server propagates X-Request-Id header in response", async () => {
  const workspace = createTempWorkspace("aa-http-reqid-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const customRequestId = "custom-trace-id-abc123";

    const health = await server.inject({
      url: "/healthz",
      headers: { "x-request-id": customRequestId },
    });

    assert.equal(health.statusCode, 200);
    assert.equal(health.headers["x-request-id"], customRequestId);

    const payload = readJson<unknown>(health);
    assert.equal(payload.requestId, customRequestId);
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("HTTP server generates request ID when X-Request-Id is missing", async () => {
  const workspace = createTempWorkspace("aa-http-gen-reqid-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const health = await server.inject({
      url: "/healthz",
      headers: {},
    });

    assert.equal(health.statusCode, 200);
    assert.ok(health.headers["x-request-id"] != null);
    assert.ok(health.headers["x-request-id"]!.startsWith("req_"));

    const payload = readJson<unknown>(health);
    assert.equal(payload.requestId, health.headers["x-request-id"]);
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("HTTP server handles CORS preflight with X-Request-Id", async () => {
  const workspace = createTempWorkspace("aa-http-cors-reqid-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const customRequestId = "preflight-trace-xyz";

    const preflight = await server.inject({
      url: "/v1/tasks",
      method: "OPTIONS",
      headers: {
        origin: "https://console.example.test",
        "access-control-request-method": "GET",
        "access-control-request-headers": "authorization,content-type,x-request-id",
        "x-request-id": customRequestId,
      },
    });

    assert.equal(preflight.statusCode, 204);
    assert.equal(preflight.headers["access-control-allow-origin"], "https://console.example.test");
    assert.ok(preflight.headers["access-control-expose-headers"]?.includes("x-request-id"));
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("HTTP server enforces body size limit", async () => {
  const workspace = createTempWorkspace("aa-http-body-limit-");
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

    // Create oversized body (over 1MB limit)
    const largeBody = JSON.stringify({
      data: "x".repeat(1_100_000),
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

test("HTTP server rejects malformed JSON body", async () => {
  const workspace = createTempWorkspace("aa-http-bad-json-");
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

test("HTTP server returns 404 for unknown routes", async () => {
  const workspace = createTempWorkspace("aa-http-404-");
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

test("HTTP server returns proper JSON content type", async () => {
  const workspace = createTempWorkspace("aa-http-json-ct-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const health = await server.inject({ url: "/healthz" });

    assert.equal(health.statusCode, 200);
    const contentType = health.headers["content-type"] ?? "";
    assert.ok(contentType.includes("application/json"));
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("HTTP server exposes X-Request-Id in CORS preflight response", async () => {
  const workspace = createTempWorkspace("aa-http-cors-expose-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const preflight = await server.inject({
      url: "/v1/tasks",
      method: "OPTIONS",
      headers: {
        origin: "https://console.example.test",
        "access-control-request-method": "GET",
        "access-control-request-headers": "x-request-id",
      },
    });

    assert.equal(preflight.statusCode, 204);
    // X-Request-Id should be in the expose headers for CORS
    const exposedHeaders = preflight.headers["access-control-expose-headers"] ?? "";
    assert.ok(exposedHeaders.includes("x-request-id") || exposedHeaders === "*");
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});
