/**
 * R25-02 Audit Verification Tests for CORS credentials with wildcard origins
 *
 * CRITICAL: CORS allowedOrigins=["*"] + credentials=true is a security anti-pattern.
 * When credentials=true with wildcard origin, browsers reject the request but the
 * code would echo back the wildcard. Section 6 explicitly prohibits this.
 *
 * These tests verify:
 * 1. normalizeCorsConfig throws when wildcard origins + credentials=true
 * 2. isOriginAllowed returns false for wildcard origins when credentials=true
 * 3. buildPreflightHeaders returns empty for wildcard origins when credentials=true
 * 4. resolveAllowOrigin does not echo wildcard when credentials=true
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_CORS_CONFIG,
  normalizeCorsConfig,
  isOriginAllowed,
  buildPreflightHeaders,
  decorateResponseHeaders,
  parseAllowedOrigins,
} from "../../../../../../src/platform/five-plane-interface/api/http-server/response-hardening.js";
import type { CorsConfig, ApiResponsePayload } from "../../../../../../src/platform/five-plane-interface/api/http-server/response-hardening.js";

test("R25-02: normalizeCorsConfig throws when wildcard origins + credentials=true", () => {
  assert.throws(
    () => normalizeCorsConfig({
      allowedOrigins: ["*"],
      credentials: true,
    }),
    /api\.cors\.invalid_wildcard_credentials/,
    "Must throw when wildcard origin combined with credentials=true"
  );
});

test("R25-02: normalizeCorsConfig allows wildcard origins with credentials=false", () => {
  const config = normalizeCorsConfig({
    allowedOrigins: ["*"],
    credentials: false,
  });
  assert.deepEqual(config.allowedOrigins, ["*"]);
  assert.equal(config.credentials, false);
});

test("R25-02: normalizeCorsConfig allows specific origins with credentials=true", () => {
  const config = normalizeCorsConfig({
    allowedOrigins: ["https://app.example.com"],
    credentials: true,
  });
  assert.deepEqual(config.allowedOrigins, ["https://app.example.com"]);
  assert.equal(config.credentials, true);
});

test("R25-02: isOriginAllowed returns false for wildcard when credentials=true", () => {
  const config: CorsConfig = {
    allowedOrigins: ["*"],
    allowedMethods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [],
    exposedHeaders: [],
    maxAgeSeconds: 86400,
    credentials: true,
  };
  // Browser would reject this, so we must not allow it
  assert.equal(
    isOriginAllowed("https://any-origin.com", config),
    false,
    "Wildcard origin with credentials=true must return false - browsers reject this"
  );
});

test("R25-02: isOriginAllowed returns true for wildcard when credentials=false", () => {
  const config: CorsConfig = {
    allowedOrigins: ["*"],
    allowedMethods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [],
    exposedHeaders: [],
    maxAgeSeconds: 86400,
    credentials: false,
  };
  assert.equal(isOriginAllowed("https://any-origin.com", config), true);
});

test("R25-02: isOriginAllowed matches specific origins when credentials=true", () => {
  const config: CorsConfig = {
    allowedOrigins: ["https://app.example.com"],
    allowedMethods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [],
    exposedHeaders: [],
    maxAgeSeconds: 86400,
    credentials: true,
  };
  assert.equal(isOriginAllowed("https://app.example.com", config), true);
  assert.equal(isOriginAllowed("https://evil.com", config), false);
});

test("R25-02: buildPreflightHeaders returns empty for wildcard origin when credentials=true", () => {
  const config: CorsConfig = {
    allowedOrigins: ["*"],
    allowedMethods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["content-type"],
    exposedHeaders: [],
    maxAgeSeconds: 86400,
    credentials: true,
  };
  const headers = buildPreflightHeaders("https://example.com", config);
  assert.deepEqual(
    headers,
    {},
    "Preflight must be rejected when wildcard origin + credentials (browser would reject)"
  );
});

test("R25-02: buildPreflightHeaders returns wildcard when credentials=false", () => {
  const config: CorsConfig = {
    allowedOrigins: ["*"],
    allowedMethods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["content-type"],
    exposedHeaders: [],
    maxAgeSeconds: 86400,
    credentials: false,
  };
  const headers = buildPreflightHeaders("https://example.com", config);
  assert.equal(headers["access-control-allow-origin"], "*");
  assert.equal(headers["access-control-allow-credentials"], undefined);
});

test("R25-02: buildPreflightHeaders returns specific origin with credentials header", () => {
  const config: CorsConfig = {
    allowedOrigins: ["https://app.example.com"],
    allowedMethods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["content-type"],
    exposedHeaders: [],
    maxAgeSeconds: 86400,
    credentials: true,
  };
  const headers = buildPreflightHeaders("https://app.example.com", config);
  assert.equal(headers["access-control-allow-origin"], "https://app.example.com");
  assert.equal(headers["access-control-allow-credentials"], "true");
});

test("R25-02: isOriginAllowed returns false for wildcard origin when credentials=true", () => {
  // This is equivalent to testing that resolveAllowOrigin returns null
  // for wildcard with credentials - the function is internal but we can
  // verify via isOriginAllowed which IS the gate for resolveAllowOrigin
  const config: CorsConfig = {
    allowedOrigins: ["*"],
    allowedMethods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [],
    exposedHeaders: [],
    maxAgeSeconds: 86400,
    credentials: true,
  };
  // isOriginAllowed is the gate - if it returns false, resolveAllowOrigin
  // would return null because isOriginAllowed is called first
  assert.equal(
    isOriginAllowed("https://example.com", config),
    false,
    "Must not allow wildcard origin when credentials=true"
  );
});

test("R25-02: isOriginAllowed returns true for wildcard origin when credentials=false", () => {
  const config: CorsConfig = {
    allowedOrigins: ["*"],
    allowedMethods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [],
    exposedHeaders: [],
    maxAgeSeconds: 86400,
    credentials: false,
  };
  // When credentials=false, wildcard should be allowed
  // This implies resolveAllowOrigin would return "*"
  assert.equal(
    isOriginAllowed("https://example.com", config),
    true,
    "Must allow wildcard origin when credentials=false"
  );
});

test("R25-02: decorateResponseHeaders does not echo wildcard with credentials=true", () => {
  const config: CorsConfig = {
    allowedOrigins: ["*"],
    allowedMethods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [],
    exposedHeaders: [],
    maxAgeSeconds: 86400,
    credentials: true,
  };
  const payload: ApiResponsePayload = {
    statusCode: 200,
    body: "test",
    headers: {},
  };
  const result = decorateResponseHeaders(payload, "https://example.com", config);
  // With credentials=true and wildcard origin, origin should be rejected
  // so no access-control-allow-origin header should be set
  assert.equal(
    result.headers["access-control-allow-origin"],
    undefined,
    "Must not echo wildcard origin when credentials=true"
  );
});

test("R25-02: decorateResponseHeaders echoes wildcard when credentials=false", () => {
  const config: CorsConfig = {
    allowedOrigins: ["*"],
    allowedMethods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [],
    exposedHeaders: [],
    maxAgeSeconds: 86400,
    credentials: false,
  };
  const payload: ApiResponsePayload = {
    statusCode: 200,
    body: "test",
    headers: {},
  };
  const result = decorateResponseHeaders(payload, "https://example.com", config);
  assert.equal(result.headers["access-control-allow-origin"], "*");
});

test("R25-02: DEFAULT_CORS_CONFIG must not have wildcard + credentials", () => {
  // Security baseline: production defaults must not violate CORS security
  const defaultConfig = DEFAULT_CORS_CONFIG;

  // If default has wildcard, credentials must be false
  if (defaultConfig.allowedOrigins.includes("*")) {
    assert.equal(
      defaultConfig.credentials,
      false,
      "DEFAULT_CORS_CONFIG with wildcard origin must have credentials=false"
    );
  }

  // If credentials is true, wildcard must not be in allowedOrigins
  if (defaultConfig.credentials) {
    assert.equal(
      defaultConfig.allowedOrigins.includes("*"),
      false,
      "DEFAULT_CORS_CONFIG with credentials=true must not have wildcard origin"
    );
  }
});

test("R25-02: normalizeCorsConfig rejects wildcard + credentials via explicit config object", () => {
  // Test the actual code path that was causing production issues
  const config: Partial<CorsConfig> = {
    allowedOrigins: ["*"],
    credentials: true,
  };

  assert.throws(
    () => normalizeCorsConfig(config),
    /api\.cors\.invalid_wildcard_credentials/,
    "normalizeCorsConfig must throw when explicitly passed wildcard + credentials"
  );
});

test("R25-02: parseAllowedOrigins defaults to restrictive empty array, not wildcard", () => {
  // When no ALLOWED_ORIGINS env var is set, parseAllowedOrigins should not
  // default to wildcard - this was the production security issue
  const result = parseAllowedOrigins(undefined);
  // Current implementation returns [] for undefined, which is restrictive
  assert.ok(
    !result.includes("*"),
    "parseAllowedOrigins must not default to wildcard when env var is unset"
  );
});

test("R25-02: Production environment should use specific origins, not wildcard", () => {
  // This test documents that production deployments must configure specific origins
  // The code now enforces that credentials=true requires specific origins
  const config = normalizeCorsConfig({
    allowedOrigins: ["https://production.example.com", "https://staging.example.com"],
    credentials: true,
  });

  assert.ok(config.allowedOrigins.length >= 1, "Production should configure specific origins");
  assert.ok(!config.allowedOrigins.includes("*"), "Production must not use wildcard");
  assert.equal(config.credentials, true);
});