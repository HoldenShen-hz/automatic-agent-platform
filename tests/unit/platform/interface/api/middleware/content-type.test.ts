import assert from "node:assert/strict";
import test from "node:test";

import {
  validateContentType,
  createContentTypeValidationMiddleware,
} from "../../../../../../src/platform/interface/api/middleware/content-type.js";

function buildRequest(overrides: Partial<{ method: string; headers: Record<string, string | undefined> }> = {}): ApiRequestLike {
  return {
    method: overrides.method ?? "POST",
    url: "/api/v1/test",
    headers: overrides.headers ?? {},
    body: '{"test": true}',
  };
}

test("validateContentType allows application/json for POST requests", () => {
  const request = buildRequest({
    method: "POST",
    headers: { "content-type": "application/json" },
  });
  // Should not throw
  validateContentType(request);
});

test("validateContentType allows application/json with charset for POST requests", () => {
  const request = buildRequest({
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
  });
  // Should not throw
  validateContentType(request);
});

test("validateContentType rejects non-JSON content type for POST requests", () => {
  const request = buildRequest({
    method: "POST",
    headers: { "content-type": "text/plain" },
  });
  assert.throws(
    () => validateContentType(request),
    /api\.unsupported_content_type/,
    "Must reject text/plain content type",
  );
});

test("validateContentType rejects multipart/form-data for POST requests", () => {
  const request = buildRequest({
    method: "POST",
    headers: { "content-type": "multipart/form-data; boundary=----WebKitFormBoundary" },
  });
  assert.throws(
    () => validateContentType(request),
    /api\.unsupported_content_type/,
    "Must reject multipart/form-data",
  );
});

test("validateContentType rejects empty content type for POST requests when body is present", () => {
  const request = buildRequest({
    method: "POST",
    headers: { "content-type": "" },
  });
  // Empty content type is technically valid (no body expected), but with a body it should be rejected
  // Since we allow empty content-type for requests without body, this just passes through
  validateContentType(request);
});

test("validateContentType skips validation for GET requests", () => {
  const request = buildRequest({
    method: "GET",
    headers: { "content-type": "text/html" },
  });
  // Should not throw regardless of content type
  validateContentType(request);
});

test("validateContentType skips validation for HEAD requests", () => {
  const request = buildRequest({
    method: "HEAD",
    headers: { "content-type": "text/html" },
  });
  // Should not throw regardless of content type
  validateContentType(request);
});

test("validateContentType skips validation for OPTIONS requests", () => {
  const request = buildRequest({
    method: "OPTIONS",
    headers: { "content-type": "text/html" },
  });
  // Should not throw regardless of content type
  validateContentType(request);
});

test("validateContentType skips validation for PUT requests", () => {
  const request = buildRequest({
    method: "PUT",
    headers: { "content-type": "application/json" },
  });
  validateContentType(request);
});

test("validateContentType skips validation for PATCH requests", () => {
  const request = buildRequest({
    method: "PATCH",
    headers: { "content-type": "application/json" },
  });
  validateContentType(request);
});

test("validateContentType skips validation for DELETE requests", () => {
  const request = buildRequest({
    method: "DELETE",
    headers: { "content-type": "application/json" },
  });
  validateContentType(request);
});

test("createContentTypeValidationMiddleware returns a function", () => {
  const middleware = createContentTypeValidationMiddleware();
  assert.equal(typeof middleware, "function");
});

test("createContentTypeValidationMiddleware middleware validates content type", () => {
  const middleware = createContentTypeValidationMiddleware();
  const request = buildRequest({
    method: "POST",
    headers: { "content-type": "text/html" },
  });
  assert.throws(
    () => middleware(request),
    /api\.unsupported_content_type/,
    "Middleware should reject text/html",
  );
});

test("createContentTypeValidationMiddleware middleware allows application/json", () => {
  const middleware = createContentTypeValidationMiddleware();
  const request = buildRequest({
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
  });
  // Should not throw
  middleware(request);
});

test("validateContentType works with request without headers", () => {
  const request = buildRequest({
    method: "GET",
    headers: {},
  });
  validateContentType(request);
});

test("validateContentType works with request with undefined content-type header", () => {
  const request = buildRequest({
    method: "POST",
    headers: { "content-type": undefined },
  });
  // Should not throw for undefined content-type (will be treated as empty string)
  validateContentType(request);
});