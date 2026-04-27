import assert from "node:assert/strict";
import test from "node:test";

import {
  matchRoute,
  normalizeHeaders,
  MAX_BODY_BYTES,
} from "../../../../../../src/platform/interface/api/http-server/request-helpers.js";
import type { ApiRequestLike } from "../../../../../../src/platform/interface/api/http-server/types.js";

test("matchRoute parses GET request", () => {
  const request: ApiRequestLike = {
    method: "GET",
    url: "/v1/tasks/abc123",
    headers: {},
    body: null,
  };
  const result = matchRoute(request);
  assert.ok(result != null);
  assert.equal(result.pathname, "/v1/tasks/abc123");
  assert.deepEqual(result.segments, ["v1", "tasks", "abc123"]);
});

test("matchRoute parses POST request", () => {
  const request: ApiRequestLike = {
    method: "POST",
    url: "/v1/divisions",
    headers: {},
    body: null,
  };
  const result = matchRoute(request);
  assert.ok(result != null);
  assert.deepEqual(result.segments, ["v1", "divisions"]);
});

test("matchRoute parses OPTIONS request", () => {
  const request: ApiRequestLike = {
    method: "OPTIONS",
    url: "/health",
    headers: {},
    body: null,
  };
  const result = matchRoute(request);
  assert.ok(result != null);
  assert.equal(result.pathname, "/health");
});

test("matchRoute rejects non-GET/POST/OPTIONS methods", () => {
  const methods = ["PUT", "DELETE", "PATCH", "HEAD"];
  for (const method of methods) {
    const request: ApiRequestLike = {
      method,
      url: "/v1/tasks",
      headers: {},
      body: null,
    };
    const result = matchRoute(request);
    assert.equal(result, null, `Expected null for method ${method}`);
  }
});

test("matchRoute handles missing URL", () => {
  const request: ApiRequestLike = {
    method: "GET",
    url: undefined,
    headers: {},
    body: null,
  };
  const result = matchRoute(request);
  assert.ok(result != null);
  assert.equal(result.pathname, "/");
  assert.deepEqual(result.segments, []);
});

test("matchRoute handles null method as GET", () => {
  const request: ApiRequestLike = {
    method: null,
    url: "/tasks",
    headers: {},
    body: null,
  };
  const result = matchRoute(request);
  assert.ok(result != null);
});

test("matchRoute handles undefined method", () => {
  const request: ApiRequestLike = {
    method: undefined,
    url: "/tasks",
    headers: {},
    body: null,
  };
  const result = matchRoute(request);
  assert.ok(result != null);
});

test("matchRoute parses empty path", () => {
  const request: ApiRequestLike = {
    method: "GET",
    url: "/",
    headers: {},
    body: null,
  };
  const result = matchRoute(request);
  assert.ok(result != null);
  assert.equal(result.pathname, "/");
  assert.deepEqual(result.segments, []);
});

test("matchRoute parses path with query string", () => {
  const request: ApiRequestLike = {
    method: "GET",
    url: "/v1/tasks?status=pending&limit=10",
    headers: {},
    body: null,
  };
  const result = matchRoute(request);
  assert.ok(result != null);
  assert.equal(result.pathname, "/v1/tasks");
  assert.deepEqual(result.segments, ["v1", "tasks"]);
});

test("matchRoute handles multiple slashes", () => {
  const request: ApiRequestLike = {
    method: "GET",
    url: "///v1///tasks///",
    headers: {},
    body: null,
  };
  const result = matchRoute(request);
  assert.ok(result != null);
  // URL parsing normalizes multiple slashes
  assert.deepEqual(result.segments, ["v1", "tasks"]);
});

test("normalizeHeaders converts headers to lowercase", () => {
  const headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer token123",
    "X-Request-ID": "req_abc",
  };
  const result = normalizeHeaders(headers);
  assert.equal(result["content-type"], "application/json");
  assert.equal(result["authorization"], "Bearer token123");
  assert.equal(result["x-request-id"], "req_abc");
});

test("normalizeHeaders handles array values by joining", () => {
  const headers = {
    "Accept": ["application/json", "text/plain"],
    "X-Custom": "single",
  };
  const result = normalizeHeaders(headers);
  assert.equal(result["accept"], "application/json, text/plain");
  assert.equal(result["x-custom"], "single");
});

test("normalizeHeaders handles undefined input", () => {
  const result = normalizeHeaders(undefined);
  assert.deepEqual(result, {});
});

test("normalizeHeaders handles null input", () => {
  const result = normalizeHeaders(null as any);
  assert.deepEqual(result, {});
});

test("normalizeHeaders returns empty object for empty input", () => {
  const result = normalizeHeaders({});
  assert.deepEqual(result, {});
});

test("normalizeHeaders preserves string values", () => {
  const headers = {
    "host": "localhost:3000",
    "connection": "keep-alive",
  };
  const result = normalizeHeaders(headers);
  assert.equal(result["host"], "localhost:3000");
  assert.equal(result["connection"], "keep-alive");
});

test("MAX_BODY_BYTES is 1MB", () => {
  assert.equal(MAX_BODY_BYTES, 1_048_576);
});

test("matchRoute parses deep nested path", () => {
  const request: ApiRequestLike = {
    method: "GET",
    url: "/v1/divisions/tenant_1/workspaces/space_x/tasks/task_123",
    headers: {},
    body: null,
  };
  const result = matchRoute(request);
  assert.ok(result != null);
  assert.deepEqual(result.segments, [
    "v1",
    "divisions",
    "tenant_1",
    "workspaces",
    "space_x",
    "tasks",
    "task_123",
  ]);
});

test("matchRoute normalizes leading slash variations", () => {
  const request: ApiRequestLike = {
    method: "GET",
    url: "v1/tasks",
    headers: {},
    body: null,
  };
  const result = matchRoute(request);
  assert.ok(result != null);
  assert.equal(result.pathname, "/v1/tasks");
});

test("normalizeHeaders handles string[] in headers", () => {
  const headers = {
    "Set-Cookie": ["cookie1=value1", "cookie2=value2"],
  };
  const result = normalizeHeaders(headers);
  assert.equal(result["set-cookie"], "cookie1=value1, cookie2=value2");
});

test("normalizeHeaders returns undefined for undefined single values", () => {
  const headers = {
    "X-Optional": undefined,
    "X-Present": "value",
  };
  const result = normalizeHeaders(headers);
  assert.equal(result["x-optional"], undefined);
  assert.equal(result["x-present"], "value");
});