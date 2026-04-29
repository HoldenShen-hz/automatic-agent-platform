import assert from "node:assert/strict";
import test from "node:test";

import { ApiAuthService } from "../../../../../src/platform/interface/api/api-auth-service.js";

// ============================================================================
// API Key Validator Tests
// Validates API key acceptance, rejection, expiration, and permission checks
// ============================================================================

test("valid api key is accepted and exchanged for JWT token", () => {
  const service = new ApiAuthService({
    apiKeys: [
      {
        apiKey: "valid-test-key-12345",
        actorId: "test-actor",
        roles: ["viewer", "operator"],
      },
    ],
    jwtSecret: "test-secret-for-validation",
    tokenTtlMs: 60 * 60 * 1000,
  });

  const result = service.exchangeApiKey("valid-test-key-12345");

  assert.equal(result.tokenType, "Bearer", "token type should be Bearer");
  assert.ok(result.accessToken.length > 0, "access token should be present");
  assert.ok(result.expiresAt.length > 0, "expiresAt should be present");
  assert.equal(result.principal.actorId, "test-actor", "principal actorId should match");
  assert.deepEqual(result.principal.roles.sort(), ["operator", "viewer"], "principal roles should be sorted");
  assert.equal(result.principal.authMethod, "api_key", "auth method should be api_key");
  assert.equal(result.principal.tenantId, null, "tenantId should be null for key without tenant");
});

test("valid api key with tenant id includes tenant in principal", () => {
  const service = new ApiAuthService({
    apiKeys: [
      {
        apiKey: "tenant-key-abc123",
        actorId: "tenant-actor-1",
        roles: ["operator"],
        tenantId: "tenant-xyz-789",
      },
    ],
    jwtSecret: "test-secret-for-validation",
  });

  const result = service.exchangeApiKey("tenant-key-abc123");

  assert.equal(result.principal.tenantId, "tenant-xyz-789", "tenantId should be included");
  assert.equal(result.principal.actorId, "tenant-actor-1", "actorId should match");
});

test("invalid api key is rejected", () => {
  const service = new ApiAuthService({
    apiKeys: [
      {
        apiKey: "correct-key",
        actorId: "correct-actor",
        roles: ["viewer"],
      },
    ],
    jwtSecret: "test-secret",
  });

  assert.throws(
    () => service.exchangeApiKey("wrong-key"),
    (error: unknown) => {
      const err = error as { code?: string; statusCode?: number };
      return err.code === "api.invalid_api_key" && err.statusCode === 401;
    },
    "invalid API key should throw ApiAuthError with code api.invalid_api_key",
  );
});

test("invalid api key with correct length is rejected", () => {
  const service = new ApiAuthService({
    apiKeys: [
      {
        apiKey: "key-with-specific-length",
        actorId: "actor-1",
        roles: ["viewer"],
      },
    ],
    jwtSecret: "test-secret",
  });

  // Key with same length but different content should be rejected
  assert.throws(
    () => service.exchangeApiKey("key-with-specific-lengthX"),
    (error: unknown) => {
      const err = error as { code?: string; statusCode?: number };
      return err.code === "api.invalid_api_key" && err.statusCode === 401;
    },
    "API key with correct length but wrong content should be rejected",
  );
});

test("expired api key is rejected via token expiration", () => {
  const service = new ApiAuthService({
    apiKeys: [
      {
        apiKey: "expirable-key",
        actorId: "expirable-actor",
        roles: ["viewer"],
      },
    ],
    jwtSecret: "test-secret",
    tokenTtlMs: 1, // 1ms TTL - essentially immediately expired
  });

  // Exchange the key
  const result = service.exchangeApiKey("expirable-key");

  // Wait a tiny bit to ensure the token is expired
  const start = Date.now();
  while (Date.now() - start < 10) {
    // busy wait 10ms
  }

  // The exchanged token should be expired since TTL is 1ms
  assert.throws(
    () => service.authenticate({ authorization: `Bearer ${result.accessToken}` }),
    (error: unknown) => {
      const err = error as { code?: string; statusCode?: number };
      return err.code === "api.token_expired" && err.statusCode === 401;
    },
    "token with expired TTL should be rejected",
  );
});

