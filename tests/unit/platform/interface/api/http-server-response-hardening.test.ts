import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_CORS_CONFIG,
  parseAllowedOrigins,
  normalizeCorsConfig,
  isOriginAllowed,
  buildPreflightHeaders,
  decorateResponseHeaders,
} from "../../../../../src/platform/interface/api/http-server/response-hardening.js";
import type { ApiResponsePayload } from "../../../../../src/platform/interface/api/http-server/types.js";

test("DEFAULT_CORS_CONFIG has correct structure", () => {
  assert.deepEqual(DEFAULT_CORS_CONFIG.allowedOrigins, ["*"]);
  assert.deepEqual(DEFAULT_CORS_CONFIG.allowedMethods, ["GET", "POST", "OPTIONS"]);
  assert.deepEqual(DEFAULT_CORS_CONFIG.allowedHeaders, ["content-type", "authorization", "x-request-id", "x-api-key"]);
  assert.deepEqual(DEFAULT_CORS_CONFIG.exposedHeaders, ["x-request-id", "x-api-version", "x-app-version"]);
  assert.equal(DEFAULT_CORS_CONFIG.maxAgeSeconds, 86_400);
  assert.equal(DEFAULT_CORS_CONFIG.credentials, true);
});

test("parseAllowedOrigins returns default for undefined input", () => {
  const result = parseAllowedOrigins(undefined);
  assert.deepEqual(result, ["*"]);
});

test("parseAllowedOrigins returns default for empty string", () => {
  const result = parseAllowedOrigins("");
  assert.deepEqual(result, ["*"]);
});

test("parseAllowedOrigins returns default for whitespace string", () => {
  const result = parseAllowedOrigins("   ");
  assert.deepEqual(result, ["*"]);
});

test("parseAllowedOrigins parses single origin", () => {
  const result = parseAllowedOrigins("https://example.com");
  assert.deepEqual(result, ["https://example.com"]);
});

test("parseAllowedOrigins parses multiple origins", () => {
  const result = parseAllowedOrigins("https://example.com, https://api.example.com , http://localhost:3000");
  assert.deepEqual(result, ["https://example.com", "https://api.example.com", "http://localhost:3000"]);
});

test("parseAllowedOrigins trims whitespace from origins", () => {
  const result = parseAllowedOrigins("  https://example.com  ");
  assert.deepEqual(result, ["https://example.com"]);
});

test("parseAllowedOrigins filters empty origins", () => {
  const result = parseAllowedOrigins("https://example.com,, https://api.example.com");
  assert.deepEqual(result, ["https://example.com", "https://api.example.com"]);
});

test("normalizeCorsConfig returns defaults for null input", () => {
  const result = normalizeCorsConfig(null);
  assert.deepEqual(result.allowedOrigins, DEFAULT_CORS_CONFIG.allowedOrigins);
  assert.deepEqual(result.allowedMethods, DEFAULT_CORS_CONFIG.allowedMethods);
  assert.deepEqual(result.allowedHeaders, DEFAULT_CORS_CONFIG.allowedHeaders);
  assert.deepEqual(result.exposedHeaders, DEFAULT_CORS_CONFIG.exposedHeaders);
  assert.equal(result.maxAgeSeconds, DEFAULT_CORS_CONFIG.maxAgeSeconds);
  assert.equal(result.credentials, DEFAULT_CORS_CONFIG.credentials);
});

test("normalizeCorsConfig returns defaults for undefined input", () => {
  const result = normalizeCorsConfig(undefined);
  assert.deepEqual(result.allowedOrigins, DEFAULT_CORS_CONFIG.allowedOrigins);
});

test("normalizeCorsConfig merges partial config with defaults", () => {
  const result = normalizeCorsConfig({
    allowedOrigins: ["https://example.com"],
  });
  assert.deepEqual(result.allowedOrigins, ["https://example.com"]);
  assert.deepEqual(result.allowedMethods, DEFAULT_CORS_CONFIG.allowedMethods);
});

