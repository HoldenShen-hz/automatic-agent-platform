import assert from "node:assert/strict";
import test from "node:test";

import type { ApiResponsePayload } from "../../../../../../src/platform/interface/api/http-server/types.js";
import {
  parseAllowedOrigins,
  normalizeCorsConfig,
  isOriginAllowed,
  buildPreflightHeaders,
  decorateResponseHeaders,
  DEFAULT_CORS_CONFIG,
  type CorsConfig,
} from "../../../../../../src/platform/interface/api/http-server/response-hardening.js";

test("DEFAULT_CORS_CONFIG has expected values", () => {
  assert.deepEqual(DEFAULT_CORS_CONFIG.allowedOrigins, ["*"]);
  assert.deepEqual(DEFAULT_CORS_CONFIG.allowedMethods, ["GET", "POST", "OPTIONS"]);
  assert.ok(DEFAULT_CORS_CONFIG.credentials);
  assert.equal(DEFAULT_CORS_CONFIG.maxAgeSeconds, 86_400);
});

test("parseAllowedOrigins returns default for undefined", () => {
  const result = parseAllowedOrigins(undefined);
  assert.deepEqual(result, ["*"]);
});

test("parseAllowedOrigins returns default for empty string", () => {
  const result = parseAllowedOrigins("");
  assert.deepEqual(result, ["*"]);
});

test("parseAllowedOrigins returns default for whitespace-only string", () => {
  const result = parseAllowedOrigins("   ");
  assert.deepEqual(result, ["*"]);
});

test("parseAllowedOrigins parses comma-separated origins", () => {
  const result = parseAllowedOrigins("https://app.example.com, https://admin.example.com");
  assert.deepEqual(result, ["https://app.example.com", "https://admin.example.com"]);
});

test("parseAllowedOrigins trims each origin", () => {
  const result = parseAllowedOrigins("  https://a.com  ,  https://b.com  ");
  assert.deepEqual(result, ["https://a.com", "https://b.com"]);
});

test("parseAllowedOrigins filters empty segments", () => {
  const result = parseAllowedOrigins("https://a.com,,https://b.com");
  assert.deepEqual(result, ["https://a.com", "https://b.com"]);
});

test("normalizeCorsConfig uses defaults for unspecified fields", () => {
  const result = normalizeCorsConfig({});
  assert.deepEqual(result.allowedOrigins, DEFAULT_CORS_CONFIG.allowedOrigins);
  assert.deepEqual(result.allowedMethods, DEFAULT_CORS_CONFIG.allowedMethods);
  assert.deepEqual(result.allowedHeaders, DEFAULT_CORS_CONFIG.allowedHeaders);
  assert.equal(result.maxAgeSeconds, DEFAULT_CORS_CONFIG.maxAgeSeconds);
  assert.equal(result.credentials, DEFAULT_CORS_CONFIG.credentials);
});

test("normalizeCorsConfig preserves provided origins", () => {
  const result = normalizeCorsConfig({ allowedOrigins: ["https://custom.com"] });
  assert.deepEqual(result.allowedOrigins, ["https://custom.com"]);
});

test("normalizeCorsConfig normalizes headers to lowercase", () => {
  const result = normalizeCorsConfig({ allowedHeaders: ["Content-Type", "Authorization"] });
  assert.deepEqual(result.allowedHeaders, ["content-type", "authorization"]);
});

test("normalizeCorsConfig handles null/undefined config", () => {
  const result1 = normalizeCorsConfig(null);
  assert.deepEqual(result1.allowedOrigins, ["*"]);
  const result2 = normalizeCorsConfig(undefined);
  assert.deepEqual(result2.allowedOrigins, ["*"]);
});

test("isOriginAllowed returns false for undefined origin", () => {
  const config: CorsConfig = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["https://app.com"] };
  assert.equal(isOriginAllowed(undefined, config), false);
});

test("isOriginAllowed returns false for empty origin", () => {
  const config: CorsConfig = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["https://app.com"] };
  assert.equal(isOriginAllowed("", config), false);
});

test("isOriginAllowed returns true when origin matches", () => {
  const config: CorsConfig = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["https://app.com"] };
  assert.equal(isOriginAllowed("https://app.com", config), true);
});

test("isOriginAllowed returns true for wildcard origin", () => {
  const config: CorsConfig = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["*"] };
  assert.equal(isOriginAllowed("https://any.com", config), true);
});

test("isOriginAllowed trims origin before checking", () => {
  const config: CorsConfig = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["https://app.com"] };
  assert.equal(isOriginAllowed("  https://app.com  ", config), true);
});

test("isOriginAllowed returns false for non-matching origin", () => {
  const config: CorsConfig = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["https://app.com"] };
  assert.equal(isOriginAllowed("https://other.com", config), false);
});

test("buildPreflightHeaders returns empty when origin not allowed", () => {
  const config: CorsConfig = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["https://app.com"] };
  const headers = buildPreflightHeaders("https://other.com", config);
  assert.deepEqual(headers, {});
});

test("buildPreflightHeaders returns correct headers for allowed origin", () => {
  const config: CorsConfig = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["https://app.com"] };
  const headers = buildPreflightHeaders("https://app.com", config);

  assert.equal(headers["access-control-allow-origin"], "https://app.com");
  assert.equal(headers["access-control-allow-methods"], "GET, POST, OPTIONS");
  assert.ok(headers["access-control-allow-headers"]);
  assert.equal(headers["access-control-max-age"], "86400");
  assert.equal(headers.vary, "Origin");
});

