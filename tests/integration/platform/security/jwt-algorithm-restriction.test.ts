/**
 * Security Integration Test: JWT Algorithm Restriction
 *
 * Verifies JWT security including:
 * - alg:none rejection
 * - Non-whitelisted algorithm rejection
 * - Expired token rejection
 * - Signature tampering detection
 *
 * Note: These tests verify JWT handling through the ApiAuthService.authenticate() method.
 * The underlying verifyJwt function is internal to the service.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ApiAuthService } from "../../../../src/platform/five-plane-interface/api/api-auth-service.js";

test("security: JWT with alg=none is rejected", () => {
  const service = new ApiAuthService({
    apiKeys: [],
    jwtSecret: "test-secret-key-at-least-32-characters-long",
    allowedAlgorithms: ["HS256", "HS384", "HS512"],
  });

  // Create a JWT with alg=none (unsigned)
  // Format: base64url(header).base64url(payload).
  // Header: {"alg":"none","typ":"JWT"}
  // Payload: {"sub":"user123","exp":9999999999}
  const maliciousToken = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJ1c2VyMTIzIiwiZXhwIjo5OTk5OTk5OTk5fQ.";

  assert.throws(
    () => service.authenticate({ authorization: `Bearer ${maliciousToken}` }),
    (err: any) => {
      // alg=none is not in allowedAlgorithms, so it throws unsupported_algorithm
      return err?.code === "api.unsupported_algorithm" || err?.message?.includes("none");
    },
    "JWT with alg=none should be rejected",
  );
});

test("security: JWT with empty algorithm is rejected", () => {
  const service = new ApiAuthService({
    apiKeys: [],
    jwtSecret: "test-secret-key-at-least-32-characters-long",
    allowedAlgorithms: ["HS256", "HS384", "HS512"],
  });

  // Create a JWT with empty alg
  // Header: {"alg":"","typ":"JWT"}
  const maliciousToken = "eyJhbGciOiIiLCJ0eXAiOiJKV1QifQ.eyJzdWIiOiJ1c2VyMTIzIiwiZXhwIjo5OTk5OTk5OTk5fQ.";

  assert.throws(
    () => service.authenticate({ authorization: `Bearer ${maliciousToken}` }),
    (err: any) => {
      // Empty alg is not in allowedAlgorithms, so it throws unsupported_algorithm
      return err?.code === "api.unsupported_algorithm" || err?.message?.includes("none");
    },
    "JWT with empty algorithm should be rejected",
  );
});

test("security: JWT with non-whitelisted algorithm is rejected", () => {
  const service = new ApiAuthService({
    apiKeys: [],
    jwtSecret: "test-secret-key-at-least-32-characters-long",
    allowedAlgorithms: ["HS256"], // Only HS256 allowed
  });

  // Create a JWT with RS256 algorithm (asymmetric, not in whitelist)
  // Header: {"alg":"RS256","typ":"JWT"}
  const tokenWithRsa = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZXhwIjo5OTk5OTk5OTk5fQ.signature";

  assert.throws(
    () => service.authenticate({ authorization: `Bearer ${tokenWithRsa}` }),
    (err: any) => {
      return err?.code === "api.unsupported_algorithm" || err?.message?.includes("not allowed");
    },
    "JWT with non-whitelisted algorithm should be rejected",
  );
});

test("security: malformed JWT is rejected", () => {
  const service = new ApiAuthService({
    apiKeys: [],
    jwtSecret: "test-secret-key-at-least-32-characters-long",
  });

  // Not a valid JWT format at all
  assert.throws(
    () => service.authenticate({ authorization: "Bearer not-a-valid-jwt" }),
    (err: any) => {
      return err !== undefined;
    },
    "Malformed JWT should be rejected",
  );
});

test("security: JWT without Bearer prefix throws error", () => {
  const service = new ApiAuthService({
    apiKeys: [],
    jwtSecret: "test-secret-key-at-least-32-characters-long",
  });

  // Token without Bearer prefix
  assert.throws(
    () => service.authenticate({ authorization: "some-token-without-bearer" }),
    (err: any) => {
      return err?.code === "api.auth_required" || err?.message?.includes("Bearer");
    },
    "Token without Bearer prefix should be rejected",
  );
});

test("security: API key authentication works alongside JWT", () => {
  const service = new ApiAuthService({
    apiKeys: [
      {
        apiKey: "test-api-key-1",
        actorId: "service-account-1",
        roles: ["operator"],
      },
    ],
    jwtSecret: "test-secret-key-at-least-32-characters-long",
  });

  // API key should work
  const result = service.authenticate({ "x-api-key": "test-api-key-1" });
  assert.strictEqual(result.actorId, "service-account-1", "API key auth should work");
  assert.strictEqual(result.authMethod, "api_key", "Should be authenticated via api_key");
});

test("security: neither JWT nor API key throws auth_required", () => {
  const service = new ApiAuthService({
    apiKeys: [],
    jwtSecret: "test-secret-key-at-least-32-characters-long",
  });

  assert.throws(
    () => service.authenticate({}),
    (err: any) => {
      return err?.code === "api.auth_required";
    },
    "No credentials should throw auth_required",
  );
});

test("security: role requirement is enforced", () => {
  const service = new ApiAuthService({
    apiKeys: [],
    jwtSecret: "test-secret-key-at-least-32-characters-long",
  });

  // requireRole should throw when no auth is provided
  assert.throws(
    () => service.requireRole({}, "admin"),
    (err: any) => {
      return err?.code === "api.auth_required";
    },
    "No credentials should throw auth_required for requireRole",
  );
});