test("normalizeCorsConfig lowercases headers", () => {
  const result = normalizeCorsConfig({
    allowedHeaders: ["CONTENT-TYPE", "AUTHORIZATION"],
  });
  assert.deepEqual(result.allowedHeaders, ["content-type", "authorization"]);
});

test("normalizeCorsConfig uses default when empty array provided", () => {
  const result = normalizeCorsConfig({
    allowedOrigins: [],
  });
  assert.deepEqual(result.allowedOrigins, DEFAULT_CORS_CONFIG.allowedOrigins);
});

test("isOriginAllowed returns false for undefined origin", () => {
  const config = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["https://example.com"] };
  assert.equal(isOriginAllowed(undefined, config), false);
});

test("isOriginAllowed returns false for empty string origin", () => {
  const config = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["https://example.com"] };
  assert.equal(isOriginAllowed("", config), false);
});

test("isOriginAllowed returns false for whitespace origin", () => {
  const config = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["https://example.com"] };
  assert.equal(isOriginAllowed("   ", config), false);
});

test("isOriginAllowed returns true when origin matches", () => {
  const config = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["https://example.com"] };
  assert.equal(isOriginAllowed("https://example.com", config), true);
});

test("isOriginAllowed returns true when origin matches with whitespace", () => {
  const config = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["https://example.com"] };
  assert.equal(isOriginAllowed("  https://example.com  ", config), true);
});

test("isOriginAllowed returns false when origin does not match", () => {
  const config = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["https://example.com"] };
  assert.equal(isOriginAllowed("https://other.com", config), false);
});

test("isOriginAllowed returns true for wildcard origin", () => {
  const config = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["*"] };
  assert.equal(isOriginAllowed("https://any.com", config), true);
});

test("buildPreflightHeaders returns empty headers when origin not allowed", () => {
  const config = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["https://example.com"] };
  const headers = buildPreflightHeaders("https://other.com", config);
  assert.deepEqual(headers, {});
});

test("buildPreflightHeaders includes allow origin when allowed", () => {
  const config = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["https://example.com"] };
  const headers = buildPreflightHeaders("https://example.com", config);
  assert.equal(headers["access-control-allow-origin"], "https://example.com");
});

test("buildPreflightHeaders returns wildcard for credential-less wildcard config", () => {
  const config = {
    ...DEFAULT_CORS_CONFIG,
    allowedOrigins: ["*"],
    credentials: false,
  };
  const headers = buildPreflightHeaders("https://example.com", config);
  assert.equal(headers["access-control-allow-origin"], "*");
});

test("buildPreflightHeaders returns origin for credential-wildcard config", () => {
  const config = {
    ...DEFAULT_CORS_CONFIG,
    allowedOrigins: ["*"],
    credentials: true,
  };
  const headers = buildPreflightHeaders("https://example.com", config);
  assert.equal(headers["access-control-allow-origin"], "https://example.com");
});

test("buildPreflightHeaders includes allow methods", () => {
  const config = { ...DEFAULT_CORS_CONFIG, allowedMethods: ["GET", "POST"] };
  const headers = buildPreflightHeaders("https://example.com", config);
  assert.equal(headers["access-control-allow-methods"], "GET, POST");
});

test("buildPreflightHeaders includes allow headers", () => {
  const config = { ...DEFAULT_CORS_CONFIG, allowedHeaders: ["content-type", "authorization"] };
  const headers = buildPreflightHeaders("https://example.com", config);
  assert.equal(headers["access-control-allow-headers"], "content-type, authorization");
});

test("buildPreflightHeaders includes max age", () => {
  const config = { ...DEFAULT_CORS_CONFIG, maxAgeSeconds: 3600 };
  const headers = buildPreflightHeaders("https://example.com", config);
  assert.equal(headers["access-control-max-age"], "3600");
});

test("buildPreflightHeaders includes credentials header when enabled", () => {
  const config = { ...DEFAULT_CORS_CONFIG, credentials: true };
  const headers = buildPreflightHeaders("https://example.com", config);
  assert.equal(headers["access-control-allow-credentials"], "true");
});

