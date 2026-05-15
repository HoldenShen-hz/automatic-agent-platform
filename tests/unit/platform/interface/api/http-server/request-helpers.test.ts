import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";

import { matchRoute, normalizeHeaders, readIncomingBody, authenticateOptionalPrincipal } from "../../../../../../src/platform/five-plane-interface/api/http-server/request-helpers.js";
import type { ApiRequestLike } from "../../../../../../src/platform/five-plane-interface/api/http-server/types.js";
import { IncomingMessage } from "node:http";
import { ApiAuthService } from "../../../../../../src/platform/five-plane-interface/api/api-auth-service.js";

// Helper to create a minimal IncomingMessage-like that works with for-await-of
function createMockIncomingMessage(data: Buffer | null): IncomingMessage {
  const passthrough = new PassThrough();

  // Make it look like an IncomingMessage
  const mockReq = Object.assign(passthrough, {
    headers: {},
    method: "POST",
    url: "/test",
  });

  // Write data asynchronously after creation
  setImmediate(() => {
    if (data !== null) {
      passthrough.write(data, () => {
        passthrough.end();
      });
    } else {
      passthrough.end();
    }
  });

  return mockReq as unknown as IncomingMessage;
}

test("matchRoute parses GET request", () => {
  const request: ApiRequestLike = {
    method: "GET",
    url: "/api/tasks/123",
    headers: {},
    body: null,
  };
  const match = matchRoute(request);
  assert.ok(match !== null);
  assert.equal(match.pathname, "/tasks/123");
  assert.deepEqual(match.segments, ["tasks", "123"]);
});

test("matchRoute parses POST request", () => {
  const request: ApiRequestLike = {
    method: "POST",
    url: "/api/tasks",
    headers: {},
    body: '{"data":"test"}',
  };
  const match = matchRoute(request);
  assert.ok(match !== null);
  assert.equal(match.pathname, "/tasks");
  assert.deepEqual(match.segments, ["tasks"]);
});

test("matchRoute accepts PUT requests", () => {
  const request: ApiRequestLike = {
    method: "PUT",
    url: "/api/tasks/123",
    headers: {},
    body: null,
  };
  const match = matchRoute(request);
  assert.ok(match !== null);
  assert.equal(match.pathname, "/tasks/123");
});

test("matchRoute accepts DELETE method", () => {
  const request: ApiRequestLike = {
    method: "DELETE",
    url: "/api/tasks/123",
    headers: {},
    body: null,
  };
  const match = matchRoute(request);
  assert.ok(match !== null);
  assert.equal(match.pathname, "/tasks/123");
});

test("matchRoute accepts PATCH method", () => {
  const request: ApiRequestLike = {
    method: "PATCH",
    url: "/api/tasks/123",
    headers: {},
    body: null,
  };
  const match = matchRoute(request);
  assert.ok(match !== null);
  assert.equal(match.pathname, "/tasks/123");
});

test("matchRoute defaults to GET when method is undefined", () => {
  const request: ApiRequestLike = {
    method: undefined,
    url: "/api/health",
    headers: {},
    body: null,
  };
  const match = matchRoute(request);
  assert.ok(match !== null);
  assert.equal(match.pathname, "/health");
});

test("matchRoute handles root path", () => {
  const request: ApiRequestLike = {
    method: "GET",
    url: "/",
    headers: {},
    body: null,
  };
  const match = matchRoute(request);
  assert.ok(match !== null);
  assert.equal(match.pathname, "/");
  assert.deepEqual(match.segments, []);
});

test("matchRoute handles path with query string", () => {
  const request: ApiRequestLike = {
    method: "GET",
    url: "/api/tasks?status=pending&limit=10",
    headers: {},
    body: null,
  };
  const match = matchRoute(request);
  assert.ok(match !== null);
  assert.equal(match.pathname, "/tasks");
  assert.deepEqual(match.segments, ["tasks"]);
});

test("matchRoute handles empty segments", () => {
  const request: ApiRequestLike = {
    method: "GET",
    url: "///api///tasks///",
    headers: {},
    body: null,
  };
  const match = matchRoute(request);
  assert.ok(match !== null);
  assert.deepEqual(match.segments, ["api", "tasks"]);
});

test("normalizeHeaders converts header keys to lowercase", () => {
  const headers: Record<string, string | string[] | undefined> = {
    "Content-Type": "application/json",
    "Authorization": "Bearer token123",
    "X-Request-Id": "req_456",
  };
  const normalized = normalizeHeaders(headers);
  assert.equal(normalized["content-type"], "application/json");
  assert.equal(normalized["authorization"], "Bearer token123");
  assert.equal(normalized["x-request-id"], "req_456");
});

test("normalizeHeaders joins array values with comma", () => {
  const headers: Record<string, string | string[] | undefined> = {
    "Accept": ["application/json", "text/plain"],
    "X-Custom": "single",
  };
  const normalized = normalizeHeaders(headers);
  assert.equal(normalized["accept"], "application/json, text/plain");
  assert.equal(normalized["x-custom"], "single");
});

test("normalizeHeaders returns empty object for undefined input", () => {
  const normalized = normalizeHeaders(undefined);
  assert.deepEqual(normalized, {});
});

test("normalizeHeaders returns empty object for null input", () => {
  const normalized = normalizeHeaders(null as unknown as undefined);
  assert.deepEqual(normalized, {});
});

