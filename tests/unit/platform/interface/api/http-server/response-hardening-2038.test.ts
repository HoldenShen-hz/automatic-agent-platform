/**
 * @fileoverview Unit tests for HTTP Server Response Hardening - Issue #2038
 *
 * ISSUE #2038: CORS origin:"*" + credentials:true security anti-pattern
 *
 * When credentials are enabled, we must NEVER allow wildcard origin.
 * The ["*"] + credentials:true pattern creates a security vulnerability
 * where credentials would be sent to any origin.
 *
 * This test suite verifies the runtime rejection of this anti-pattern.
 */

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
import type { ApiResponsePayload } from "../../../../../../src/platform/interface/api/http-server/types.js";

// ── Issue #2038: CORS wildcard + credentials security anti-pattern ──────────────

/**
 * ISSUE #2038 TEST SUITE
 *
 * The security anti-pattern: origin:"*" + credentials:true
 * When credentials are enabled, wildcard origin MUST be rejected at runtime.
 *
 * normalizeCorsConfig allows this configuration (no throw), but isOriginAllowed
 * and buildPreflightHeaders reject it at request time.
 */

test("ISSUE #2038: isOriginAllowed rejects wildcard origin when credentials are true", () => {
  // Security anti-pattern: origin="*" with credentials=true
  const config = {
    ...DEFAULT_CORS_CONFIG,
    allowedOrigins: ["*"],
    credentials: true,
  };

  // Runtime check: credentials:true forces rejection of wildcard
  assert.equal(isOriginAllowed("https://any-website.com", config), false);
});

test("ISSUE #2038: isOriginAllowed allows wildcard origin when credentials are false", () => {
  const config = {
    ...DEFAULT_CORS_CONFIG,
    allowedOrigins: ["*"],
    credentials: false,
  };

  // When credentials=false, wildcard is allowed
  assert.equal(isOriginAllowed("https://any-website.com", config), true);
});

test("ISSUE #2038: isOriginAllowed rejects wildcard origin for any requested origin when credentials enabled", () => {
  const config = {
    ...DEFAULT_CORS_CONFIG,
    allowedOrigins: ["*"],
    credentials: true,
  };

  // Any origin requested should be rejected when wildcard+credentials
  assert.equal(isOriginAllowed("https://evil.com", config), false);
  assert.equal(isOriginAllowed("https://trusted.com", config), false);
  assert.equal(isOriginAllowed("https://bank.com", config), false);
});

test("ISSUE #2038: buildPreflightHeaders returns empty when wildcard is paired with credentials", () => {
  const config = {
    ...DEFAULT_CORS_CONFIG,
    allowedOrigins: ["*"],
    credentials: true,
  };

  const headers = buildPreflightHeaders("https://example.com", config);

  assert.deepEqual(headers, {});
});

test("ISSUE #2038: buildPreflightHeaders uses wildcard when credentials are disabled", () => {
  const config = {
    ...DEFAULT_CORS_CONFIG,
    allowedOrigins: ["*"],
    credentials: false,
  };

  const headers = buildPreflightHeaders("https://any-origin.com", config);

  assert.equal(headers["access-control-allow-origin"], "https://any-origin.com");
  assert.equal(headers["access-control-allow-credentials"], undefined);
});

test("ISSUE #2038: decorateResponseHeaders omits CORS headers when credentials-enabled wildcard is configured", () => {
  const payload: ApiResponsePayload = {
    statusCode: 200,
    headers: {},
    body: "test",
  };
  const config = {
    ...DEFAULT_CORS_CONFIG,
    allowedOrigins: ["*"],
    credentials: true,
  };

  const result = decorateResponseHeaders(payload, "https://myapp.com", config, undefined);

  assert.equal(result.headers["access-control-allow-origin"], undefined);
  assert.equal(result.headers["access-control-allow-credentials"], undefined);
});

