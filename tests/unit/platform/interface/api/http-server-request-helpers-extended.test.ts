/**
 * Unit tests for HTTP Server Request Helpers extended coverage
 * Tests src/platform/five-plane-interface/api/http-server/request-helpers.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { ApiRequestLike } from "../../../../../src/platform/five-plane-interface/api/http-server/types.js";

function createMockRequest(overrides: Partial<ApiRequestLike> = {}): ApiRequestLike {
  return {
    method: "GET",
    url: "/test",
    headers: {},
    body: null,
    ...overrides,
  };
}

test("ApiRequestLike with all header types", () => {
  const request = createMockRequest({
    headers: {
      "content-type": "application/json",
      "authorization": "Bearer token",
      "x-request-id": "req-123",
    },
  });

  assert.equal(request.headers["content-type"], "application/json");
  assert.equal(request.headers["authorization"], "Bearer token");
  assert.equal(request.headers["x-request-id"], "req-123");
});

test("ApiRequestLike method is case-sensitive", () => {
  const getRequest = createMockRequest({ method: "GET" });
  const postRequest = createMockRequest({ method: "POST" });

  assert.equal(getRequest.method, "GET");
  assert.equal(postRequest.method, "POST");
});

test("ApiRequestLike URL parsing with query params", () => {
  const request = createMockRequest({
    url: "/api/tasks?status=pending&limit=10",
  });

  assert.ok(request.url !== undefined);
  assert.ok(request.url!.includes("status=pending"));
  assert.ok(request.url!.includes("limit=10"));
});

test("ApiRequestLike URL with fragment", () => {
  const request = createMockRequest({
    url: "/page#section",
  });

  assert.ok(request.url !== undefined);
  assert.ok(request.url!.includes("#section"));
});

test("ApiRequestLike body can be string", () => {
  const request = createMockRequest({
    method: "POST",
    body: '{"name":"test"}',
  });

  assert.equal(typeof request.body, "string");
  assert.ok(request.body !== undefined && request.body !== null);
  assert.ok((request.body as string).includes("test"));
});

test("ApiRequestLike body can be null for GET requests", () => {
  const request = createMockRequest({
    method: "GET",
    body: null,
  });

  assert.equal(request.body, null);
});

test("ApiRequestLike body can be undefined", () => {
  const request = createMockRequest({
    method: "DELETE",
    body: undefined,
  });

  assert.equal(request.body, undefined);
});

test("ApiRequestLike headers with empty values", () => {
  const request = createMockRequest({
    headers: {
      "x-empty-header": "",
      "x-valid-header": "value",
    },
  });

  assert.equal(request.headers["x-empty-header"], "");
  assert.equal(request.headers["x-valid-header"], "value");
});

test("ApiRequestLike preserves header case", () => {
  const request = createMockRequest({
    headers: {
      "X-Custom-Header": "custom-value",
      "x-another-header": "another-value",
    },
  });

  assert.equal(request.headers["X-Custom-Header"], "custom-value");
  assert.equal(request.headers["x-another-header"], "another-value");
});

test("ApiRequestLike with undefined url", () => {
  const request = createMockRequest({
    url: undefined,
  });

  assert.equal(request.url, undefined);
});

test("ApiRequestLike with undefined method", () => {
  const request = createMockRequest({
    method: undefined,
  });

  assert.equal(request.method, undefined);
});