test("normalizeHeaders skips undefined values", () => {
  const headers: Record<string, string | string[] | undefined> = {
    "Content-Type": "application/json",
    "Authorization": undefined,
  };
  const normalized = normalizeHeaders(headers);
  assert.equal(normalized["content-type"], "application/json");
  assert.equal(normalized["authorization"], undefined);
});

test("readIncomingBody throws api.payload_too_large when body exceeds 1MB", async () => {
  // Create a payload larger than 1MB (1,048,576 bytes)
  const largeData = Buffer.alloc(1_100_000, "x");
  const mockReq = createMockIncomingMessage(largeData);

  await assert.rejects(
    () => readIncomingBody(mockReq),
    (error: unknown) =>
      (error as any)?.code === "api.payload_too_large"
      && (error as any)?.statusCode === 413
      && (error as any)?.message.includes("exceeds 1 MB"),
  );
});

test("readIncomingBody accepts body at exactly 1MB", async () => {
  // Create a payload exactly at 1MB boundary
  const exactData = Buffer.alloc(1_048_576, "y");
  const mockReq = createMockIncomingMessage(exactData);

  const result = await readIncomingBody(mockReq);
  assert.equal(result?.length, 1_048_576);
});

test("readIncomingBody returns null for empty body", async () => {
  const mockReq = createMockIncomingMessage(null);
  const result = await readIncomingBody(mockReq);
  assert.equal(result, null);
});

test("readIncomingBody reads normal-sized body correctly", async () => {
  const data = Buffer.from("hello world");
  const mockReq = createMockIncomingMessage(data);
  const result = await readIncomingBody(mockReq);
  assert.equal(result, "hello world");
});

// authenticateOptionalPrincipal tests

test("authenticateOptionalPrincipal returns null when authService is null", () => {
  const request: ApiRequestLike = {
    method: "GET",
    url: "/api/tasks",
    headers: { authorization: "Bearer token123" },
    body: null,
  };
  const result = authenticateOptionalPrincipal(request, null);
  assert.equal(result, null);
});

test("authenticateOptionalPrincipal returns null when no auth headers present", () => {
  const service = new ApiAuthService({
    apiKeys: [{ apiKey: "test-key", actorId: "actor-1", roles: ["viewer"] }],
    jwtSecret: "secret",
  });
  const request: ApiRequestLike = {
    method: "GET",
    url: "/api/tasks",
    headers: {},
    body: null,
  };
  const result = authenticateOptionalPrincipal(request, service);
  assert.equal(result, null);
});

test("authenticateOptionalPrincipal returns null when auth headers are empty", () => {
  const service = new ApiAuthService({
    apiKeys: [{ apiKey: "test-key", actorId: "actor-1", roles: ["viewer"] }],
    jwtSecret: "secret",
  });
  const request: ApiRequestLike = {
    method: "GET",
    url: "/api/tasks",
    headers: { authorization: "", "x-api-key": "" },
    body: null,
  };
  const result = authenticateOptionalPrincipal(request, service);
  assert.equal(result, null);
});

test("authenticateOptionalPrincipal returns principal for valid Bearer token", () => {
  const service = new ApiAuthService({
    apiKeys: [{ apiKey: "test-key", actorId: "actor-1", roles: ["viewer"] }],
    jwtSecret: "secret",
  });
  const exchange = service.exchangeApiKey("test-key");
  const request: ApiRequestLike = {
    method: "GET",
    url: "/api/tasks",
    headers: { authorization: `Bearer ${exchange.accessToken}` },
    body: null,
  };
  const result = authenticateOptionalPrincipal(request, service);
  assert.ok(result !== null);
  assert.equal(result!.actorId, "actor-1");
  assert.deepEqual(result!.roles, ["viewer"]);
});

test("authenticateOptionalPrincipal returns principal for valid API key", () => {
  const service = new ApiAuthService({
    apiKeys: [{ apiKey: "test-key", actorId: "actor-2", roles: ["operator"] }],
    jwtSecret: "secret",
  });
  const request: ApiRequestLike = {
    method: "GET",
    url: "/api/tasks",
    headers: { "x-api-key": "test-key" },
    body: null,
  };
  const result = authenticateOptionalPrincipal(request, service);
  assert.ok(result !== null);
  assert.equal(result!.actorId, "actor-2");
  assert.deepEqual(result!.roles, ["operator"]);
});

test("authenticateOptionalPrincipal returns null for invalid token (swallows error)", () => {
  const service = new ApiAuthService({
    apiKeys: [{ apiKey: "test-key", actorId: "actor-1", roles: ["viewer"] }],
    jwtSecret: "secret",
  });
  const request: ApiRequestLike = {
    method: "GET",
    url: "/api/tasks",
    headers: { authorization: "Bearer invalid.token.here" },
    body: null,
  };
  const result = authenticateOptionalPrincipal(request, service);
  assert.equal(result, null);
});

test("authenticateOptionalPrincipal returns null for invalid API key (swallows error)", () => {
  const service = new ApiAuthService({
    apiKeys: [{ apiKey: "test-key", actorId: "actor-1", roles: ["viewer"] }],
    jwtSecret: "secret",
  });
  const request: ApiRequestLike = {
    method: "GET",
    url: "/api/tasks",
    headers: { "x-api-key": "wrong-key" },
    body: null,
  };
  const result = authenticateOptionalPrincipal(request, service);
  assert.equal(result, null);
});