test("buildPreflightHeaders includes credentials header when enabled", () => {
  const config: CorsConfig = { ...DEFAULT_CORS_CONFIG, credentials: true, allowedOrigins: ["https://app.com"] };
  const headers = buildPreflightHeaders("https://app.com", config);

  assert.equal(headers["access-control-allow-credentials"], "true");
});

test("buildPreflightHeaders uses origin when credentials and wildcard", () => {
  const config: CorsConfig = { ...DEFAULT_CORS_CONFIG, credentials: true, allowedOrigins: ["*"] };
  const headers = buildPreflightHeaders("https://app.com", config);

  // With credentials=true and wildcard, must echo origin back
  assert.equal(headers["access-control-allow-origin"], "https://app.com");
  assert.equal(headers["access-control-allow-credentials"], "true");
});

test("buildPreflightHeaders uses wildcard without credentials", () => {
  const config: CorsConfig = { ...DEFAULT_CORS_CONFIG, credentials: false, allowedOrigins: ["*"] };
  const headers = buildPreflightHeaders("https://app.com", config);

  assert.equal(headers["access-control-allow-origin"], "*");
});

test("decorateResponseHeaders adds security headers", () => {
  const payload: ApiResponsePayload = {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: '{"ok":true}',
  };
  const result = decorateResponseHeaders(payload, undefined, DEFAULT_CORS_CONFIG);

  assert.equal(result.headers["content-security-policy"], "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  assert.equal(result.headers["strict-transport-security"], "max-age=31536000; includeSubDomains");
  assert.equal(result.headers["x-frame-options"], "DENY");
  assert.equal(result.headers["x-content-type-options"], "nosniff");
  assert.equal(result.headers["referrer-policy"], "no-referrer");
  assert.equal(result.headers["permissions-policy"], "camera=(), microphone=(), geolocation=()");
  assert.equal(result.headers["cross-origin-resource-policy"], "same-origin");
});

test("decorateResponseHeaders adds API version headers", () => {
  const payload: ApiResponsePayload = {
    statusCode: 200,
    headers: {},
    body: '{"ok":true}',
  };
  const result = decorateResponseHeaders(payload, undefined, DEFAULT_CORS_CONFIG);

  assert.equal(result.headers["x-api-version"], "v1");
  assert.ok(result.headers["x-app-version"]);
});

test("decorateResponseHeaders adds CORS headers when origin is allowed", () => {
  const config: CorsConfig = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["https://app.com"] };
  const payload: ApiResponsePayload = {
    statusCode: 200,
    headers: {},
    body: '{"ok":true}',
  };
  const result = decorateResponseHeaders(payload, "https://app.com", config);

  assert.equal(result.headers["access-control-allow-origin"], "https://app.com");
  assert.equal(result.headers["access-control-allow-credentials"], "true");
  assert.ok(result.headers.vary?.includes("Origin"));
});

test("decorateResponseHeaders computes content-length when not set", () => {
  const payload: ApiResponsePayload = {
    statusCode: 200,
    headers: {},
    body: '{"ok":true}',
  };
  const result = decorateResponseHeaders(payload, undefined, DEFAULT_CORS_CONFIG);

  // {"ok":true} is 11 bytes in UTF-8
  assert.equal(result.headers["content-length"], "11");
});

test("decorateResponseHeaders preserves existing content-length", () => {
  const payload: ApiResponsePayload = {
    statusCode: 200,
    headers: { "content-length": "100" },
    body: '{"ok":true}',
  };
  const result = decorateResponseHeaders(payload, undefined, DEFAULT_CORS_CONFIG);

  assert.equal(result.headers["content-length"], "100");
});

test("decorateResponseHeaders preserves existing transfer-encoding", () => {
  const payload: ApiResponsePayload = {
    statusCode: 200,
    headers: { "transfer-encoding": "chunked" },
    body: '{"ok":true}',
  };
  const result = decorateResponseHeaders(payload, undefined, DEFAULT_CORS_CONFIG);

  assert.equal(result.headers["transfer-encoding"], "chunked");
  assert.equal(result.headers["content-length"], undefined);
});

test("decorateResponseHeaders exposes cors headers when configured", () => {
  const config: CorsConfig = {
    ...DEFAULT_CORS_CONFIG,
    allowedOrigins: ["https://app.com"],
    exposedHeaders: ["x-custom-header"],
  };
  const payload: ApiResponsePayload = {
    statusCode: 200,
    headers: {},
    body: '{"ok":true}',
  };
  const result = decorateResponseHeaders(payload, "https://app.com", config);

  assert.equal(result.headers["access-control-expose-headers"], "x-custom-header");
});

test("decorateResponseHeaders does not add CORS for disallowed origin", () => {
  const config: CorsConfig = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["https://app.com"] };
  const payload: ApiResponsePayload = {
    statusCode: 200,
    headers: {},
    body: '{"ok":true}',
  };
  const result = decorateResponseHeaders(payload, "https://evil.com", config);

  assert.equal(result.headers["access-control-allow-origin"], undefined);
});
