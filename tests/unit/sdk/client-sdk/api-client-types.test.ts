/**
 * @fileoverview Unit tests for Client SDK API Client Types
 *
 * Tests for ApiClientConfig, ApiRequestSpec, ApiResponse, PaginatedResponse,
 * RetryConfig, VersionHandshakeResult, and ApiRequestOptions interfaces.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type {
  ApiClientConfig,
  ApiRequestSpec,
  ApiResponse,
  PaginatedResponse,
  PaginationSpec,
  RetryConfig,
  VersionHandshakeResult,
  ApiRequestOptions,
} from "../../../../src/sdk/client-sdk/api-client-types.js";

// =============================================================================
// ApiClientConfig Tests
// =============================================================================

test("ApiClientConfig accepts all optional fields", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    tenantId: "tenant-123",
    bearerToken: "token123",
    timeoutMs: 5000,
    maxRetries: 3,
    platformVersion: "v4.3",
    sdkVersion: "1.0.0",
    contractVersion: "1.0",
    principal: {
      subject: "user-1",
      principalId: "pid-1",
      tenantId: "tenant-123",
      roles: ["admin", "operator"],
    },
    idempotencyKey: "idem-key-1",
    performVersionHandshakeOnInit: true,
  };

  assert.equal(config.baseUrl, "https://api.example.com");
  assert.equal(config.apiVersion, "v1");
  assert.equal(config.tenantId, "tenant-123");
  assert.equal(config.bearerToken, "token123");
  assert.equal(config.timeoutMs, 5000);
  assert.equal(config.maxRetries, 3);
  assert.equal(config.platformVersion, "v4.3");
  assert.equal(config.sdkVersion, "1.0.0");
  assert.equal(config.contractVersion, "1.0");
  assert.equal(config.principal?.subject, "user-1");
  assert.equal(config.principal?.principalId, "pid-1");
  assert.deepEqual(config.principal?.roles, ["admin", "operator"]);
  assert.equal(config.idempotencyKey, "idem-key-1");
  assert.equal(config.performVersionHandshakeOnInit, true);
});

test("ApiClientConfig minimal configuration", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
  };

  assert.equal(config.baseUrl, "https://api.example.com");
  assert.equal(config.apiVersion, "v1");
  assert.equal(config.tenantId, undefined);
  assert.equal(config.bearerToken, undefined);
});

// =============================================================================
// ApiRequestSpec Tests
// =============================================================================

test("ApiRequestSpec GET request", () => {
  const spec: ApiRequestSpec = {
    path: "/harness-runs",
    method: "GET",
  };

  assert.equal(spec.path, "/harness-runs");
  assert.equal(spec.method, "GET");
});

test("ApiRequestSpec POST request with query params", () => {
  const spec: ApiRequestSpec = {
    path: "/harness-runs",
    method: "POST",
    query: { limit: 10, cursor: "abc123" },
    body: { name: "test-run" },
  };

  assert.equal(spec.path, "/harness-runs");
  assert.equal(spec.method, "POST");
  assert.equal(spec.query?.limit, 10);
  assert.equal(spec.query?.cursor, "abc123");
  assert.deepEqual(spec.body, { name: "test-run" });
});

test("ApiRequestSpec DELETE request", () => {
  const spec: ApiRequestSpec = {
    path: "/domains/domain-1",
    method: "DELETE",
    idempotencyKey: "delete-key-1",
  };

  assert.equal(spec.method, "DELETE");
  assert.equal(spec.idempotencyKey, "delete-key-1");
});

test("ApiRequestSpec PATCH request", () => {
  const spec: ApiRequestSpec = {
    path: "/config/my-key",
    method: "PATCH",
    body: { value: "updated" },
  };

  assert.equal(spec.method, "PATCH");
});

// =============================================================================
// ApiResponse Tests
// =============================================================================

test("ApiResponse with data", () => {
  const response: ApiResponse<{ id: string }> = {
    data: { id: "run-123" },
    status: 200,
    headers: { "content-type": "application/json" },
  };

  assert.deepEqual(response.data, { id: "run-123" });
  assert.equal(response.status, 200);
  assert.equal(response.headers["content-type"], "application/json");
});

test("ApiResponse error response", () => {
  const response: ApiResponse<{ error: string }> = {
    data: { error: "validation failed" },
    status: 400,
    headers: { "content-type": "application/json" },
  };

  assert.equal(response.status, 400);
});

// =============================================================================
// PaginationSpec Tests
// =============================================================================

test("PaginationSpec with cursor and limit", () => {
  const pagination: PaginationSpec = {
    cursor: "cursor-abc123",
    limit: 20,
  };

  assert.equal(pagination.cursor, "cursor-abc123");
  assert.equal(pagination.limit, 20);
});

test("PaginationSpec with only limit", () => {
  const pagination: PaginationSpec = {
    limit: 50,
  };

  assert.equal(pagination.limit, 50);
  assert.equal(pagination.cursor, undefined);
});

test("PaginationSpec with only cursor", () => {
  const pagination: PaginationSpec = {
    cursor: "next-page-cursor",
  };

  assert.equal(pagination.cursor, "next-page-cursor");
  assert.equal(pagination.limit, undefined);
});

// =============================================================================
// PaginatedResponse Tests
// =============================================================================

test("PaginatedResponse with next cursor", () => {
  const response: PaginatedResponse<{ id: string }> = {
    data: [{ id: "1" }, { id: "2" }],
    status: 200,
    headers: { "x-next-cursor": "next-123" },
    nextCursor: "next-123",
    totalCount: 100,
  };

  assert.equal(response.data.length, 2);
  assert.equal(response.nextCursor, "next-123");
  assert.equal(response.totalCount, 100);
});

test("PaginatedResponse without next cursor (last page)", () => {
  const response: PaginatedResponse<string> = {
    data: ["item-1", "item-2", "item-3"],
    status: 200,
    headers: {},
    nextCursor: null,
  };

  assert.equal(response.data.length, 3);
  assert.equal(response.nextCursor, null);
  assert.equal(response.totalCount, undefined);
});

test("PaginatedResponse with totalCount header parsing", () => {
  const response: PaginatedResponse<unknown> = {
    data: [],
    status: 200,
    headers: { "x-total-count": "42" },
    nextCursor: null,
    totalCount: 42,
  };

  assert.equal(response.totalCount, 42);
});

// =============================================================================
// RetryConfig Tests
// =============================================================================

test("RetryConfig with all fields", () => {
  const config: RetryConfig = {
    maxRetries: 5,
    backoffMs: 200,
    backoffMultiplier: 1.5,
    maxBackoffMs: 5000,
  };

  assert.equal(config.maxRetries, 5);
  assert.equal(config.backoffMs, 200);
  assert.equal(config.backoffMultiplier, 1.5);
  assert.equal(config.maxBackoffMs, 5000);
});

test("RetryConfig default values", () => {
  const config: RetryConfig = {
    maxRetries: 3,
    backoffMs: 100,
    backoffMultiplier: 2,
    maxBackoffMs: 1000,
  };

  assert.equal(config.maxRetries, 3);
  assert.equal(config.backoffMs, 100);
});

test("RetryConfig exponential backoff calculation", () => {
  const config: RetryConfig = {
    maxRetries: 3,
    backoffMs: 100,
    backoffMultiplier: 2,
    maxBackoffMs: 1000,
  };

  // Verify exponential growth
  const attempt1 = config.backoffMs * Math.pow(config.backoffMultiplier, 0);
  const attempt2 = config.backoffMs * Math.pow(config.backoffMultiplier, 1);
  const attempt3 = config.backoffMs * Math.pow(config.backoffMultiplier, 2);

  assert.equal(attempt1, 100);
  assert.equal(attempt2, 200);
  assert.equal(attempt3, 400);
});

// =============================================================================
// VersionHandshakeResult Tests
// =============================================================================

test("VersionHandshakeResult accepted", () => {
  const result: VersionHandshakeResult = {
    accepted: true,
    statusCode: 200,
    reasonCode: "sdk.accepted",
    headers: { "x-sdk-compatibility": "ok" },
    warnings: [],
    platformVersion: "v4.3",
    contractVersion: "1.0",
    minClientVersion: "0.9.0",
  };

  assert.equal(result.accepted, true);
  assert.equal(result.statusCode, 200);
  assert.equal(result.reasonCode, "sdk.accepted");
  assert.equal(result.warnings.length, 0);
  assert.equal(result.platformVersion, "v4.3");
});

test("VersionHandshakeResult with warnings", () => {
  const result: VersionHandshakeResult = {
    accepted: true,
    statusCode: 200,
    reasonCode: "sdk.accepted",
    headers: { "x-sdk-warnings": "deprecated-feature,old-format" },
    warnings: ["deprecated-feature", "old-format"],
  };

  assert.equal(result.accepted, true);
  assert.equal(result.warnings.length, 2);
  assert.ok(result.warnings.includes("deprecated-feature"));
});

test("VersionHandshakeResult rejected upgrade required", () => {
  const result: VersionHandshakeResult = {
    accepted: false,
    statusCode: 426,
    reasonCode: "sdk.upgrade_required",
    headers: {},
    warnings: [],
    minClientVersion: "2.0.0",
  };

  assert.equal(result.accepted, false);
  assert.equal(result.statusCode, 426);
  assert.equal(result.reasonCode, "sdk.upgrade_required");
});

// =============================================================================
// ApiRequestOptions Tests
// =============================================================================

test("ApiRequestOptions with idempotency key", () => {
  const options: ApiRequestOptions = {
    idempotencyKey: "unique-key-123",
  };

  assert.equal(options.idempotencyKey, "unique-key-123");
});

test("ApiRequestOptions empty", () => {
  const options: ApiRequestOptions = {};

  assert.equal(options.idempotencyKey, undefined);
});

// =============================================================================
// Interface Compatibility Tests
// =============================================================================

test("Config can be used for request spec generation", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    tenantId: "tenant-1",
  };

  const spec: ApiRequestSpec = {
    path: "/domains",
    method: "GET",
    query: { limit: 10 },
  };

  assert.ok(spec.path.startsWith("/"));
  assert.ok(config.baseUrl.includes("api.example.com"));
});

test("Response can be constructed from request result", () => {
  const pagination: PaginationSpec = {
    cursor: "cursor-1",
    limit: 25,
  };

  const response: PaginatedResponse<string> = {
    data: ["item-1", "item-2", "item-3"],
    status: 200,
    headers: { "x-next-cursor": "cursor-2" },
    nextCursor: pagination.cursor ?? null,
    totalCount: 100,
  };

  assert.ok(Array.isArray(response.data));
  assert.equal(typeof response.status, "number");
});