test("ISSUE #2038: decorateResponseHeaders does NOT add CORS headers when origin is disallowed", () => {
  const payload: ApiResponsePayload = {
    statusCode: 200,
    headers: {},
    body: "test",
  };
  const config = {
    ...DEFAULT_CORS_CONFIG,
    allowedOrigins: ["*"],
    credentials: true,
  };

  // When origin is not allowed (wildcard + credentials rejects all),
  // no CORS headers should be added
  const result = decorateResponseHeaders(payload, "https://any-site.com", config, undefined);

  assert.equal(result.headers["access-control-allow-origin"], undefined);
  assert.equal(result.headers["access-control-allow-credentials"], undefined);
});

test("ISSUE #2038: normalizeCorsConfig does NOT throw for wildcard+credentials (documents current behavior)", () => {
  // The normalizeCorsConfig function does NOT currently reject this anti-pattern.
  // It passes the configuration through. The rejection happens at RUNTIME.
  // This documents the current behavior - the fix should add config-time rejection.
  const config = normalizeCorsConfig({
    allowedOrigins: ["*"],
    credentials: true,
  });

  // Configuration is allowed (no throw)
  assert.deepEqual(config.allowedOrigins, ["*"]);
  assert.equal(config.credentials, true);

  // But runtime check rejects it
  assert.equal(isOriginAllowed("https://example.com", config), false);
});

test("ISSUE #2038: buildPreflightHeaders returns empty when origin not allowed", () => {
  const config = {
    ...DEFAULT_CORS_CONFIG,
    allowedOrigins: ["*"],
    credentials: true,
  };

  const headers = buildPreflightHeaders("https://example.com", config);
  assert.deepEqual(headers, {});
});

// ── Non-issue tests: Normal CORS behavior ─────────────────────────────────────

test("isOriginAllowed returns false for undefined origin", () => {
  const config = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["https://example.com"] };
  assert.equal(isOriginAllowed(undefined, config), false);
});

test("isOriginAllowed returns false for empty string origin", () => {
  const config = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["https://example.com"] };
  assert.equal(isOriginAllowed("", config), false);
});

test("isOriginAllowed returns true when origin matches an allowed origin", () => {
  const config = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["https://example.com"] };
  assert.equal(isOriginAllowed("https://example.com", config), true);
});

test("isOriginAllowed returns false when origin does not match any allowed origin", () => {
  const config = { ...DEFAULT_CORS_CONFIG, allowedOrigins: ["https://example.com"] };
  assert.equal(isOriginAllowed("https://other.com", config), false);
});

test("buildPreflightHeaders includes allow methods and headers", () => {
  const config = {
    ...DEFAULT_CORS_CONFIG,
    allowedOrigins: ["https://example.com"],
    allowedMethods: ["GET", "POST", "PUT"],
    allowedHeaders: ["content-type", "authorization"],
  };
  const headers = buildPreflightHeaders("https://example.com", config);
  assert.equal(headers["access-control-allow-methods"], "GET, POST, PUT");
  assert.equal(headers["access-control-allow-headers"], "content-type, authorization");
});

test("decorateResponseHeaders adds all required security headers", () => {
  const payload: ApiResponsePayload = {
    statusCode: 200,
    headers: {},
    body: "test",
  };
  const result = decorateResponseHeaders(payload, undefined, DEFAULT_CORS_CONFIG, undefined);
  assert.equal(result.headers["content-security-policy"], "default-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' ws: wss:; object-src 'none'");
  assert.equal(result.headers["strict-transport-security"], "max-age=31536000; includeSubDomains");
  assert.equal(result.headers["x-frame-options"], "DENY");
  assert.equal(result.headers["x-content-type-options"], "nosniff");
  assert.equal(result.headers["referrer-policy"], "no-referrer");
  assert.equal(result.headers["permissions-policy"], "camera=(), microphone=(), geolocation=()");
  assert.equal(result.headers["cross-origin-resource-policy"], "same-origin");
});

