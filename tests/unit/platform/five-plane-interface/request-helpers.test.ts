import { strict as assert } from "node:assert";
import { test } from "node:test";

import { matchRoute, normalizeHeaders, authenticateOptionalPrincipal, MAX_BODY_BYTES } from "../../../../src/platform/five-plane-interface/api/http-server/request-helpers.js";
import type { ApiRequestLike } from "../../../../src/platform/five-plane-interface/api/http-server/types.js";
import type { ApiAuthService } from "../../../../src/platform/five-plane-interface/api/api-auth-service.js";

function makeRequest(overrides: Partial<ApiRequestLike> = {}): ApiRequestLike {
  return {
    method: "GET",
    url: "/",
    headers: {},
    body: null,
    ...overrides,
  };
}

test("matchRoute parses simple path", () => {
  const request = makeRequest({ url: "/health" });
  const result = matchRoute(request);
  assert.ok(result != null);
  assert.equal(result.pathname, "/health");
  assert.deepEqual(result.segments, ["health"]);
});

test("matchRoute parses path with multiple segments", () => {
  const request = makeRequest({ url: "/api/v1/tasks" });
  const result = matchRoute(request);
  assert.ok(result != null);
  assert.equal(result.pathname, "/v1/tasks");
  assert.deepEqual(result.segments, ["v1", "tasks"]);
});

test("matchRoute parses path with task ID", () => {
  const request = makeRequest({ url: "/api/v1/tasks/task_abc123" });
  const result = matchRoute(request);
  assert.ok(result != null);
  assert.equal(result.pathname, "/v1/tasks/task_abc123");
  assert.deepEqual(result.segments, ["v1", "tasks", "task_abc123"]);
});

test("matchRoute parses root path", () => {
  const request = makeRequest({ url: "/" });
  const result = matchRoute(request);
  assert.ok(result != null);
  assert.equal(result.pathname, "/");
  assert.deepEqual(result.segments, []);
});

test("matchRoute parses path with query string", () => {
  const request = makeRequest({ url: "/api/v1/tasks?limit=10&cursor=abc" });
  const result = matchRoute(request);
  assert.ok(result != null);
  assert.equal(result.pathname, "/v1/tasks");
  assert.deepEqual(result.segments, ["v1", "tasks"]);
});

test("matchRoute returns null for unsupported methods", () => {
  const requestGET = makeRequest({ method: "GET", url: "/api/v1/tasks" });
  assert.ok(matchRoute(requestGET) != null, "GET should return route");

  const requestPOST = makeRequest({ method: "POST", url: "/api/v1/tasks" });
  assert.ok(matchRoute(requestPOST) != null, "POST should return route");

  const requestOPTIONS = makeRequest({ method: "OPTIONS", url: "/api/v1/tasks" });
  assert.ok(matchRoute(requestOPTIONS) != null, "OPTIONS should return route");

  const requestDELETE = makeRequest({ method: "DELETE", url: "/api/v1/tasks" });
  assert.ok(matchRoute(requestDELETE) != null, "DELETE should return route");

  const requestPATCH = makeRequest({ method: "PATCH", url: "/api/v1/tasks" });
  assert.ok(matchRoute(requestPATCH) != null, "PATCH should return route");

  const requestPUT = makeRequest({ method: "PUT", url: "/api/v1/tasks" });
  assert.ok(matchRoute(requestPUT) != null, "PUT should return route");
});

test("matchRoute handles path without leading slash", () => {
  const request = makeRequest({ url: "api/v1/tasks" });
  const result = matchRoute(request);
  assert.ok(result != null);
  assert.equal(result.pathname, "/v1/tasks");
  assert.deepEqual(result.segments, ["v1", "tasks"]);
});

test("normalizeHeaders lowercases header names", () => {
  const headers = {
    "Content-Type": "application/json",
    "X-Request-Id": "req_123",
    "Authorization": "Bearer token123",
  };
  const result = normalizeHeaders(headers);
  assert.equal(result["content-type"], "application/json");
  assert.equal(result["x-request-id"], "req_123");
  assert.equal(result["authorization"], "Bearer token123");
});

test("normalizeHeaders handles array values by joining", () => {
  const headers = {
    "Accept": ["json", "xml"],
  };
  const result = normalizeHeaders(headers);
  assert.equal(result["accept"], "json, xml");
});

test("normalizeHeaders handles undefined input", () => {
  const result = normalizeHeaders(undefined);
  assert.deepEqual(result, {});
});

test("normalizeHeaders handles null input", () => {
  const result = normalizeHeaders(null as unknown as Record<string, string | string[] | undefined>);
  assert.deepEqual(result, {});
});

test("authenticateOptionalPrincipal returns null when authService is null", () => {
  const request = makeRequest({
    headers: { authorization: "Bearer token123" },
  });
  const result = authenticateOptionalPrincipal(request, null);
  assert.equal(result, null);
});

test("authenticateOptionalPrincipal returns null when no auth headers provided", () => {
  const mockAuthService = {
    authenticate: (headers: Record<string, string | undefined>) => ({
      actorId: "user123",
      roles: ["viewer"],
      tenantId: null,
    }),
  };
  const request = makeRequest({ headers: {} });
  const result = authenticateOptionalPrincipal(request, mockAuthService as unknown as ApiAuthService);
  assert.equal(result, null);
});

test("MAX_BODY_BYTES is 1_048_576 (1 MB)", () => {
  assert.equal(MAX_BODY_BYTES, 1_048_576);
});

test("matchRoute parses deeply nested path", () => {
  const request = makeRequest({ url: "/v1/tasks/task_abc123/events" });
  const result = matchRoute(request);
  assert.ok(result != null);
  assert.equal(result.pathname, "/v1/tasks/task_abc123/events");
  assert.deepEqual(result.segments, ["v1", "tasks", "task_abc123", "events"]);
});

test("matchRoute normalizes URL with trailing slash", () => {
  const request = makeRequest({ url: "/api/v1/tasks/" });
  const result = matchRoute(request);
  assert.ok(result != null);
  assert.equal(result.pathname, "/v1/tasks/");
  // Trailing empty segment is filtered out
  assert.deepEqual(result.segments, ["v1", "tasks"]);
});
