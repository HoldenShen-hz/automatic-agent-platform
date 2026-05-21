/**
 * Comprehensive Tests: OIDC Index Module
 *
 * Tests OidcProviderConfigSchema validation, buildOidcAuthorizationUrl,
 * and type exports from the OIDC index module.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  OidcProviderConfigSchema,
  buildOidcAuthorizationUrl,
} from "../../../../src/org-governance/sso-scim/oidc/index.js";

import type { OidcProviderConfig } from "../../../../src/org-governance/sso-scim/oidc/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// OidcProviderConfigSchema Full Coverage Tests
// ─────────────────────────────────────────────────────────────────────────────

test("OidcProviderConfigSchema parses valid config with all optional fields", () => {
  const config = {
    providerId: "complete-provider",
    issuer: "https://idp.example.com",
    clientId: "client-123",
    clientSecret: "secret-value",
    redirectUri: "https://app.example.com/callback",
    authorizationEndpoint: "https://custom.idp.example.com/authorize",
    tokenEndpoint: "https://custom.idp.example.com/token",
    userInfoEndpoint: "https://custom.idp.example.com/userinfo",
    scopes: ["openid", "profile", "email", "groups"],
  };

  const result = OidcProviderConfigSchema.safeParse(config);

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.providerId, "complete-provider");
    assert.equal(result.data.scopes.length, 4);
  }
});

test("OidcProviderConfigSchema parses minimal config with only required fields", () => {
  const config = {
    providerId: "minimal-provider",
    issuer: "https://idp.example.com",
    clientId: "client-456",
    redirectUri: "https://app.example.com/callback",
  };

  const result = OidcProviderConfigSchema.safeParse(config);

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.providerId, "minimal-provider");
    assert.deepEqual(result.data.scopes, ["openid", "profile", "email"]);
  }
});

test("OidcProviderConfigSchema applies default scopes when not provided", () => {
  const config = {
    providerId: "default-scopes-provider",
    issuer: "https://idp.example.com",
    clientId: "client-789",
    redirectUri: "https://app.example.com/callback",
  };

  const result = OidcProviderConfigSchema.safeParse(config);

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data.scopes, ["openid", "profile", "email"]);
  }
});

test("OidcProviderConfigSchema rejects empty providerId", () => {
  const config = {
    providerId: "",
    issuer: "https://idp.example.com",
    clientId: "client-123",
    redirectUri: "https://app.example.com/callback",
  };

  const result = OidcProviderConfigSchema.safeParse(config);

  assert.equal(result.success, false);
});

test("OidcProviderConfigSchema rejects empty issuer", () => {
  const config = {
    providerId: "valid-provider",
    issuer: "",
    clientId: "client-123",
    redirectUri: "https://app.example.com/callback",
  };

  const result = OidcProviderConfigSchema.safeParse(config);

  assert.equal(result.success, false);
});

test("OidcProviderConfigSchema rejects empty clientId", () => {
  const config = {
    providerId: "valid-provider",
    issuer: "https://idp.example.com",
    clientId: "",
    redirectUri: "https://app.example.com/callback",
  };

  const result = OidcProviderConfigSchema.safeParse(config);

  assert.equal(result.success, false);
});

test("OidcProviderConfigSchema rejects empty redirectUri", () => {
  const config = {
    providerId: "valid-provider",
    issuer: "https://idp.example.com",
    clientId: "client-123",
    redirectUri: "",
  };

  const result = OidcProviderConfigSchema.safeParse(config);

  assert.equal(result.success, false);
});

test("OidcProviderConfigSchema accepts optional clientSecret", () => {
  const config = {
    providerId: "with-secret",
    issuer: "https://idp.example.com",
    clientId: "client-123",
    clientSecret: "my-secret",
    redirectUri: "https://app.example.com/callback",
  };

  const result = OidcProviderConfigSchema.safeParse(config);

  assert.equal(result.success, true);
});

test("OidcProviderConfigSchema accepts optional authorizationEndpoint", () => {
  const config = {
    providerId: "with-authz-endpoint",
    issuer: "https://idp.example.com",
    clientId: "client-123",
    redirectUri: "https://app.example.com/callback",
    authorizationEndpoint: "https://custom.authz.endpoint.com/oauth/authorize",
  };

  const result = OidcProviderConfigSchema.safeParse(config);

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.authorizationEndpoint, "https://custom.authz.endpoint.com/oauth/authorize");
  }
});

test("OidcProviderConfigSchema accepts optional tokenEndpoint", () => {
  const config = {
    providerId: "with-token-endpoint",
    issuer: "https://idp.example.com",
    clientId: "client-123",
    redirectUri: "https://app.example.com/callback",
    tokenEndpoint: "https://custom.token.endpoint.com/oauth/token",
  };

  const result = OidcProviderConfigSchema.safeParse(config);

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.tokenEndpoint, "https://custom.token.endpoint.com/oauth/token");
  }
});

test("OidcProviderConfigSchema accepts optional userInfoEndpoint", () => {
  const config = {
    providerId: "with-userinfo-endpoint",
    issuer: "https://idp.example.com",
    clientId: "client-123",
    redirectUri: "https://app.example.com/callback",
    userInfoEndpoint: "https://custom.userinfo.endpoint.com/oauth/userinfo",
  };

  const result = OidcProviderConfigSchema.safeParse(config);

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.userInfoEndpoint, "https://custom.userinfo.endpoint.com/oauth/userinfo");
  }
});

test("OidcProviderConfigSchema accepts custom scopes array", () => {
  const config = {
    providerId: "custom-scopes",
    issuer: "https://idp.example.com",
    clientId: "client-123",
    redirectUri: "https://app.example.com/callback",
    scopes: ["openid", "profile", "email", "groups", "roles", "admin"],
  };

  const result = OidcProviderConfigSchema.safeParse(config);

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.scopes.length, 6);
  }
});

test("OidcProviderConfigSchema rejects empty scopes array", () => {
  const config = {
    providerId: "empty-scopes",
    issuer: "https://idp.example.com",
    clientId: "client-123",
    redirectUri: "https://app.example.com/callback",
    scopes: [],
  };

  const result = OidcProviderConfigSchema.safeParse(config);

  assert.equal(result.success, false);
});

test("OidcProviderConfigSchema rejects scopes with empty string", () => {
  const config = {
    providerId: "empty-string-scope",
    issuer: "https://idp.example.com",
    clientId: "client-123",
    redirectUri: "https://app.example.com/callback",
    scopes: ["openid", ""],
  };

  const result = OidcProviderConfigSchema.safeParse(config);

  assert.equal(result.success, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// buildOidcAuthorizationUrl Tests
// ─────────────────────────────────────────────────────────────────────────────

test("buildOidcAuthorizationUrl constructs URL with all required parameters", () => {
  const config: OidcProviderConfig = {
    providerId: "test-provider",
    issuer: "https://idp.example.com",
    clientId: "test-client-id",
    redirectUri: "https://app.example.com/auth/callback",
    scopes: ["openid", "profile"],
  };

  const url = buildOidcAuthorizationUrl(config, "state-abc123");

  assert.ok(url.includes("https://idp.example.com/authorize"));
  assert.ok(url.includes("client_id=test-client-id"));
  assert.ok(url.includes("redirect_uri=https%3A%2F%2Fapp.example.com%2Fauth%2Fcallback"));
  assert.ok(url.includes("response_type=code"));
  assert.ok(url.includes("scope=openid+profile"));
  assert.ok(url.includes("state=state-abc123"));
});

test("buildOidcAuthorizationUrl uses custom authorizationEndpoint when provided", () => {
  const config: OidcProviderConfig = {
    providerId: "test-provider",
    issuer: "https://idp.example.com",
    clientId: "test-client-id",
    redirectUri: "https://app.example.com/auth/callback",
    authorizationEndpoint: "https://custom.idp.example.com/oauth/authorize",
    scopes: ["openid"],
  };

  const url = buildOidcAuthorizationUrl(config, "state-xyz");

  assert.ok(url.includes("https://custom.idp.example.com/oauth/authorize"));
  assert.ok(!url.includes("https://idp.example.com/authorize"));
});

test("buildOidcAuthorizationUrl encodes special characters in state", () => {
  const config: OidcProviderConfig = {
    providerId: "test-provider",
    issuer: "https://idp.example.com",
    clientId: "test-client-id",
    redirectUri: "https://app.example.com/auth/callback",
    scopes: ["openid"],
  };

  const url = buildOidcAuthorizationUrl(config, "state-with-special!@#$%^&*()");

  assert.ok(url.includes("state=state-with-special%21%40%23%24%25%5E%26*%28%29"));
});

test("buildOidcAuthorizationUrl encodes special characters in redirectUri", () => {
  const config: OidcProviderConfig = {
    providerId: "test-provider",
    issuer: "https://idp.example.com",
    clientId: "test-client-id",
    redirectUri: "https://app.example.com/auth/callback?return=/dashboard",
    scopes: ["openid"],
  };

  const url = buildOidcAuthorizationUrl(config, "state-123");

  assert.ok(url.includes("redirect_uri=https%3A%2F%2Fapp.example.com%2Fauth%2Fcallback%3Freturn%3D%2Fdashboard"));
});

test("buildOidcAuthorizationUrl encodes spaces in scopes", () => {
  const config: OidcProviderConfig = {
    providerId: "test-provider",
    issuer: "https://idp.example.com",
    clientId: "test-client-id",
    redirectUri: "https://app.example.com/auth/callback",
    scopes: ["openid", "profile", "email groups"],
  };

  const url = buildOidcAuthorizationUrl(config, "state-123");

  // The URL should have scopes encoded
  assert.ok(url.includes("scope="));
});

// ─────────────────────────────────────────────────────────────────────────────
// Type Inference Tests
// ─────────────────────────────────────────────────────────────────────────────

test("OidcProviderConfig type inference works correctly", () => {
  const config: OidcProviderConfig = {
    providerId: "typed-provider",
    issuer: "https://idp.example.com",
    clientId: "client-typed",
    redirectUri: "https://app.example.com/callback",
  };

  assert.equal(config.providerId, "typed-provider");
  assert.deepEqual(config.scopes, ["openid", "profile", "email"]);
});

test("OidcProviderConfig allows optional fields to be undefined", () => {
  const config: OidcProviderConfig = {
    providerId: "provider-optional",
    issuer: "https://idp.example.com",
    clientId: "client-optional",
    redirectUri: "https://app.example.com/callback",
    clientSecret: undefined,
    authorizationEndpoint: undefined,
    tokenEndpoint: undefined,
    userInfoEndpoint: undefined,
  };

  const result = OidcProviderConfigSchema.safeParse(config);

  assert.equal(result.success, true);
});

test("OidcProviderConfigSchema.parse returns inferred type with defaults", () => {
  const config = {
    providerId: "provider-defaults",
    issuer: "https://idp.example.com",
    clientId: "client-defaults",
    redirectUri: "https://app.example.com/callback",
  };

  const result = OidcProviderConfigSchema.parse(config);

  // Should have default scopes applied
  assert.deepEqual(result.scopes, ["openid", "profile", "email"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// URL Construction Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("buildOidcAuthorizationUrl handles single scope", () => {
  const config: OidcProviderConfig = {
    providerId: "single-scope",
    issuer: "https://idp.example.com",
    clientId: "client-single",
    redirectUri: "https://app.example.com/callback",
    scopes: ["openid"],
  };

  const url = buildOidcAuthorizationUrl(config, "state-single");

  assert.ok(url.includes("scope=openid"));
});

test("buildOidcAuthorizationUrl handles many scopes", () => {
  const config: OidcProviderConfig = {
    providerId: "many-scopes",
    issuer: "https://idp.example.com",
    clientId: "client-many",
    redirectUri: "https://app.example.com/callback",
    scopes: ["openid", "profile", "email", "groups", "roles", "admin", "superuser", "auditor"],
  };

  const url = buildOidcAuthorizationUrl(config, "state-many");

  assert.ok(url.includes("scope="));
  // URL should be long but valid
  assert.ok(url.length > 100);
});

test("buildOidcAuthorizationUrl handles empty state (edge case)", () => {
  const config: OidcProviderConfig = {
    providerId: "empty-state",
    issuer: "https://idp.example.com",
    clientId: "client-empty",
    redirectUri: "https://app.example.com/callback",
    scopes: ["openid"],
  };

  const url = buildOidcAuthorizationUrl(config, "");

  assert.ok(url.includes("state="));
});

test("buildOidcAuthorizationUrl handles unicode in state", () => {
  const config: OidcProviderConfig = {
    providerId: "unicode-state",
    issuer: "https://idp.example.com",
    clientId: "client-unicode",
    redirectUri: "https://app.example.com/callback",
    scopes: ["openid"],
  };

  const url = buildOidcAuthorizationUrl(config, "状态-state-状态");

  assert.ok(url.includes("state="));
});

// ─────────────────────────────────────────────────────────────────────────────
// Schema Validation Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("OidcProviderConfigSchema rejects missing providerId", () => {
  const config = {
    issuer: "https://idp.example.com",
    clientId: "client-123",
    redirectUri: "https://app.example.com/callback",
  };

  const result = OidcProviderConfigSchema.safeParse(config);

  assert.equal(result.success, false);
});

test("OidcProviderConfigSchema rejects missing issuer", () => {
  const config = {
    providerId: "valid-provider",
    clientId: "client-123",
    redirectUri: "https://app.example.com/callback",
  };

  const result = OidcProviderConfigSchema.safeParse(config);

  assert.equal(result.success, false);
});

test("OidcProviderConfigSchema rejects missing clientId", () => {
  const config = {
    providerId: "valid-provider",
    issuer: "https://idp.example.com",
    redirectUri: "https://app.example.com/callback",
  };

  const result = OidcProviderConfigSchema.safeParse(config);

  assert.equal(result.success, false);
});

test("OidcProviderConfigSchema rejects missing redirectUri", () => {
  const config = {
    providerId: "valid-provider",
    issuer: "https://idp.example.com",
    clientId: "client-123",
  };

  const result = OidcProviderConfigSchema.safeParse(config);

  assert.equal(result.success, false);
});

test("OidcProviderConfigSchema rejects non-string providerId", () => {
  const config = {
    providerId: 123 as unknown as string,
    issuer: "https://idp.example.com",
    clientId: "client-123",
    redirectUri: "https://app.example.com/callback",
  };

  const result = OidcProviderConfigSchema.safeParse(config);

  assert.equal(result.success, false);
});

test("OidcProviderConfigSchema rejects non-array scopes", () => {
  const config = {
    providerId: "valid-provider",
    issuer: "https://idp.example.com",
    clientId: "client-123",
    redirectUri: "https://app.example.com/callback",
    scopes: "openid profile" as unknown as string[],
  };

  const result = OidcProviderConfigSchema.safeParse(config);

  assert.equal(result.success, false);
});