test("decorateResponseHeaders preserves existing custom headers", () => {
  const payload: ApiResponsePayload = {
    statusCode: 200,
    headers: { "x-custom-header": "custom-value" },
    body: "test",
  };
  const result = decorateResponseHeaders(payload, undefined, DEFAULT_CORS_CONFIG, undefined);
  assert.equal(result.headers["x-custom-header"], "custom-value");
});

test("decorateResponseHeaders calculates content-length for plain text body", () => {
  const payload: ApiResponsePayload = {
    statusCode: 200,
    headers: {},
    body: "hello world",
  };
  const result = decorateResponseHeaders(payload, undefined, DEFAULT_CORS_CONFIG, undefined);
  assert.equal(result.headers["content-length"], "11");
});

test("decorateResponseHeaders does not override content-length when already set", () => {
  const payload: ApiResponsePayload = {
    statusCode: 200,
    headers: { "content-length": "100" },
    body: "hello world",
  };
  const result = decorateResponseHeaders(payload, undefined, DEFAULT_CORS_CONFIG, undefined);
  assert.equal(result.headers["content-length"], "100");
});

test("decorateResponseHeaders does not set content-length when transfer-encoding is present", () => {
  const payload: ApiResponsePayload = {
    statusCode: 200,
    headers: { "transfer-encoding": "chunked" },
    body: "hello world",
  };
  const result = decorateResponseHeaders(payload, undefined, DEFAULT_CORS_CONFIG);
  assert.equal(result.headers["content-length"], undefined);
});

test("parseAllowedOrigins returns default for undefined input", () => {
  const result = parseAllowedOrigins(undefined);
  assert.deepEqual(result, DEFAULT_CORS_CONFIG.allowedOrigins);
});

test("parseAllowedOrigins returns default for empty string", () => {
  const result = parseAllowedOrigins("");
  assert.deepEqual(result, DEFAULT_CORS_CONFIG.allowedOrigins);
});

test("parseAllowedOrigins parses comma-separated origins with trimming", () => {
  const result = parseAllowedOrigins("https://example.com, https://api.example.com ");
  assert.deepEqual(result, ["https://example.com", "https://api.example.com"]);
});

test("normalizeCorsConfig uses default when empty array provided", () => {
  const result = normalizeCorsConfig({
    allowedOrigins: [],
  });
  assert.deepEqual(result.allowedOrigins, DEFAULT_CORS_CONFIG.allowedOrigins);
});

test("normalizeCorsConfig lowercases allowed headers", () => {
  const result = normalizeCorsConfig({
    allowedHeaders: ["CONTENT-TYPE", "AUTHORIZATION"],
  });
  assert.deepEqual(result.allowedHeaders, ["content-type", "authorization"]);
});

test("normalizeCorsConfig merges partial config with defaults", () => {
  const result = normalizeCorsConfig({
    allowedOrigins: ["https://custom.com"],
    credentials: false,
  });
  assert.deepEqual(result.allowedOrigins, ["https://custom.com"]);
  assert.equal(result.credentials, false);
  assert.deepEqual(result.allowedMethods, DEFAULT_CORS_CONFIG.allowedMethods);
});

test("response hardening exposes Accept-Version for API version negotiation", () => {
  assert.ok(DEFAULT_CORS_CONFIG.allowedHeaders.includes("accept-version"));
});

test("decorateResponseHeaders adds API deprecation and version support headers", () => {
  const payload: ApiResponsePayload = {
    statusCode: 200,
    headers: {},
    body: "test",
  };

  const result = decorateResponseHeaders(payload, undefined, DEFAULT_CORS_CONFIG);

  assert.equal(result.headers["x-api-version"], "v1");
  assert.equal(result.headers["deprecation"], "true");
  assert.equal(result.headers["sunset"], "Thu, 31 Dec 2025 23:59:59 GMT");
  assert.equal(result.headers["api-version-support"], "v1;v2");
});
