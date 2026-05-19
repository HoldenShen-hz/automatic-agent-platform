import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { ApiAuthError, ApiAuthService } from "../../../../../src/platform/five-plane-interface/api/api-auth-service.js";
import { AppError } from "../../../../../src/platform/contracts/errors.js";

test("api auth service exchanges api keys and authenticates bearer tokens with sorted roles", () => {
  const service = new ApiAuthService({
    apiKeys: [
      {
        apiKey: "operator-key",
        actorId: "operator-1",
        roles: ["viewer", "operator"],
      },
    ],
    jwtSecret: "phase3-secret",
    tokenTtlMs: 5 * 60 * 1000,
  });

  const exchange = service.exchangeApiKey("operator-key");
  assert.equal(exchange.tokenType, "Bearer");
  assert.deepEqual(exchange.principal, {
    actorId: "operator-1",
    roles: ["operator", "viewer"],
    authMethod: "api_key",
    tenantId: null,
  });

  const principal = service.authenticate({
    authorization: `Bearer ${exchange.accessToken}`,
  });
  assert.deepEqual(principal, {
    actorId: "operator-1",
    roles: ["operator", "viewer"],
    authMethod: "jwt",
    tenantId: null,
  });

  const headerPrincipal = service.requireRole(
    {
      "x-api-key": "operator-key",
    },
    "operator",
  );
  assert.equal(headerPrincipal.actorId, "operator-1");
  assert.equal(headerPrincipal.authMethod, "api_key");
});

test("api auth service rejects expired, tampered, and under-privileged credentials", () => {
  const service = new ApiAuthService({
    apiKeys: [
      {
        apiKey: "viewer-key",
        actorId: "viewer-1",
        roles: ["viewer"],
      },
    ],
    jwtSecret: "phase3-secret",
    tokenTtlMs: 60 * 1000,
  });

  const originalNow = Date.now;
  Date.now = () => 1_000;
  try {
    const expiredToken = createJwtWithValidSignature("HS256", {
      sub: "viewer-1",
      iat: 0,
      exp: 0,
      roles: ["viewer"],
    }, "phase3-secret");
    assert.throws(
      () =>
        service.authenticate({
          authorization: `Bearer ${expiredToken}`,
        }),
      (error: unknown) =>
        (error as any)?.code === "api.token_expired"
        && (error as any)?.statusCode === 401,
    );

    const validToken = service.exchangeApiKey("viewer-key").accessToken;
    const parts = validToken.split(".");
    const tamperedBody = `${parts[0]}.${parts[1]}`;
    const tamperedSignature = crypto
      .createHmac("sha256", "wrong-secret")
      .update(tamperedBody)
      .digest("base64url");
    const tamperedToken = `${tamperedBody}.${tamperedSignature}`;
    assert.throws(
      () =>
        service.authenticate({
          authorization: `Bearer ${tamperedToken}`,
        }),
      (error: unknown) =>
        (error as any)?.code === "api.invalid_token_signature"
        && (error as any)?.statusCode === 401,
    );
  } finally {
    Date.now = originalNow;
  }

  assert.throws(
    () =>
      service.requireRole(
        {
          "x-api-key": "viewer-key",
        },
        "admin",
      ),
    (error: unknown) =>
      (error as any)?.code === "api.forbidden"
      && (error as any)?.statusCode === 403,
  );
});

test("api auth service errors converge to AppError metadata", () => {
  const service = new ApiAuthService({
    apiKeys: [],
    jwtSecret: "phase3-secret",
  });

  assert.throws(
    () => service.authenticate({}),
    (error: unknown) =>
      (error as any)?.code === "api.auth_required"
      && (error as any)?.category === "auth"
      && (error as any)?.source === "gateway"
      && (error as any)?.retryable === false,
  );
});

