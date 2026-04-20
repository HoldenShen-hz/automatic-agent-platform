import assert from "node:assert/strict";
import test from "node:test";

// Re-export test for barrel file
import type {
  RouteMatch,
  ApiRequestLike,
  ApiResponsePayload,
  RouteContext,
  RouteHandler,
  RouteDefinition,
} from "../../../../../src/platform/interface/api/http-server/types.js";

test("RouteMatch structure is correct", () => {
  const match: RouteMatch = {
    pathname: "/api/tasks",
    segments: ["api", "tasks"],
  };
  assert.equal(match.pathname, "/api/tasks");
  assert.equal(match.segments.length, 2);
});

test("ApiRequestLike structure is correct", () => {
  const request: ApiRequestLike = {
    method: "GET",
    url: "http://localhost/api/tasks",
    headers: { "content-type": "application/json" },
    body: null,
  };
  assert.equal(request.method, "GET");
  assert.equal(request.url, "http://localhost/api/tasks");
});

test("ApiResponsePayload structure is correct", () => {
  const payload: ApiResponsePayload = {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: '{"success":true}',
  };
  assert.equal(payload.statusCode, 200);
  assert.equal(payload.body, '{"success":true}');
});

test("RouteContext structure is correct", () => {
  const ctx: RouteContext = {
    request: {
      method: "POST",
      url: "/api/tasks",
      headers: {},
      body: '{"title":"test"}',
    },
    route: {
      pathname: "/api/tasks",
      segments: ["api", "tasks"],
    },
    requestId: "req_123",
    principal: null,
  };
  assert.equal(ctx.requestId, "req_123");
  assert.equal(ctx.principal, null);
});

test("RouteHandler type is a function", () => {
  const handler: RouteHandler = async () => ({
    statusCode: 200,
    headers: {},
    body: "ok",
  });
  assert.equal(typeof handler, "function");
});

test("RouteDefinition structure is correct", () => {
  const definition: RouteDefinition = {
    method: "GET",
    pathname: "/api/health",
    handler: async () => ({
      statusCode: 200,
      headers: { "content-type": "text/plain" },
      body: "healthy",
    }),
  };
  assert.equal(definition.method, "GET");
  assert.equal(definition.pathname, "/api/health");
});
