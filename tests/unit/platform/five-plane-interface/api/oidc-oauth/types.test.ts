import { strict as assert } from "node:assert";
import { test } from "node:test";

import type {
  OidcProvider,
  JwksKey,
  FederatedTokenClaims,
  TokenValidationResult,
  ApiKeyRotationRecord,
  OidcOAuthConfig,
  ApiKeyRecord,
  FetchLike,
} from "../../../../../../src/platform/five-plane-interface/api/oidc-oauth/types.js";

test("OidcProvider has required fields", () => {
  const provider: OidcProvider = {
    issuer: "https://example.com",
    authorizationEndpoint: "https://example.com/auth",
    tokenEndpoint: "https://example.com/token",
    jwksUri: "https://example.com/.well-known/jwks.json",
    scopes: ["openid", "profile"],
  };
  assert.equal(provider.issuer, "https://example.com");
  assert.equal(provider.authorizationEndpoint, "https://example.com/auth");
  assert.equal(provider.tokenEndpoint, "https://example.com/token");
  assert.equal(provider.jwksUri, "https://example.com/.well-known/jwks.json");
  assert.equal(provider.userInfoEndpoint, undefined);
  assert.deepEqual(provider.scopes, ["openid", "profile"]);
});

test("OidcProvider has optional userInfoEndpoint", () => {
  const provider: OidcProvider = {
    issuer: "https://example.com",
    authorizationEndpoint: "https://example.com/auth",
    tokenEndpoint: "https://example.com/token",
    jwksUri: "https://example.com/.well-known/jwks.json",
    userInfoEndpoint: "https://example.com/userinfo",
    scopes: ["openid"],
  };
  assert.equal(provider.userInfoEndpoint, "https://example.com/userinfo");
});

test("JwksKey structure for RSA key", () => {
  const key: JwksKey = {
    kty: "RSA",
    use: "sig",
    kid: "key123",
    alg: "RS256",
    n: "someModulus",
    e: "AQAB",
  };
  assert.equal(key.kty, "RSA");
  assert.equal(key.use, "sig");
  assert.equal(key.kid, "key123");
  assert.equal(key.alg, "RS256");
});

test("JwksKey structure for EC key", () => {
  const key: JwksKey = {
    kty: "EC",
    use: "sig",
    kid: "ec-key456",
    alg: "ES256",
    crv: "P-256",
    x: "abc123",
    y: "def456",
  };
  assert.equal(key.kty, "EC");
  assert.equal(key.crv, "P-256");
});

test("JwksKey structure for symmetric key", () => {
  const key: JwksKey = {
    kty: "oct",
    use: "sig",
    kid: "sym-key789",
    alg: "HS256",
    k: "secretKeyValue",
  };
  assert.equal(key.kty, "oct");
  assert.equal(key.k, "secretKeyValue");
});

test("FederatedTokenClaims structure", () => {
  const claims: FederatedTokenClaims = {
    sub: "user123",
    iss: "https://issuer.example.com",
    aud: "client-id",
    exp: 1747200000,
    iat: 1747196400,
  };
  assert.equal(claims.sub, "user123");
  assert.equal(claims.iss, "https://issuer.example.com");
  assert.equal(claims.aud, "client-id");
  assert.equal(claims.exp, 1747200000);
  assert.equal(claims.iat, 1747196400);
  assert.equal(claims.email, undefined);
  assert.equal(claims.name, undefined);
  assert.equal(claims.roles, undefined);
});

test("FederatedTokenClaims with optional fields", () => {
  const claims: FederatedTokenClaims = {
    sub: "user123",
    iss: "https://issuer.example.com",
    aud: ["client-1", "client-2"],
    exp: 1747200000,
    iat: 1747196400,
    email: "user@example.com",
    name: "Test User",
    roles: ["admin", "user"],
  };
  assert.equal(claims.email, "user@example.com");
  assert.equal(claims.name, "Test User");
  assert.deepEqual(claims.roles, ["admin", "user"]);
  assert.ok(Array.isArray(claims.aud));
});

test("TokenValidationResult structure", () => {
  const result: TokenValidationResult = {
    valid: true,
    error: null,
    claims: null,
    provider: null,
  };
  assert.equal(result.valid, true);
  assert.equal(result.error, null);
  assert.equal(result.claims, null);
  assert.equal(result.provider, null);
});

