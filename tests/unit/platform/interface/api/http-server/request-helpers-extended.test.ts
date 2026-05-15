/**
 * Unit tests for HTTP Server Request Helpers - Additional edge cases
 * Tests for request-helpers.ts
 */

import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";

import { matchRoute, normalizeHeaders, readIncomingBody } from "../../../../../../src/platform/five-plane-interface/api/http-server/request-helpers.js";
import type { ApiRequestLike } from "../../../../../../src/platform/five-plane-interface/api/http-server/types.js";
import { IncomingMessage } from "node:http";

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

test("matchRoute handles POST method", () => {
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

test("matchRoute handles OPTIONS method", () => {
  const request: ApiRequestLike = {
    method: "OPTIONS",
    url: "/api/cors",
    headers: {},
    body: null,
  };
  const match = matchRoute(request);
  assert.ok(match !== null);
  assert.equal(match.pathname, "/cors");
});

test("matchRoute handles PUT method", () => {
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

test("matchRoute handles PATCH method", () => {
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

test("matchRoute returns null for HEAD method", () => {
  const request: ApiRequestLike = {
    method: "HEAD",
    url: "/api/tasks",
    headers: {},
    body: null,
  };
  const match = matchRoute(request);
  assert.equal(match, null);
});

test("normalizeHeaders handles multiple values as array", () => {
  const headers: Record<string, string | string[] | undefined> = {
    "Accept": ["application/json", "text/html", "text/plain"],
  };
  const normalized = normalizeHeaders(headers);
  assert.equal(normalized["accept"], "application/json, text/html, text/plain");
});

test("normalizeHeaders handles single value array", () => {
  const headers: Record<string, string | string[] | undefined> = {
    "Accept": ["application/json"],
  };
  const normalized = normalizeHeaders(headers);
  assert.equal(normalized["accept"], "application/json");
});

test("normalizeHeaders handles undefined values in record", () => {
  const headers: Record<string, string | string[] | undefined> = {
    "Content-Type": undefined,
    "Authorization": "Bearer token",
  };
  const normalized = normalizeHeaders(headers);
  assert.equal(normalized["content-type"], undefined);
  assert.equal(normalized["authorization"], "Bearer token");
});

test("readIncomingBody reads UTF-8 encoded content", async () => {
  const data = Buffer.from("Hello, World! Привет", "utf-8");
  const mockReq = createMockIncomingMessage(data);

  const result = await readIncomingBody(mockReq);
  assert.equal(result, "Hello, World! Привет");
});

test("readIncomingBody reads empty string body", async () => {
  const data = Buffer.from("");
  const mockReq = createMockIncomingMessage(data);

  const result = await readIncomingBody(mockReq);
  assert.equal(result, null);
});

test("readIncomingBody handles JSON content", async () => {
  const json = '{"key":"value","number":42,"array":[1,2,3]}';
  const data = Buffer.from(json);
  const mockReq = createMockIncomingMessage(data);

  const result = await readIncomingBody(mockReq);
  assert.equal(result, json);
});

test("readIncomingBody handles unicode content", async () => {
  const data = Buffer.from('{"message":"你好世界","emoji":"🎉"}', "utf-8");
  const mockReq = createMockIncomingMessage(data);

  const result = await readIncomingBody(mockReq);
  assert.equal(result, '{"message":"你好世界","emoji":"🎉"}');
});

test("readIncomingBody handles large body near limit", async () => {
  // Create a payload just under 1MB
  const data = Buffer.alloc(1_048_576 - 1, "x");
  const mockReq = createMockIncomingMessage(data);

  const result = await readIncomingBody(mockReq);
  assert.equal(result?.length, 1_048_576 - 1);
});
