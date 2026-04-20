import assert from "node:assert/strict";
import test from "node:test";

// Barrel test for http-server module
import type {
  RouteContext,
  RouteDefinition,
  RouteMatch,
  ApiRequestLike,
  ApiResponsePayload,
  RouteHandler,
} from "../../../../../../src/platform/interface/api/http-server/index.js";

test("RouteMatch structure is correct", () => {
  const match: RouteMatch = {
    pathname: "/api/tasks/task_123",
    segments: ["api", "tasks", "task_123"],
  };
  assert.equal(match.pathname, "/api/tasks/task_123");
  assert.equal(match.segments.length, 3);
  assert.equal(match.segments[0], "api");
});

test("ApiRequestLike structure is correct", () => {
  const request: ApiRequestLike = {
    method: "GET",
    url: "/api/tasks",
    headers: { "content-type": "application/json" },
    body: null,
  };
  assert.equal(request.method, "GET");
  assert.equal(request.url, "/api/tasks");
  assert.deepEqual(request.headers, { "content-type": "application/json" });
  assert.equal(request.body, null);
});

test("ApiRequestLike with body", () => {
  const request: ApiRequestLike = {
    method: "POST",
    url: "/api/tasks",
    headers: { "content-type": "application/json" },
    body: '{"taskId": "task_123"}',
  };
  assert.equal(request.method, "POST");
  assert.ok(request.body !== null);
});

test("ApiResponsePayload structure is correct", () => {
  const response: ApiResponsePayload = {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: '{"result": "success"}',
  };
  assert.equal(response.statusCode, 200);
  assert.equal(response.body, '{"result": "success"}');
});

test("ApiResponsePayload with error status", () => {
  const response: ApiResponsePayload = {
    statusCode: 500,
    headers: { "content-type": "text/plain" },
    body: "Internal server error",
  };
  assert.equal(response.statusCode, 500);
  assert.ok(response.statusCode >= 400);
});

test("RouteContext structure is correct", () => {
  const ctx: RouteContext = {
    request: {
      method: "GET",
      url: "/api/tasks",
      headers: {},
      body: null,
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

test("RouteDefinition structure is correct", () => {
  const handler: RouteHandler = async (_ctx) => ({
    statusCode: 200,
    headers: {},
    body: "ok",
  });
  const definition: RouteDefinition = {
    method: "GET",
    pathname: "/api/health",
    handler,
  };
  assert.equal(definition.method, "GET");
  assert.equal(definition.pathname, "/api/health");
  assert.equal(typeof definition.handler, "function");
});

test("RouteDefinition with segments flag", () => {
  const definition: RouteDefinition = {
    method: "GET",
    pathname: "/api/tasks/:taskId",
    segments: true,
    handler: () => null,
  };
  assert.equal(definition.segments, true);
});

test("RouteHandler can return null synchronously", () => {
  const handler: RouteHandler = (_ctx) => null;
  const result = handler({} as RouteContext);
  assert.equal(result, null);
});

test("RouteHandler returns ApiResponsePayload synchronously", () => {
  const handler: RouteHandler = (_ctx) => ({
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: '{"ok": true}',
  });
  const result = handler({} as RouteContext);
  assert.ok(result !== null);
  if (result !== null && !(result instanceof Promise)) {
    assert.equal(result.statusCode, 200);
  }
});
