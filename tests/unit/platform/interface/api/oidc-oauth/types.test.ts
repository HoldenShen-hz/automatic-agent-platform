import assert from "node:assert/strict";
import test from "node:test";

import type {
  OidcProvider,
  JwksKey,
  FederatedTokenClaims,
  TokenValidationResult,
  ApiKeyRotationRecord,
  OidcOAuthConfig,
  ApiKeyRecord,
  FetchLike,
} from "../../../../../../src/platform/interface/api/oidc-oauth/types.js";

test("OidcProvider structure is correct", () => {
  const provider: OidcProvider = {
    issuer: "https://example.com",
    authorizationEndpoint: "https://example.com/auth",
    tokenEndpoint: "https://example.com/token",
    jwksUri: "https://example.com/.well-known/jwks.json",
    userInfoEndpoint: "https://example.com/userinfo",
    scopes: ["openid", "profile", "email"],
  };
  assert.equal(provider.issuer, "https://example.com");
  assert.equal(provider.authorizationEndpoint, "https://example.com/auth");
  assert.equal(provider.tokenEndpoint, "https://example.com/token");
  assert.equal(provider.jwksUri, "https://example.com/.well-known/jwks.json");
  assert.equal(provider.userInfoEndpoint, "https://example.com/userinfo");
  assert.deepEqual(provider.scopes, ["openid", "profile", "email"]);
});

test("OidcProvider allows minimal definition without optional fields", () => {
  const provider: OidcProvider = {
    issuer: "https://example.com",
    authorizationEndpoint: "https://example.com/auth",
    tokenEndpoint: "https://example.com/token",
    jwksUri: "https://example.com/.well-known/jwks.json",
    scopes: [],
  };
  assert.equal(provider.issuer, "https://example.com");
  assert.equal(provider.userInfoEndpoint, undefined);
});

test("JwksKey structure for RSA key", () => {
  const key: JwksKey = {
    kty: "RSA",
    use: "sig",
    kid: "key-1",
    alg: "RS256",
    n: "0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw",
    e: "AQAB",
  };
  assert.equal(key.kty, "RSA");
  assert.equal(key.use, "sig");
  assert.equal(key.kid, "key-1");
  assert.equal(key.alg, "RS256");
  assert.ok(key.n != null);
  assert.equal(key.e, "AQAB");
});

test("JwksKey structure for EC key", () => {
  const key: JwksKey = {
    kty: "EC",
    use: "sig",
    kid: "key-2",
    alg: "ES256",
    crv: "P-256",
    x: "f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU",
    y: "x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0",
  };
  assert.equal(key.kty, "EC");
  assert.equal(key.crv, "P-256");
  assert.ok(key.x != null);
  assert.ok(key.y != null);
});

test("FederatedTokenClaims structure is correct", () => {
  const claims: FederatedTokenClaims = {
    sub: "user-123",
    iss: "https://example.com",
    aud: "client-id",
    exp: 1735689600,
    iat: 1735603200,
    email: "user@example.com",
    name: "Test User",
    roles: ["admin", "developer"],
  };
  assert.equal(claims.sub, "user-123");
  assert.equal(claims.iss, "https://example.com");
  assert.equal(claims.aud, "client-id");
  assert.equal(claims.exp, 1735689600);
  assert.equal(claims.iat, 1735603200);
  assert.equal(claims.email, "user@example.com");
  assert.equal(claims.name, "Test User");
  assert.deepEqual(claims.roles, ["admin", "developer"]);
});

test("FederatedTokenClaims allows string array audience", () => {
  const claims: FederatedTokenClaims = {
    sub: "user-123",
    iss: "https://example.com",
    aud: ["client-id-1", "client-id-2"],
    exp: 1735689600,
    iat: 1735603200,
  };
  assert.ok(Array.isArray(claims.aud));
  assert.equal((claims.aud as string[])[0], "client-id-1");
});

