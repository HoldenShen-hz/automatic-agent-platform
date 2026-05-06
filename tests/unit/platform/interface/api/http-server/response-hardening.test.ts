import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_CORS_CONFIG,
  parseAllowedOrigins,
  normalizeCorsConfig,
  isOriginAllowed,
  buildPreflightHeaders,
  decorateResponseHeaders,
} from "../../../../../../src/platform/interface/api/http-server/response-hardening.js";
import type { ApiResponsePayload } from "../../../../../../src/platform/interface/api/http-server/response-hardening.js";

test("parseAllowedOrigins returns defaults for undefined input", () => {
  const result = parseAllowedOrigins(undefined);
  assert.deepEqual(result, []);
});

test("parseAllowedOrigins returns defaults for empty string", () => {
  const result = parseAllowedOrigins("");
  assert.deepEqual(result, []);
});

test("parseAllowedOrigins parses comma-separated origins", () => {
  const result = parseAllowedOrigins("https://example.com, https://app.example.org");
  assert.equal(result.length, 2);
  assert.ok(result.includes("https://example.com"));
  assert.ok(result.includes("https://app.example.org"));
});

test("parseAllowedOrigins trims whitespace", () => {
  const result = parseAllowedOrigins("  https://example.com  ,  https://test.com  ");
  assert.equal(result.length, 2);
  assert.ok(result.includes("https://example.com"));
  assert.ok(result.includes("https://test.com"));
});

test("parseAllowedOrigins filters empty segments", () => {
  const result = parseAllowedOrigins("https://valid.com,,  ,https://also-valid.com");
  assert.equal(result.length, 2);
  assert.ok(result.includes("https://valid.com"));
  assert.ok(result.includes("https://also-valid.com"));
});

test("normalizeCorsConfig preserves defaults when config is null", () => {
  const result = normalizeCorsConfig(null);
  assert.deepEqual(result.allowedOrigins, DEFAULT_CORS_CONFIG.allowedOrigins);
  assert.deepEqual(result.allowedMethods, DEFAULT_CORS_CONFIG.allowedMethods);
  assert.equal(result.maxAgeSeconds, DEFAULT_CORS_CONFIG.maxAgeSeconds);
});

test("normalizeCorsConfig preserves defaults when config is undefined", () => {
  const result = normalizeCorsConfig(undefined);
  assert.deepEqual(result.allowedOrigins, DEFAULT_CORS_CONFIG.allowedOrigins);
});

test("normalizeCorsConfig merges partial config", () => {
  const result = normalizeCorsConfig({
    allowedOrigins: ["https://custom.com"],
    credentials: false,
  });
  assert.deepEqual(result.allowedOrigins, ["https://custom.com"]);
  assert.equal(result.credentials, false);
  assert.deepEqual(result.allowedMethods, DEFAULT_CORS_CONFIG.allowedMethods);
});

test("normalizeCorsConfig lowercases allowed headers", () => {
  const result = normalizeCorsConfig({
    allowedHeaders: ["CONTENT-TYPE", "AUTHORIZATION", "X-CUSTOM"],
  });
  assert.deepEqual(result.allowedHeaders, ["content-type", "authorization", "x-custom"]);
});

test("normalizeCorsConfig ignores empty arrays", () => {
  const result = normalizeCorsConfig({
    allowedOrigins: [],
  });
  assert.deepEqual(result.allowedOrigins, DEFAULT_CORS_CONFIG.allowedOrigins);
});

test("isOriginAllowed returns false for undefined origin", () => {
  const result = isOriginAllowed(undefined, DEFAULT_CORS_CONFIG);
  assert.equal(result, false);
});

test("isOriginAllowed returns false for empty origin", () => {
  const result = isOriginAllowed("", DEFAULT_CORS_CONFIG);
  assert.equal(result, false);
});

test("isOriginAllowed returns true for wildcard config", () => {
  const config = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["*"] };
  assert.equal(isOriginAllowed("https://any.com", config), true);
});

test("isOriginAllowed matches exact origin", () => {
  const config = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["https://exact.com"] };
  assert.equal(isOriginAllowed("https://exact.com", config), true);
  assert.equal(isOriginAllowed("https://other.com", config), false);
});

test("isOriginAllowed trims origin before matching", () => {
  const config = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["https://example.com"] };
  assert.equal(isOriginAllowed("  https://example.com  ", config), true);
});

