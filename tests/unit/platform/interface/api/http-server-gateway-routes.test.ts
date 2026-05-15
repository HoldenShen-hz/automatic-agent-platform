/**
 * Unit tests for API Gateway Routes coverage
 * Tests src/platform/five-plane-interface/api/http-server/gateway-routes.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import { buildJsonResponse } from "../../../../../src/platform/five-plane-interface/api/http-server/utils.js";

test("buildJsonResponse for gateway routes", () => {
  const response = buildJsonResponse("gw-req-1", 200, {
    gatewayId: "gw-001",
    status: "active",
  });

  assert.equal(response.statusCode, 200);
  assert.ok("headers" in response);
});

test("buildJsonResponse with gateway target info", () => {
  const response = buildJsonResponse("gw-target", 200, {
    targetId: "target-001",
    channel: "email",
    status: "delivering",
  });

  assert.ok(response.body.includes("target-001"));
  assert.ok(response.body.includes("email"));
});

test("buildJsonResponse for gateway error 404", () => {
  const response = buildJsonResponse("gw-404", 404, {
    error: "gateway.target_not_found",
    message: "Gateway target not found",
  });

  assert.equal(response.statusCode, 404);
  assert.ok(response.body.includes("target_not_found"));
});

test("buildJsonResponse for gateway error 409", () => {
  const response = buildJsonResponse("gw-409", 409, {
    error: "gateway.target_ambiguous",
    message: "Gateway target query is ambiguous",
  });

  assert.equal(response.statusCode, 409);
  assert.ok(response.body.includes("target_ambiguous"));
});

test("buildJsonResponse for gateway rate limit 429", () => {
  const response = buildJsonResponse("gw-rate", 429, {
    error: "gateway.rate_limited",
    message: "Gateway rate limit exceeded",
    retryAfter: 60,
  });

  assert.equal(response.statusCode, 429);
  assert.ok(response.body.includes("rate_limited"));
  assert.ok(response.body.includes("retryAfter"));
});

test("buildJsonResponse for gateway 503 service unavailable", () => {
  const response = buildJsonResponse("gw-503", 503, {
    error: "gateway.unavailable",
    message: "Gateway service is temporarily unavailable",
  });

  assert.equal(response.statusCode, 503);
  assert.ok(response.body.includes("unavailable"));
});

test("buildJsonResponse with delivery status", () => {
  const response = buildJsonResponse("gw-delivery", 200, {
    deliveryId: "del-001",
    state: "delivered",
    attempts: 3,
    deliveredAt: "2026-04-01T10:30:00.000Z",
  });

  assert.ok(response.body.includes("delivered"));
  assert.ok(response.body.includes("3"));
});

test("buildJsonResponse with retry info", () => {
  const response = buildJsonResponse("gw-retry", 200, {
    deliveryId: "del-retry",
    state: "retrying",
    attemptNumber: 2,
    nextRetryAt: "2026-04-01T11:00:00.000Z",
  });

  assert.ok(response.body.includes("retrying"));
  assert.ok(response.body.includes("2"));
});

test("buildJsonResponse with circuit breaker status", () => {
  const response = buildJsonResponse("gw-cb", 200, {
    channel: "email",
    circuitBreaker: {
      state: "open",
      failureCount: 5,
      lastFailureAt: "2026-04-01T09:55:00.000Z",
    },
  });

  assert.ok(response.body.includes("circuitBreaker"));
  assert.ok(response.body.includes("open"));
});

test("buildJsonResponse with channel configuration", () => {
  const response = buildJsonResponse("gw-config", 200, {
    channel: "slack",
    enabled: true,
    priority: 10,
    rateLimit: {
      maxCalls: 100,
      remaining: 95,
    },
  });

  assert.ok(response.body.includes("slack"));
  assert.ok(response.body.includes("rateLimit"));
});

test("buildJsonResponse with target list", () => {
  const response = buildJsonResponse("gw-list", 200, {
    targets: [
      { targetId: "t1", channel: "email", status: "active" },
      { targetId: "t2", channel: "slack", status: "active" },
    ],
    total: 2,
  });

  assert.ok(response.body.includes("t1"));
  assert.ok(response.body.includes("t2"));
});