test("FederatedTokenClaims allows minimal definition without optional fields", () => {
  const claims: FederatedTokenClaims = {
    sub: "user-123",
    iss: "https://example.com",
    aud: "client-id",
    exp: 1735689600,
    iat: 1735603200,
  };
  assert.equal(claims.email, undefined);
  assert.equal(claims.name, undefined);
  assert.equal(claims.roles, undefined);
});

test("TokenValidationResult structure for valid token", () => {
  const result: TokenValidationResult = {
    valid: true,
    error: null,
    claims: {
      sub: "user-123",
      iss: "https://example.com",
      aud: "client-id",
      exp: 1735689600,
      iat: 1735603200,
    },
    provider: "https://example.com",
  };
  assert.equal(result.valid, true);
  assert.equal(result.error, null);
  assert.ok(result.claims != null);
  assert.equal(result.provider, "https://example.com");
});

test("TokenValidationResult structure for invalid token", () => {
  const result: TokenValidationResult = {
    valid: false,
    error: "Token expired",
    claims: null,
    provider: null,
  };
  assert.equal(result.valid, false);
  assert.equal(result.error, "Token expired");
  assert.equal(result.claims, null);
  assert.equal(result.provider, null);
});

test("ApiKeyRotationRecord structure is correct", () => {
  const record: ApiKeyRotationRecord = {
    keyId: "key-abc",
    actorId: "user-123",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    rotatedAt: null,
    expiresAt: "2027-01-01T00:00:00.000Z",
  };
  assert.equal(record.keyId, "key-abc");
  assert.equal(record.actorId, "user-123");
  assert.equal(record.status, "active");
  assert.equal(record.rotatedAt, null);
});

test("ApiKeyRotationRecord status variants", () => {
  const active: ApiKeyRotationRecord = {
    keyId: "key-1",
    actorId: "user-1",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    rotatedAt: null,
    expiresAt: "2027-01-01T00:00:00.000Z",
  };
  const rotating: ApiKeyRotationRecord = { ...active, status: "rotating" };
  const revoked: ApiKeyRotationRecord = { ...active, status: "revoked" };
  assert.equal(active.status, "active");
  assert.equal(rotating.status, "rotating");
  assert.equal(revoked.status, "revoked");
});

test("OidcOAuthConfig structure is correct", () => {
  const config: OidcOAuthConfig = {
    providers: new Map(),
    jwksCache: new Map(),
    apiKeys: new Map(),
    rotationKeys: new Map(),
    trustedIssuers: ["https://example.com"],
    audience: "my-client-id",
  };
  assert.ok(config.providers instanceof Map);
  assert.ok(config.jwksCache instanceof Map);
  assert.ok(config.apiKeys instanceof Map);
  assert.deepEqual(config.trustedIssuers, ["https://example.com"]);
  assert.equal(config.audience, "my-client-id");
});

test("ApiKeyRecord structure is correct", () => {
  const record: ApiKeyRecord = {
    apiKey: "sk_live_abc123",
    actorId: "user-123",
    roles: ["developer"],
    rotatedAt: null,
    expiresAt: null,
  };
  assert.equal(record.apiKey, "sk_live_abc123");
  assert.equal(record.actorId, "user-123");
  assert.deepEqual(record.roles, ["developer"]);
  assert.equal(record.rotatedAt, null);
  assert.equal(record.expiresAt, null);
});

test("ApiKeyRecord with rotation and expiration", () => {
  const record: ApiKeyRecord = {
    apiKey: "sk_live_abc123",
    actorId: "user-123",
    roles: ["admin"],
    rotatedAt: "2026-04-01T00:00:00.000Z",
    expiresAt: "2027-04-01T00:00:00.000Z",
  };
  assert.ok(record.rotatedAt != null);
  assert.ok(record.expiresAt != null);
});

test("FetchLike is a function type", () => {
  const fetchLike: FetchLike = fetch;
  assert.equal(typeof fetchLike, "function");
});