test("TokenValidationResult with error state", () => {
  const result: TokenValidationResult = {
    valid: false,
    error: "token_expired",
    claims: null,
    provider: "https://issuer.example.com",
  };
  assert.equal(result.valid, false);
  assert.equal(result.error, "token_expired");
  assert.equal(result.provider, "https://issuer.example.com");
});

test("TokenValidationResult with valid claims", () => {
  const claims: FederatedTokenClaims = {
    sub: "user123",
    iss: "https://issuer.example.com",
    aud: "client-id",
    exp: 1747200000,
    iat: 1747196400,
  };
  const result: TokenValidationResult = {
    valid: true,
    error: null,
    claims,
    provider: "https://issuer.example.com",
  };
  assert.equal(result.valid, true);
  assert.equal(result.error, null);
  assert.equal(result.claims?.sub, "user123");
});

test("ApiKeyRotationRecord statuses", () => {
  const activeRecord: ApiKeyRotationRecord = {
    keyId: "key123",
    actorId: "actor456",
    oldApiKeyFingerprint: "sha256:abc123def456",
    status: "active",
    createdAt: "2024-01-01T00:00:00Z",
    rotatedAt: null,
    expiresAt: "2025-01-01T00:00:00Z",
  };
  assert.equal(activeRecord.status, "active");

  const rotatingRecord: ApiKeyRotationRecord = {
    keyId: "key123",
    actorId: "actor456",
    oldApiKeyFingerprint: "sha256:abc123def456",
    status: "rotating",
    createdAt: "2024-01-01T00:00:00Z",
    rotatedAt: "2024-06-01T00:00:00Z",
    expiresAt: "2025-01-01T00:00:00Z",
  };
  assert.equal(rotatingRecord.status, "rotating");

  const revokedRecord: ApiKeyRotationRecord = {
    keyId: "key123",
    actorId: "actor456",
    oldApiKeyFingerprint: "sha256:abc123def456",
    status: "revoked",
    createdAt: "2024-01-01T00:00:00Z",
    rotatedAt: "2024-06-01T00:00:00Z",
    expiresAt: "2025-01-01T00:00:00Z",
  };
  assert.equal(revokedRecord.status, "revoked");
});

test("OidcOAuthConfig structure", () => {
  const config: OidcOAuthConfig = {
    providers: new Map(),
    jwksCache: new Map(),
    apiKeys: new Map(),
    rotationKeys: new Map(),
    trustedIssuers: ["https://issuer1.example.com", "https://issuer2.example.com"],
    audience: "my-client-id",
  };
  assert.ok(config.providers instanceof Map);
  assert.ok(config.jwksCache instanceof Map);
  assert.ok(config.apiKeys instanceof Map);
  assert.ok(config.rotationKeys instanceof Map);
  assert.deepEqual(config.trustedIssuers, ["https://issuer1.example.com", "https://issuer2.example.com"]);
  assert.equal(config.audience, "my-client-id");
});

test("ApiKeyRecord structure", () => {
  const record: ApiKeyRecord = {
    apiKey: "sk_live_abc123",
    actorId: "actor456",
    roles: ["user"],
    rotatedAt: null,
    expiresAt: null,
  };
  assert.equal(record.apiKey, "sk_live_abc123");
  assert.equal(record.actorId, "actor456");
  assert.deepEqual(record.roles, ["user"]);
  assert.equal(record.rotatedAt, null);
  assert.equal(record.expiresAt, null);
});

test("ApiKeyRecord with rotation and expiration", () => {
  const record: ApiKeyRecord = {
    apiKey: "sk_live_xyz789",
    actorId: "actor456",
    roles: ["admin", "user"],
    rotatedAt: "2024-06-01T00:00:00Z",
    expiresAt: "2025-06-01T00:00:00Z",
  };
  assert.equal(record.rotatedAt, "2024-06-01T00:00:00Z");
  assert.equal(record.expiresAt, "2025-06-01T00:00:00Z");
});

test("FetchLike is a type alias for fetch function", () => {
  // This test just verifies the type exists and is usable
  const mockFetch: FetchLike = async (url: string) => {
    return new Response("OK");
  };
  assert.equal(typeof mockFetch, "function");
});