test("buildPreflightHeaders returns empty for disallowed origin", () => {
  // Use config with specific origins (not wildcard)
  const config = normalizeCorsConfig({ allowedOrigins: ["https://allowed.com"] });
  const headers = buildPreflightHeaders("https://evil.com", config);
  assert.deepEqual(headers, {});
});

test("buildPreflightHeaders includes CORS headers for allowed origin", () => {
  const config = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["https://example.com"] };
  const headers = buildPreflightHeaders("https://example.com", config);
  assert.equal(headers["access-control-allow-origin"], "https://example.com");
  assert.equal(headers["access-control-allow-methods"], "GET, POST, OPTIONS");
  assert.equal(headers["access-control-allow-headers"], "content-type, authorization, x-request-id, x-api-key, accept-version");
  assert.equal(headers["access-control-max-age"], "86400");
});

test("buildPreflightHeaders rejects wildcard when credentials are enabled", () => {
  const config = {
    ...DEFAULT_CORS_CONFIG,
    allowedOrigins: ["*"],
    credentials: true,
  };
  const headers = buildPreflightHeaders("https://example.com", config);
  assert.deepEqual(headers, {});
});

test("buildPreflightHeaders adds vary header", () => {
  const config = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["https://example.com"] };
  const headers = buildPreflightHeaders("https://example.com", config);
  assert.equal(headers["vary"], "Origin");
});

test("decorateResponseHeaders adds security headers", () => {
  const payload: ApiResponsePayload = {
    statusCode: 200,
    body: "test body",
    headers: {},
  };
  const result = decorateResponseHeaders(payload, undefined, DEFAULT_CORS_CONFIG, undefined);
  assert.equal(result.headers["content-security-policy"], "default-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' ws: wss:; object-src 'none'");
  assert.equal(result.headers["strict-transport-security"], "max-age=31536000; includeSubDomains");
  assert.equal(result.headers["x-frame-options"], "DENY");
  assert.equal(result.headers["x-content-type-options"], "nosniff");
});

test("decorateResponseHeaders adds versioning headers", () => {
  const payload: ApiResponsePayload = {
    statusCode: 200,
    body: "test body",
    headers: {},
  };
  const result = decorateResponseHeaders(payload, undefined, DEFAULT_CORS_CONFIG, undefined);
  assert.equal(result.headers["x-api-version"], "v1");
});

test("decorateResponseHeaders computes content-length for short bodies", () => {
  const payload: ApiResponsePayload = {
    statusCode: 200,
    body: "hello",
    headers: {},
  };
  const result = decorateResponseHeaders(payload, undefined, DEFAULT_CORS_CONFIG, undefined);
  assert.equal(result.headers["content-length"], "5");
});

test("decorateResponseHeaders preserves existing headers", () => {
  const payload: ApiResponsePayload = {
    statusCode: 200,
    body: "test",
    headers: { "x-custom": "value" },
  };
  const result = decorateResponseHeaders(payload, undefined, DEFAULT_CORS_CONFIG, undefined);
  assert.equal(result.headers["x-custom"], "value");
});

test("decorateResponseHeaders does not override content-length if set", () => {
  const payload: ApiResponsePayload = {
    statusCode: 200,
    body: "test",
    headers: { "content-length": "100" },
  };
  const result = decorateResponseHeaders(payload, undefined, DEFAULT_CORS_CONFIG, undefined);
  assert.equal(result.headers["content-length"], "100");
});

test("decorateResponseHeaders does not override content-encoding", () => {
  const payload: ApiResponsePayload = {
    statusCode: 200,
    body: "test",
    headers: { "content-encoding": "gzip" },
  };
  const result = decorateResponseHeaders(payload, undefined, DEFAULT_CORS_CONFIG);
  assert.ok(!result.headers["content-length"]);
});

test("decorateResponseHeaders adds CORS headers for allowed origin", () => {
  const config = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["https://example.com"] };
  const payload: ApiResponsePayload = {
    statusCode: 200,
    body: "test",
    headers: {},
  };
  const result = decorateResponseHeaders(payload, "https://example.com", config, undefined);
  assert.equal(result.headers["access-control-allow-origin"], "https://example.com");
});

test("decorateResponseHeaders appends Origin to existing vary", () => {
  const payload: ApiResponsePayload = {
    statusCode: 200,
    body: "test",
    headers: { vary: "Accept-Encoding" },
  };
  const config = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["https://example.com"] };
  const result = decorateResponseHeaders(payload, "https://example.com", config, undefined);
  assert.equal(result.headers["vary"], "Accept-Encoding, Origin");
});