test("buildPreflightHeaders does not include credentials header when disabled", () => {
  const config = { ...DEFAULT_CORS_CONFIG, credentials: false };
  const headers = buildPreflightHeaders("https://example.com", config);
  assert.equal(headers["access-control-allow-credentials"], undefined);
});

test("buildPreflightHeaders includes vary header", () => {
  const headers = buildPreflightHeaders("https://example.com", DEFAULT_CORS_CONFIG);
  assert.equal(headers["vary"], "Origin");
});

test("decorateResponseHeaders adds security headers", () => {
  const payload: ApiResponsePayload = {
    statusCode: 200,
    headers: {},
    body: "test",
  };
  const result = decorateResponseHeaders(payload, undefined, DEFAULT_CORS_CONFIG);
  assert.equal(result.headers["content-security-policy"], "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  assert.equal(result.headers["strict-transport-security"], "max-age=31536000; includeSubDomains");
  assert.equal(result.headers["x-frame-options"], "DENY");
  assert.equal(result.headers["x-content-type-options"], "nosniff");
  assert.equal(result.headers["referrer-policy"], "no-referrer");
});

test("decorateResponseHeaders preserves existing headers", () => {
  const payload: ApiResponsePayload = {
    statusCode: 200,
    headers: { "custom-header": "value" },
    body: "test",
  };
  const result = decorateResponseHeaders(payload, undefined, DEFAULT_CORS_CONFIG);
  assert.equal(result.headers["custom-header"], "value");
});

test("decorateResponseHeaders adds CORS headers when origin allowed", () => {
  const payload: ApiResponsePayload = {
    statusCode: 200,
    headers: {},
    body: "test",
  };
  const config = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["https://example.com"] };
  const result = decorateResponseHeaders(payload, "https://example.com", config);
  assert.equal(result.headers["access-control-allow-origin"], "https://example.com");
  assert.equal(result.headers["access-control-allow-credentials"], "true");
});

test("decorateResponseHeaders adds exposed headers", () => {
  const payload: ApiResponsePayload = {
    statusCode: 200,
    headers: {},
    body: "test",
  };
  const config = {
    ...DEFAULT_CORS_CONFIG,
    allowedOrigins: ["https://example.com"],
    exposedHeaders: ["x-custom-header"],
  };
  const result = decorateResponseHeaders(payload, "https://example.com", config);
  assert.equal(result.headers["access-control-expose-headers"], "x-custom-header");
});

test("decorateResponseHeaders calculates content-length when not present", () => {
  const payload: ApiResponsePayload = {
    statusCode: 200,
    headers: {},
    body: "hello world",
  };
  const result = decorateResponseHeaders(payload, undefined, DEFAULT_CORS_CONFIG);
  assert.equal(result.headers["content-length"], "11");
});

test("decorateResponseHeaders does not override content-length when present", () => {
  const payload: ApiResponsePayload = {
    statusCode: 200,
    headers: { "content-length": "100" },
    body: "hello world",
  };
  const result = decorateResponseHeaders(payload, undefined, DEFAULT_CORS_CONFIG);
  assert.equal(result.headers["content-length"], "100");
});

test("decorateResponseHeaders does not set content-length when transfer-encoding present", () => {
  const payload: ApiResponsePayload = {
    statusCode: 200,
    headers: { "transfer-encoding": "chunked" },
    body: "hello world",
  };
  const result = decorateResponseHeaders(payload, undefined, DEFAULT_CORS_CONFIG);
  assert.equal(result.headers["content-length"], undefined);
});

test("decorateResponseHeaders does not set content-length when content-encoding present", () => {
  const payload: ApiResponsePayload = {
    statusCode: 200,
    headers: { "content-encoding": "gzip" },
    body: "hello world",
  };
  const result = decorateResponseHeaders(payload, undefined, DEFAULT_CORS_CONFIG);
  assert.equal(result.headers["content-length"], undefined);
});