function createJwtWithValidSignature(headerAlg: string, payload: object, secret: string): string {
  // Create a JWT with the specified algorithm in header but a VALID HMAC-SHA256 signature
  // This allows testing algorithm rejection separately from signature verification
  const header = { alg: headerAlg, typ: "JWT" };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const body = `${encodedHeader}.${encodedPayload}`;
  // Always compute a valid HMAC-SHA256 signature using the provided secret
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

test("api auth service rejects JWT with alg: 'none'", () => {
  const service = new ApiAuthService({
    apiKeys: [],
    jwtSecret: "phase3-secret",
  });

  // Create a JWT with alg: "none" but a VALID HMAC-SHA256 signature
  // The 'none' algorithm is rejected as unsupported (not in allowed algorithms)
  const noneAlgToken = createJwtWithValidSignature("none", {
    sub: "attacker",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    roles: ["admin"],
  }, "phase3-secret");

  assert.throws(
    () => service.authenticate({ authorization: `Bearer ${noneAlgToken}` }),
    (error: unknown) =>
      (error as any)?.code === "api.unsupported_algorithm"
      && (error as any)?.statusCode === 401,
    "JWT with alg 'none' should be rejected as unsupported",
  );
});

test("api auth service rejects JWT with unsupported algorithm", () => {
  const service = new ApiAuthService({
    apiKeys: [],
    jwtSecret: "phase3-secret",
  });

  // Create a JWT claiming RS256 algorithm but with a valid HS256 signature
  // The signature verification passes (HS256 is valid HMAC), but RS256 is not in allowed list
  const unsupportedAlgToken = createJwtWithValidSignature("RS256", {
    sub: "attacker",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    roles: ["admin"],
  }, "phase3-secret");

  assert.throws(
    () => service.authenticate({ authorization: `Bearer ${unsupportedAlgToken}` }),
    (error: unknown) =>
      (error as any)?.code === "api.unsupported_algorithm"
      && (error as any)?.statusCode === 401,
    "JWT with unsupported algorithm should be rejected",
  );
});

test("api auth service honors configured allowedAlgorithms during authenticate", () => {
  const service = new ApiAuthService({
    apiKeys: [],
    jwtSecret: "phase3-secret",
    allowedAlgorithms: ["HS512"],
  });

  const hs256Token = createJwtWithValidSignature("HS256", {
    sub: "operator-1",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    roles: ["operator"],
  }, "phase3-secret");

  assert.throws(
    () => service.authenticate({ authorization: `Bearer ${hs256Token}` }),
    (error: unknown) =>
      (error as any)?.code === "api.unsupported_algorithm"
      && (error as any)?.statusCode === 401,
  );
});

test("api auth service rejects empty algorithm", () => {
  const service = new ApiAuthService({
    apiKeys: [],
    jwtSecret: "phase3-secret",
  });

  // Create a JWT with empty algorithm but a valid HMAC-SHA256 signature
  // Empty algorithm is rejected as unsupported (not in allowed algorithms)
  const emptyAlgToken = createJwtWithValidSignature("", {
    sub: "attacker",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    roles: ["admin"],
  }, "phase3-secret");

  assert.throws(
    () => service.authenticate({ authorization: `Bearer ${emptyAlgToken}` }),
    (error: unknown) =>
      (error as any)?.code === "api.unsupported_algorithm"
      && (error as any)?.statusCode === 401,
    "JWT with empty algorithm should be rejected as unsupported",
  );
});

test("api auth service rejects token that is too old via maxTokenAgeMs option", () => {
  // Create service with a maxTokenAgeMs of 1 hour
  const service = new ApiAuthService({
    apiKeys: [],
    jwtSecret: "phase3-secret",
    maxTokenAgeMs: 60 * 60 * 1000, // 1 hour max token age
  });

  // Create a token that was issued 2 hours ago
  const twoHoursAgo = Math.floor(Date.now() / 1000) - 2 * 60 * 60;
  const oldToken = createJwtWithValidSignature("HS256", {
    sub: "user-old-token",
    iat: twoHoursAgo,
    exp: Math.floor(Date.now() / 1000) + 3600,
    roles: ["viewer"],
  }, "phase3-secret");

  // Token is 2 hours old but maxTokenAgeMs is 1 hour, so it should be rejected
  assert.throws(
    () => service.authenticate({
      authorization: `Bearer ${oldToken}`,
    }),
    (error: unknown) =>
      (error as any)?.code === "api.token_too_old"
      && (error as any)?.statusCode === 401,
    "JWT issued too long ago should be rejected",
  );
});

test("api auth service exchangeApiKey accepts custom issuedAt timestamp", () => {
  const service = new ApiAuthService({
    apiKeys: [
      {
        apiKey: "test-key",
        actorId: "test-actor",
        roles: ["viewer"],
      },
    ],
    jwtSecret: "test-secret",
    tokenTtlMs: 60 * 60 * 1000, // 1 hour
  });

  const customIssuedAt = "2024-01-15T10:00:00.000Z";
  const result = service.exchangeApiKey("test-key", customIssuedAt);

  // Verify the token was created with the custom timestamp
  const decodedPayload = JSON.parse(Buffer.from(result.accessToken.split(".")[1]!, "base64url").toString("utf8"));
  const expectedIat = Math.floor(new Date(customIssuedAt).getTime() / 1000);
  const expectedExp = expectedIat + 3600;

  assert.equal(decodedPayload.iat, expectedIat);
  assert.equal(decodedPayload.exp, expectedExp);
  assert.equal(result.expiresAt, new Date(expectedExp * 1000).toISOString());
});

test("api auth service exchangeApiKey includes tenantId in principal", () => {
  const service = new ApiAuthService({
    apiKeys: [
      {
        apiKey: "tenant-key",
        actorId: "tenant-actor",
        roles: ["operator"],
        tenantId: "tenant-abc-123",
      },
    ],
    jwtSecret: "test-secret",
  });

  const result = service.exchangeApiKey("tenant-key");

  assert.equal(result.principal.tenantId, "tenant-abc-123");
  assert.equal(result.principal.actorId, "tenant-actor");
  assert.deepEqual(result.principal.roles, ["operator"]);

  // Also verify via authenticate
  const authenticated = service.authenticate({
    authorization: `Bearer ${result.accessToken}`,
  });
  assert.equal(authenticated.tenantId, "tenant-abc-123");
});

test("api auth service exchangeApiKey rejects invalid api key", () => {
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
    () => service.exchangeApiKey("invalid-key"),
    (error: unknown) =>
      (error as any)?.code === "api.invalid_api_key"
      && (error as any)?.statusCode === 401,
  );
});