test("api key permissions are checked via requireRole", () => {
  const service = new ApiAuthService({
    apiKeys: [
      {
        apiKey: "viewer-only-key",
        actorId: "viewer-actor",
        roles: ["viewer"],
      },
    ],
    jwtSecret: "test-secret",
  });

  // Viewer key should pass for viewer role
  const viewerResult = service.requireRole({ "x-api-key": "viewer-only-key" }, "viewer");
  assert.equal(viewerResult.actorId, "viewer-actor", "actorId should match for viewer role check");

  // Viewer key should fail for operator role
  assert.throws(
    () => service.requireRole({ "x-api-key": "viewer-only-key" }, "operator"),
    (error: unknown) => {
      const err = error as { code?: string; statusCode?: number };
      return err.code === "api.forbidden" && err.statusCode === 403;
    },
    "viewer key should not pass operator role check",
  );

  // Viewer key should fail for admin role
  assert.throws(
    () => service.requireRole({ "x-api-key": "viewer-only-key" }, "admin"),
    (error: unknown) => {
      const err = error as { code?: string; statusCode?: number };
      return err.code === "api.forbidden" && err.statusCode === 403;
    },
    "viewer key should not pass admin role check",
  );
});

test("operator api key has correct permissions", () => {
  const service = new ApiAuthService({
    apiKeys: [
      {
        apiKey: "operator-key",
        actorId: "operator-actor",
        roles: ["viewer", "operator"],
      },
    ],
    jwtSecret: "test-secret",
  });

  // Operator key should pass for viewer role
  const viewerResult = service.requireRole({ "x-api-key": "operator-key" }, "viewer");
  assert.equal(viewerResult.actorId, "operator-actor");

  // Operator key should pass for operator role
  const operatorResult = service.requireRole({ "x-api-key": "operator-key" }, "operator");
  assert.equal(operatorResult.actorId, "operator-actor");

  // Operator key should fail for admin role
  assert.throws(
    () => service.requireRole({ "x-api-key": "operator-key" }, "admin"),
    (error: unknown) => {
      const err = error as { code?: string; statusCode?: number };
      return err.code === "api.forbidden" && err.statusCode === 403;
    },
    "operator key should not pass admin role check",
  );
});

test("admin api key has all permissions", () => {
  const service = new ApiAuthService({
    apiKeys: [
      {
        apiKey: "admin-key-full-access",
        actorId: "admin-actor",
        roles: ["admin", "viewer", "operator"],
      },
    ],
    jwtSecret: "test-secret",
  });

  // Admin key should pass for viewer role
  const viewerResult = service.requireRole({ "x-api-key": "admin-key-full-access" }, "viewer");
  assert.equal(viewerResult.actorId, "admin-actor");

  // Admin key should pass for operator role
  const operatorResult = service.requireRole({ "x-api-key": "admin-key-full-access" }, "operator");
  assert.equal(operatorResult.actorId, "admin-actor");

  // Admin key should pass for admin role
  const adminResult = service.requireRole({ "x-api-key": "admin-key-full-access" }, "admin");
  assert.equal(adminResult.actorId, "admin-actor");
});

test("empty api key is rejected", () => {
  const service = new ApiAuthService({
    apiKeys: [
      {
        apiKey: "valid-key",
        actorId: "valid-actor",
        roles: ["viewer"],
      },
    ],
    jwtSecret: "test-secret",
  });

  assert.throws(
    () => service.exchangeApiKey(""),
    (error: unknown) => {
      const err = error as { code?: string; statusCode?: number };
      return err.code === "api.invalid_api_key" && err.statusCode === 401;
    },
    "empty API key should be rejected",
  );
});

test("whitespace-only api key is rejected", () => {
  const service = new ApiAuthService({
    apiKeys: [
      {
        apiKey: "valid-key",
        actorId: "valid-actor",
        roles: ["viewer"],
      },
    ],
    jwtSecret: "test-secret",
  });

  assert.throws(
    () => service.exchangeApiKey("   "),
    (error: unknown) => {
      const err = error as { code?: string; statusCode?: number };
      return err.code === "api.invalid_api_key" && err.statusCode === 401;
    },
    "whitespace-only API key should be rejected",
  );
});

test("api key with trimmed whitespace is accepted", () => {
  const service = new ApiAuthService({
    apiKeys: [
      {
        apiKey: "trim-test-key",
        actorId: "trim-actor",
        roles: ["viewer"],
      },
    ],
    jwtSecret: "test-secret",
  });

  // The authenticate method trims whitespace from API keys
  const result = service.authenticate({ "x-api-key": "  trim-test-key  " });
  assert.equal(result.actorId, "trim-actor", "trimmed key should be accepted");
});
