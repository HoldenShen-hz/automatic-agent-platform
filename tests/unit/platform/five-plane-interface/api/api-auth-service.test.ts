import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  ApiAuthService,
  ApiAuthError,
  type ApiKeyRecord,
  type ApiRole,
  type ApiAuthServiceOptions,
} from "../../../../../src/platform/five-plane-interface/api/api-auth-service.js";

describe("ApiAuthService", () => {
  let service: ApiAuthService;
  const jwtSecret = "test-secret-for-jwt-signing";

  function createService(apiKeys: ApiKeyRecord[] = [], options: Partial<ApiAuthServiceOptions> & { jwtSecret?: string } = {}): ApiAuthService {
    return new ApiAuthService({
      apiKeys,
      jwtSecret: options.jwtSecret ?? jwtSecret,
      tokenTtlMs: options.tokenTtlMs ?? 3600000, // 1 hour default
      maxTokenAgeMs: options.maxTokenAgeMs ?? 86400000, // 24 hours default
      allowedAlgorithms: options.allowedAlgorithms ?? ["HS256"],
      ...(options.jwtVerificationSecrets == null ? {} : { jwtVerificationSecrets: options.jwtVerificationSecrets }),
      ...(options.jwtIssuer == null ? {} : { jwtIssuer: options.jwtIssuer }),
      ...(options.jwtAudience == null ? {} : { jwtAudience: options.jwtAudience }),
      ...(options.clockSkewMs == null ? {} : { clockSkewMs: options.clockSkewMs }),
      ...(options.requireJwtId == null ? {} : { requireJwtId: options.requireJwtId }),
      ...(options.isJwtRevoked == null ? {} : { isJwtRevoked: options.isJwtRevoked }),
    });
  }

  describe("constructor", () => {
    it("should create service with default TTL", () => {
      const svc = createService([]);
      // Default token TTL is 1 hour
      assert.ok(svc);
    });

    it("should normalize roles by sorting and deduplicating", () => {
      const apiKeys: ApiKeyRecord[] = [
        { apiKey: "key1", actorId: "actor1", roles: ["admin", "viewer", "operator", "admin"] },
      ];
      const svc = createService(apiKeys);

      // Verify the exchange works and roles are sorted
      const result = svc.exchangeApiKey("key1");
      assert.deepStrictEqual(result.principal.roles, ["admin", "operator", "viewer"]);
    });
  });

  describe("exchangeApiKey", () => {
    it("should exchange valid API key for JWT token", () => {
      const apiKeys: ApiKeyRecord[] = [
        { apiKey: "test-api-key-12345", actorId: "user-123", roles: ["operator"] },
      ];
      const svc = createService(apiKeys);

      const result = svc.exchangeApiKey("test-api-key-12345");

      assert.strictEqual(result.tokenType, "Bearer");
      assert.ok(result.accessToken.length > 0);
      assert.ok(result.expiresAt);
      assert.strictEqual(result.principal.actorId, "user-123");
      assert.deepStrictEqual(result.principal.roles, ["operator"]);
      assert.strictEqual(result.principal.authMethod, "api_key");
    });

    it("should throw for invalid API key", () => {
      const apiKeys: ApiKeyRecord[] = [
        { apiKey: "valid-key", actorId: "actor", roles: ["viewer"] },
      ];
      const svc = createService(apiKeys);

      assert.throws(
        () => svc.exchangeApiKey("invalid-key"),
        (err: unknown) => err instanceof ApiAuthError && err.code === "api.invalid_api_key",
      );
    });

    it("should include tenant ID in principal when present", () => {
      const apiKeys: ApiKeyRecord[] = [
        { apiKey: "tenant-key", actorId: "tenant-user", roles: ["viewer"], tenantId: "tenant-abc" },
      ];
      const svc = createService(apiKeys);

      const result = svc.exchangeApiKey("tenant-key");

      assert.strictEqual(result.principal.tenantId, "tenant-abc");
    });

    it("should not include tenant ID when undefined", () => {
      const apiKeys: ApiKeyRecord[] = [
        { apiKey: "no-tenant-key", actorId: "user", roles: ["viewer"] },
      ];
      const svc = createService(apiKeys);

      const result = svc.exchangeApiKey("no-tenant-key");

      assert.strictEqual(result.principal.tenantId, null);
    });

    it("should respect custom token TTL", () => {
      const apiKeys: ApiKeyRecord[] = [
        { apiKey: "custom-ttl-key", actorId: "user", roles: ["viewer"] },
      ];
      const svc = createService(apiKeys, { tokenTtlMs: 5000 });

      const beforeExchange = Date.now();
      const result = svc.exchangeApiKey("custom-ttl-key");
      const expiresAt = new Date(result.expiresAt).getTime();

      // Should expire roughly 5 seconds after exchange
      const actualTtl = expiresAt - beforeExchange;
      assert.ok(actualTtl >= 4900 && actualTtl <= 5500, `Expected ~5000ms, got ${actualTtl}ms`);
    });

    it("should include issuer, audience, nbf, and jti when configured", () => {
      const svc = createService(
        [{ apiKey: "test-api-key-12345", actorId: "user-123", roles: ["operator"] }],
        { jwtIssuer: "automatic-agent", jwtAudience: ["api", "console"] },
      );

      const result = svc.exchangeApiKey("test-api-key-12345", "2024-01-15T10:00:00.000Z");
      const payload = JSON.parse(Buffer.from(result.accessToken.split(".")[1]!, "base64url").toString("utf8"));

      assert.equal(payload.iss, "automatic-agent");
      assert.deepEqual(payload.aud, ["api", "console"]);
      assert.equal(payload.nbf, payload.iat);
      assert.equal(typeof payload.jti, "string");
      assert.ok(payload.jti.length > 0);
    });
  });

  describe("authenticate", () => {
    it("should authenticate with valid Bearer token", () => {
      const apiKeys: ApiKeyRecord[] = [
        { apiKey: "test-key", actorId: "token-user", roles: ["admin"] },
      ];
      const svc = createService(apiKeys);

      // Get a token first
      const { accessToken } = svc.exchangeApiKey("test-key");

      // Use the token to authenticate
      const principal = svc.authenticate({ authorization: `Bearer ${accessToken}` });

      assert.strictEqual(principal.actorId, "token-user");
      assert.deepStrictEqual(principal.roles, ["admin"]);
      assert.strictEqual(principal.authMethod, "jwt");
    });

    it("should throw for malformed Bearer token", () => {
      const svc = createService([]);

      assert.throws(
        () => svc.authenticate({ authorization: "Bearer not.a.valid.jwt.token" }),
        (err: unknown) => err instanceof ApiAuthError && err.code === "api.invalid_token",
      );
    });

    it("should throw for expired JWT token", () => {
      const apiKeys: ApiKeyRecord[] = [
        { apiKey: "expired-test-key", actorId: "user", roles: ["viewer"] },
      ];
      const svc = createService(apiKeys, { tokenTtlMs: -1000 }); // Already expired

      const { accessToken } = svc.exchangeApiKey("expired-test-key");

      assert.throws(
        () => svc.authenticate({ authorization: `Bearer ${accessToken}` }),
        (err: unknown) => err instanceof ApiAuthError && err.code === "api.token_expired",
      );
    });

    it("should fallback to API key when no Bearer token", () => {
      const apiKeys: ApiKeyRecord[] = [
        { apiKey: "fallback-key", actorId: "fallback-user", roles: ["operator"] },
      ];
      const svc = createService(apiKeys);

      const principal = svc.authenticate({ "x-api-key": "fallback-key" });

      assert.strictEqual(principal.actorId, "fallback-user");
      assert.strictEqual(principal.authMethod, "api_key");
    });

    it("should trim whitespace from API key", () => {
      const apiKeys: ApiKeyRecord[] = [
        { apiKey: "trim-key", actorId: "trim-user", roles: ["viewer"] },
      ];
      const svc = createService(apiKeys);

      const principal = svc.authenticate({ "x-api-key": "  trim-key  " });

      assert.strictEqual(principal.actorId, "trim-user");
    });

    it("should throw when no credentials provided", () => {
      const svc = createService([]);

      assert.throws(
        () => svc.authenticate({}),
        (err: unknown) => err instanceof ApiAuthError && err.code === "api.auth_required",
      );
    });

    it("should throw for empty API key", () => {
      const svc = createService([]);

      assert.throws(
        () => svc.authenticate({ "x-api-key": "" }),
        (err: unknown) => err instanceof ApiAuthError && err.code === "api.auth_required",
      );
    });

    it("should throw for whitespace-only API key", () => {
      const svc = createService([]);

      assert.throws(
        () => svc.authenticate({ "x-api-key": "   " }),
        (err: unknown) => err instanceof ApiAuthError && err.code === "api.auth_required",
      );
    });
  });

  describe("requireRole", () => {
    it("should return principal when role is sufficient", () => {
      const apiKeys: ApiKeyRecord[] = [
        { apiKey: "admin-key", actorId: "admin-user", roles: ["admin", "operator", "viewer"] },
      ];
      const svc = createService(apiKeys);

      const { accessToken } = svc.exchangeApiKey("admin-key");
      const principal = svc.requireRole({ authorization: `Bearer ${accessToken}` }, "viewer");

      assert.strictEqual(principal.actorId, "admin-user");
    });

    it("should throw for insufficient role", () => {
      const apiKeys: ApiKeyRecord[] = [
        { apiKey: "viewer-key", actorId: "viewer-user", roles: ["viewer"] },
      ];
      const svc = createService(apiKeys);

      const { accessToken } = svc.exchangeApiKey("viewer-key");

      assert.throws(
        () => svc.requireRole({ authorization: `Bearer ${accessToken}` }, "admin"),
        (err: unknown) => err instanceof ApiAuthError && err.code === "api.forbidden",
      );
    });

    it("should allow exact role match", () => {
      const apiKeys: ApiKeyRecord[] = [
        { apiKey: "op-key", actorId: "op-user", roles: ["operator"] },
      ];
      const svc = createService(apiKeys);

      const { accessToken } = svc.exchangeApiKey("op-key");
      const principal = svc.requireRole({ authorization: `Bearer ${accessToken}` }, "operator");

      assert.strictEqual(principal.actorId, "op-user");
    });
  });

  describe("JWT verification edge cases", () => {
    it("should reject token with wrong signature", () => {
      // Create two services with different secrets
      const svcA = createService([{ apiKey: "key-a", actorId: "user-a", roles: ["viewer"] }], { jwtSecret: "secret-a" });
      const svcB = createService([{ apiKey: "key-b", actorId: "user-b", roles: ["viewer"] }], { jwtSecret: "secret-b" });

      // Get token from service A using its key
      const { accessToken } = svcA.exchangeApiKey("key-a");

      // Service B should reject it because it was signed with secret-a
      assert.throws(
        () => svcB.authenticate({ authorization: `Bearer ${accessToken}` }),
        (err: unknown) => err instanceof ApiAuthError && err.code === "api.invalid_token_signature",
      );
    });

    it("should reject token with missing claims", () => {
      const svc = createService([]);

      // Manually construct a malformed JWT (missing sub, roles, exp)
      const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
      const payload = Buffer.from(JSON.stringify({})).toString("base64url");
      const body = `${header}.${payload}`;
      const signature = Buffer.from(createHmac("sha256", jwtSecret).update(body).digest()).toString("base64url");
      const badToken = `${header}.${payload}.${signature}`;

      assert.throws(
        () => svc.authenticate({ authorization: `Bearer ${badToken}` }),
        (err: unknown) => err instanceof ApiAuthError && (err.code === "api.invalid_token_claims" || err.code === "api.invalid_token"),
      );
    });

    it("should reject token with invalid algorithm", () => {
      const svc = createService([], { allowedAlgorithms: ["HS256"] });

      // Create token with RS256 algorithm
      const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
      const payload = Buffer.from(JSON.stringify({ sub: "user", roles: ["viewer"], exp: Date.now() / 1000 + 3600 })).toString("base64url");
      const body = `${header}.${payload}`;
      const signature = Buffer.from("fake").toString("base64url");
      const badToken = `${header}.${payload}.${signature}`;

      assert.throws(
        () => svc.authenticate({ authorization: `Bearer ${badToken}` }),
        (err: unknown) => err instanceof ApiAuthError && err.code === "api.unsupported_algorithm",
      );
    });

    it("should reject token with none algorithm", () => {
      const svc = createService([]);

      const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
      const payload = Buffer.from(JSON.stringify({ sub: "user", roles: ["viewer"], exp: Date.now() / 1000 + 3600 })).toString("base64url");
      const badToken = `${header}.${payload}.`;

      // Note: "none" algorithm is rejected as "unsupported_algorithm" since it's not in allowedAlgorithms
      assert.throws(
        () => svc.authenticate({ authorization: `Bearer ${badToken}` }),
        (err: unknown) => err instanceof ApiAuthError && (err.code === "api.none_algorithm_rejected" || err.code === "api.unsupported_algorithm"),
      );
    });

    it("should reject token with invalid typ header", () => {
      const svc = createService([]);

      const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "not-jwt" })).toString("base64url");
      const payload = Buffer.from(JSON.stringify({ sub: "user", roles: ["viewer"], exp: Date.now() / 1000 + 3600 })).toString("base64url");
      const body = `${header}.${payload}`;
      const signature = Buffer.from(createHmac("sha256", jwtSecret).update(body).digest()).toString("base64url");
      const badToken = `${header}.${payload}.${signature}`;

      assert.throws(
        () => svc.authenticate({ authorization: `Bearer ${badToken}` }),
        (err: unknown) => err instanceof ApiAuthError && err.code === "api.invalid_token_header",
      );
    });

    it("should allow recent tokens within maxTokenAgeMs", () => {
      const apiKeys: ApiKeyRecord[] = [
        { apiKey: "recent-token-key", actorId: "user", roles: ["viewer"] },
      ];
      // maxTokenAgeMs of 24 hours should allow recently issued tokens
      const svc = createService(apiKeys, { maxTokenAgeMs: 86400000 });

      const { accessToken } = svc.exchangeApiKey("recent-token-key");

      // Token should be accepted as it's recent
      const principal = svc.authenticate({ authorization: `Bearer ${accessToken}` });
      assert.strictEqual(principal.actorId, "user");
    });

    it("should reject token with mismatched issuer", () => {
      const svc = createService([], { jwtIssuer: "automatic-agent" });
      const token = createJwtWithClaims(
        { alg: "HS256", typ: "JWT" },
        { sub: "user", roles: ["viewer"], iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, iss: "other-service" },
        jwtSecret,
      );

      assert.throws(
        () => svc.authenticate({ authorization: `Bearer ${token}` }),
        (err: unknown) => err instanceof ApiAuthError && err.code === "api.invalid_token_issuer",
      );
    });

    it("should reject token with mismatched audience", () => {
      const svc = createService([], { jwtAudience: "automatic-agent-api" });
      const token = createJwtWithClaims(
        { alg: "HS256", typ: "JWT" },
        { sub: "user", roles: ["viewer"], iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, aud: "other-audience" },
        jwtSecret,
      );

      assert.throws(
        () => svc.authenticate({ authorization: `Bearer ${token}` }),
        (err: unknown) => err instanceof ApiAuthError && err.code === "api.invalid_token_audience",
      );
    });

    it("should reject token that is not valid yet", () => {
      const svc = createService([], { clockSkewMs: 0 });
      const future = Math.floor(Date.now() / 1000) + 60;
      const token = createJwtWithClaims(
        { alg: "HS256", typ: "JWT" },
        { sub: "user", roles: ["viewer"], iat: Math.floor(Date.now() / 1000), nbf: future, exp: future + 3600 },
        jwtSecret,
      );

      assert.throws(
        () => svc.authenticate({ authorization: `Bearer ${token}` }),
        (err: unknown) => err instanceof ApiAuthError && err.code === "api.token_not_yet_valid",
      );
    });

    it("should reject revoked JWT IDs when required", () => {
      const jwtId = "jwt-id-123";
      const svc = createService([], {
        requireJwtId: true,
        isJwtRevoked: (candidateJwtId) => candidateJwtId === jwtId,
      });
      const token = createJwtWithClaims(
        { alg: "HS256", typ: "JWT" },
        { sub: "user", roles: ["viewer"], iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, jti: jwtId },
        jwtSecret,
      );

      assert.throws(
        () => svc.authenticate({ authorization: `Bearer ${token}` }),
        (err: unknown) => err instanceof ApiAuthError && err.code === "api.token_revoked",
      );
    });

    it("should accept verification with rotated JWT secret", () => {
      const signingSvc = createService([{ apiKey: "key-a", actorId: "user-a", roles: ["viewer"] }], { jwtSecret: "secret-a1" });
      const verifyingSvc = createService([], {
        jwtSecret: "secret-b1",
        jwtVerificationSecrets: ["secret-a1"],
      });

      const { accessToken } = signingSvc.exchangeApiKey("key-a");
      const principal = verifyingSvc.authenticate({ authorization: `Bearer ${accessToken}` });

      assert.equal(principal.actorId, "user-a");
    });

    it("should reject weak JWT secrets", () => {
      assert.throws(
        () => createService([], { jwtSecret: "secret" }),
        (err: unknown) => err instanceof ApiAuthError && err.code === "api.jwt_secret_too_short",
      );
    });
  });

  describe("ApiAuthError", () => {
    it("should create error with correct properties", () => {
      const error = new ApiAuthError(401, "api.test_error", "Test error message");

      assert.strictEqual(error.statusCode, 401);
      assert.strictEqual(error.code, "api.test_error");
      assert.strictEqual(error.message, "Test error message");
      assert.strictEqual(error.name, "ApiAuthError");
      assert.strictEqual(error.category, "auth");
      assert.strictEqual(error.retryable, false);
    });

    it("should be instance of Error", () => {
      const error = new ApiAuthError(403, "api.forbidden", "Forbidden");

      assert.ok(error instanceof Error);
      assert.ok(error instanceof ApiAuthError);
    });
  });
});

function createJwtWithClaims(header: Record<string, unknown>, payload: Record<string, unknown>, secret: string): string {
  const encodedHeader = Buffer.from(JSON.stringify(header), "utf8").toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const body = `${encodedHeader}.${encodedPayload}`;
  const signature = Buffer.from(createHmac("sha256", secret).update(body).digest()).toString("base64url");
  return `${body}.${signature}`;
}
