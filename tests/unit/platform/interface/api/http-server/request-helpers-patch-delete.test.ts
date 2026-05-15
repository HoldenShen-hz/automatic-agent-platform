/**
 * R25-01 Audit Verification Tests for matchRoute PATCH/DELETE support
 *
 * CRITICAL: matchRoute was only allowing GET/POST/OPTIONS, making PATCH/DELETE
 * handlers completely unreachable (task-routes defined but always 404).
 *
 * These tests verify that PATCH and DELETE methods are properly routed.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { matchRoute } from "../../../../../../src/platform/five-plane-interface/api/http-server/request-helpers.js";
import type { ApiRequestLike } from "../../../../../../src/platform/five-plane-interface/api/http-server/types.js";

test("R25-01: matchRoute accepts PATCH method - verifies PATCH handlers are reachable", () => {
  const request: ApiRequestLike = {
    method: "PATCH",
    url: "/api/tasks/123",
    headers: {},
    body: JSON.stringify({ status: "completed" }),
  };
  const match = matchRoute(request);
  assert.ok(match !== null, "PATCH requests must not return null - PATCH handlers must be reachable");
  assert.equal(match.pathname, "/tasks/123");
  assert.deepEqual(match.segments, ["tasks", "123"]);
});

test("R25-01: matchRoute accepts DELETE method - verifies DELETE handlers are reachable", () => {
  const request: ApiRequestLike = {
    method: "DELETE",
    url: "/api/tasks/123",
    headers: {},
    body: null,
  };
  const match = matchRoute(request);
  assert.ok(match !== null, "DELETE requests must not return null - DELETE handlers must be reachable");
  assert.equal(match.pathname, "/tasks/123");
  assert.deepEqual(match.segments, ["tasks", "123"]);
});

test("R25-01: matchRoute accepts PUT method - verifies PUT handlers are reachable", () => {
  const request: ApiRequestLike = {
    method: "PUT",
    url: "/api/tasks/123",
    headers: {},
    body: JSON.stringify({ title: "updated" }),
  };
  const match = matchRoute(request);
  assert.ok(match !== null, "PUT requests must not return null - PUT handlers must be reachable");
  assert.equal(match.pathname, "/tasks/123");
  assert.deepEqual(match.segments, ["tasks", "123"]);
});

test("R25-01: matchRoute accepts GET method", () => {
  const request: ApiRequestLike = {
    method: "GET",
    url: "/api/tasks",
    headers: {},
    body: null,
  };
  const match = matchRoute(request);
  assert.ok(match !== null);
  assert.equal(match.pathname, "/tasks");
});

test("R25-01: matchRoute accepts POST method", () => {
  const request: ApiRequestLike = {
    method: "POST",
    url: "/api/tasks",
    headers: {},
    body: JSON.stringify({ title: "new task" }),
  };
  const match = matchRoute(request);
  assert.ok(match !== null);
  assert.equal(match.pathname, "/tasks");
});

test("R25-01: matchRoute accepts OPTIONS method", () => {
  const request: ApiRequestLike = {
    method: "OPTIONS",
    url: "/api/tasks",
    headers: {},
    body: null,
  };
  const match = matchRoute(request);
  assert.ok(match !== null);
  assert.equal(match.pathname, "/tasks");
});

test("R25-01: matchRoute rejects unsupported methods to prevent 404 for defined routes", () => {
  // These methods should return null, making route matching fall through to 404
  const unsupportedMethods = ["HEAD", "TRACE", "CONNECT"];

  for (const method of unsupportedMethods) {
    const request: ApiRequestLike = {
      method: method as any,
      url: "/api/tasks",
      headers: {},
      body: null,
    };
    const match = matchRoute(request);
    assert.equal(match, null, `Method ${method} should return null (unsupported)`);
  }
});

test("R25-01: PATCH with complex path segments is properly parsed", () => {
  const request: ApiRequestLike = {
    method: "PATCH",
    url: "/api/v1/workspaces/acme-123/projects/proj-456/tasks/task-789",
    headers: {},
    body: JSON.stringify({ priority: "high" }),
  };
  const match = matchRoute(request);
  assert.ok(match !== null);
  assert.deepEqual(match.segments, ["v1", "workspaces", "acme-123", "projects", "proj-456", "tasks", "task-789"]);
});

test("R25-01: DELETE with query string is properly parsed", () => {
  const request: ApiRequestLike = {
    method: "DELETE",
    url: "/api/tasks/123?force=true",
    headers: {},
    body: null,
  };
  const match = matchRoute(request);
  assert.ok(match !== null);
  assert.equal(match.pathname, "/tasks/123");
  assert.deepEqual(match.segments, ["tasks", "123"]);
});

test("R25-01: All HTTP methods that SHOULD be allowed are allowed", () => {
  // Per HTTP spec and REST conventions, these methods should be supported
  const allowedMethods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

  for (const method of allowedMethods) {
    const request: ApiRequestLike = {
      method,
      url: "/api/resource",
      headers: {},
      body: null,
    };
    const match = matchRoute(request);
    assert.ok(
      match !== null,
      `HTTP method ${method} should be allowed and not return null`,
    );
  }
});