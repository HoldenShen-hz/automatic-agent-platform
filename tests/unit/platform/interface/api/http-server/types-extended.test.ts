/**
 * Unit tests for HTTP Server Types - Additional coverage
 * Tests for types.ts and related functionality
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { RouteDefinition, RouteHandler, RouteContext, ApiRequestLike } from "../../../../../../src/platform/interface/api/http-server/types.js";

test("RouteDefinition accepts valid route definition", () => {
  const handler: RouteHandler = async () => ({
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: "{}",
  });

  const route: RouteDefinition = {
    method: "GET",
    pathname: "/api/test",
    handler,
  };

  assert.equal(route.method, "GET");
  assert.equal(route.pathname, "/api/test");
  assert.ok(typeof route.handler === "function");
});

test("RouteDefinition with segments flag", () => {
  const handler: RouteHandler = async () => null;

  const route: RouteDefinition = {
    method: "GET",
    pathname: null,
    segments: true,
    handler,
  };

  assert.equal(route.pathname, null);
  assert.equal(route.segments, true);
});

test("RouteHandler can return null", async () => {
  const handler: RouteHandler = async () => null;
  const result = await handler({
    request: { method: "GET", url: "/", headers: {}, body: null },
    route: { pathname: "/", segments: [] },
    requestId: "req_1",
    principal: null,
  });
  assert.equal(result, null);
});

test("RouteHandler can return ApiResponsePayload", async () => {
  const handler: RouteHandler = async () => ({
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: '{"ok":true}',
  });

  const result = await handler({
    request: { method: "GET", url: "/", headers: {}, body: null },
    route: { pathname: "/", segments: [] },
    requestId: "req_1",
    principal: null,
  });

  assert.ok(result != null);
  assert.equal(result.statusCode, 200);
});

test("RouteContext has correct structure", () => {
  const request: ApiRequestLike = {
    method: "GET",
    url: "/api/test",
    headers: { "content-type": "application/json" },
    body: null,
  };

  const ctx: RouteContext = {
    request,
    route: { pathname: "/api/test", segments: ["api", "test"] },
    requestId: "req_123",
    principal: null,
  };

  assert.equal(ctx.request.method, "GET");
  assert.equal(ctx.route.pathname, "/api/test");
  assert.equal(ctx.requestId, "req_123");
  assert.equal(ctx.principal, null);
});

test("ApiRequestLike accepts optional method", () => {
  const request: ApiRequestLike = {
    method: undefined,
    url: "/api/test",
    headers: {},
    body: null,
  };
  assert.equal(request.method, undefined);
});

test("ApiRequestLike accepts optional body", () => {
  const request: ApiRequestLike = {
    method: "POST",
    url: "/api/test",
    headers: {},
    body: '{"key":"value"}',
  };
  assert.equal(request.body, '{"key":"value"}');
});

test("RouteDefinition with all fields", () => {
  const handler: RouteHandler = async () => ({
    statusCode: 200,
    headers: {},
    body: "",
  });

  const route: RouteDefinition = {
    method: "POST",
    pathname: "/v1/tasks",
    segments: false,
    handler,
  };

  assert.equal(route.method, "POST");
  assert.equal(route.pathname, "/v1/tasks");
  assert.equal(route.segments, false);
});