test("api auth service authenticate rejects malformed bearer token", () => {
  const service = new ApiAuthService({
    apiKeys: [],
    jwtSecret: "test-secret",
  });

  assert.throws(
    () => service.authenticate({ authorization: "Bearer not.a.valid.jwt.token" }),
    (error: unknown) =>
      (error as any)?.code === "api.invalid_token"
      && (error as any)?.statusCode === 401,
  );

  assert.throws(
    () => service.authenticate({ authorization: "Bearer missing-dot" }),
    (error: unknown) =>
      (error as any)?.code === "api.invalid_token"
      && (error as any)?.statusCode === 401,
  );
});

test("api auth service wraps malformed payload JSON as ApiAuthError", () => {
  const service = new ApiAuthService({
    apiKeys: [],
    jwtSecret: "phase3-secret",
  });

  const encodedHeader = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const encodedPayload = Buffer.from("{", "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", "phase3-secret").update(`${encodedHeader}.${encodedPayload}`).digest("base64url");
  const malformedPayloadToken = `${encodedHeader}.${encodedPayload}.${signature}`;

  assert.throws(
    () => service.authenticate({ authorization: `Bearer ${malformedPayloadToken}` }),
    (error: unknown) =>
      (error as any)?.code === "api.invalid_token"
      && (error as any)?.statusCode === 401,
  );
});

test("api auth service requireRole rejects when principal lacks required role", () => {
  const service = new ApiAuthService({
    apiKeys: [
      {
        apiKey: "viewer-key",
        actorId: "viewer-actor",
        roles: ["viewer"],
      },
    ],
    jwtSecret: "test-secret",
  });

  // Authenticate with viewer role, require operator role
  assert.throws(
    () => service.requireRole({ "x-api-key": "viewer-key" }, "operator"),
    (error: unknown) =>
      (error as any)?.code === "api.forbidden"
      && (error as any)?.statusCode === 403,
  );

  // Authenticate with viewer role, require admin role
  assert.throws(
    () => service.requireRole({ "x-api-key": "viewer-key" }, "admin"),
    (error: unknown) =>
      (error as any)?.code === "api.forbidden"
      && (error as any)?.statusCode === 403,
  );
});

test("api auth service requireRole passes when principal has required role", () => {
  const service = new ApiAuthService({
    apiKeys: [
      {
        apiKey: "admin-key",
        actorId: "admin-actor",
        roles: ["admin", "operator", "viewer"],
      },
    ],
    jwtSecret: "test-secret",
  });

  // Admin has all roles, should pass for any
  const viewerResult = service.requireRole({ "x-api-key": "admin-key" }, "viewer");
  assert.equal(viewerResult.actorId, "admin-actor");

  const operatorResult = service.requireRole({ "x-api-key": "admin-key" }, "operator");
  assert.equal(operatorResult.actorId, "admin-actor");

  const adminResult = service.requireRole({ "x-api-key": "admin-key" }, "admin");
  assert.equal(adminResult.actorId, "admin-actor");
});

test("api auth service requireRole applies role hierarchy for admin-only and operator-only principals", () => {
  const service = new ApiAuthService({
    apiKeys: [
      {
        apiKey: "admin-only-key",
        actorId: "admin-only-actor",
        roles: ["admin"],
      },
      {
        apiKey: "operator-only-key",
        actorId: "operator-only-actor",
        roles: ["operator"],
      },
    ],
    jwtSecret: "test-secret",
  });

  assert.equal(service.requireRole({ "x-api-key": "admin-only-key" }, "viewer").actorId, "admin-only-actor");
  assert.equal(service.requireRole({ "x-api-key": "admin-only-key" }, "operator").actorId, "admin-only-actor");
  assert.equal(service.requireRole({ "x-api-key": "operator-only-key" }, "viewer").actorId, "operator-only-actor");
  assert.throws(
    () => service.requireRole({ "x-api-key": "operator-only-key" }, "admin"),
    (error: unknown) =>
      (error as any)?.code === "api.forbidden"
      && (error as any)?.statusCode === 403,
  );
});
