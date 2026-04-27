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
} from "../../../../../src/platform/interface/api/oidc-oauth/types.js";

test("OidcProvider structure is correct", () => {
  const provider: OidcProvider = {
    issuer: "https://issuer.example.com",
    authorizationEndpoint: "https://issuer.example.com/authorize",
    tokenEndpoint: "https://issuer.example.com/token",
    jwksUri: "https://issuer.example.com/.well-known/jwks.json",
    scopes: ["openid", "profile", "email"],
  };
  assert.equal(provider.issuer, "https://issuer.example.com");
  assert.equal(provider.authorizationEndpoint, "https://issuer.example.com/authorize");
  assert.equal(provider.tokenEndpoint, "https://issuer.example.com/token");
  assert.deepEqual(provider.scopes, ["openid", "profile", "email"]);
});

test("OidcProvider allows optional userInfoEndpoint", () => {
  const provider: OidcProvider = {
    issuer: "https://issuer.example.com",
    authorizationEndpoint: "https://issuer.example.com/authorize",
    tokenEndpoint: "https://issuer.example.com/token",
    jwksUri: "https://issuer.example.com/.well-known/jwks.json",
    userInfoEndpoint: "https://issuer.example.com/userinfo",
    scopes: ["openid"],
  };
  assert.equal(provider.userInfoEndpoint, "https://issuer.example.com/userinfo");
});

test("JwksKey RSA key structure", () => {
  const key: JwksKey = {
    kty: "RSA",
    use: "sig",
    kid: "key-123",
    alg: "RS256",
    n: "modulus-value",
    e: "exponent-value",
  };
  assert.equal(key.kty, "RSA");
  assert.equal(key.use, "sig");
  assert.equal(key.kid, "key-123");
  assert.equal(key.alg, "RS256");
  assert.equal(key.n, "modulus-value");
  assert.equal(key.e, "exponent-value");
});

test("JwksKey EC key structure", () => {
  const key: JwksKey = {
    kty: "EC",
    use: "sig",
    kid: "ec-key-456",
    alg: "ES256",
    x: "x-value",
    y: "y-value",
    crv: "P-256",
  };
  assert.equal(key.kty, "EC");
  assert.equal(key.crv, "P-256");
});

test("JwksKey oct key structure", () => {
  const key: JwksKey = {
    kty: "oct",
    use: "sig",
    kid: "oct-key-789",
    alg: "HS256",
    k: "secret-key-value",
  };
  assert.equal(key.kty, "oct");
  assert.equal(key.k, "secret-key-value");
});

test("FederatedTokenClaims with string aud", () => {
  const claims: FederatedTokenClaims = {
    sub: "user123",
    iss: "https://issuer.example.com",
    aud: "client-id",
    exp: 1700000000,
    iat: 1600000000,
  };
  assert.equal(claims.aud, "client-id");
});

test("FederatedTokenClaims with array aud", () => {
  const claims: FederatedTokenClaims = {
    sub: "user456",
    iss: "https://issuer.example.com",
    aud: ["client-1", "client-2"],
    exp: 1700000000,
    iat: 1600000000,
  };
  assert.deepEqual(claims.aud, ["client-1", "client-2"]);
});

test("FederatedTokenClaims with optional fields", () => {
  const claims: FederatedTokenClaims = {
    sub: "user789",
    iss: "https://issuer.example.com",
    aud: "client-id",
    exp: 1700000000,
    iat: 1600000000,
    email: "user@example.com",
    name: "Test User",
    roles: ["admin", "user"],
  };
  assert.equal(claims.email, "user@example.com");
  assert.equal(claims.name, "Test User");
  assert.deepEqual(claims.roles, ["admin", "user"]);
});

test("TokenValidationResult valid", () => {
  const result: TokenValidationResult = {
    valid: true,
    error: null,
    claims: {
      sub: "user123",
      iss: "https://issuer.example.com",
      aud: "client-id",
      exp: 1700000000,
      iat: 1600000000,
    },
    provider: "https://issuer.example.com",
  };
  assert.equal(result.valid, true);
  assert.equal(result.claims?.sub, "user123");
});

test("TokenValidationResult invalid", () => {
  const result: TokenValidationResult = {
    valid: false,
    error: "token expired",
    claims: null,
    provider: null,
  };
  assert.equal(result.valid, false);
  assert.equal(result.error, "token expired");
  assert.equal(result.claims, null);
});

test("ApiKeyRotationRecord active", () => {
  const record: ApiKeyRotationRecord = {
    keyId: "key_rotation_123",
    actorId: "actor_456",
    status: "active",
    createdAt: "2026-04-01T00:00:00.000Z",
    rotatedAt: null,
    expiresAt: "2026-05-01T00:00:00.000Z",
  };
  assert.equal(record.status, "active");
});

test("ApiKeyRotationRecord rotating", () => {
  const record: ApiKeyRotationRecord = {
    keyId: "key_rotation_123",
    actorId: "actor_456",
    status: "rotating",
    createdAt: "2026-04-01T00:00:00.000Z",
    rotatedAt: "2026-04-15T00:00:00.000Z",
    expiresAt: "2026-05-01T00:00:00.000Z",
  };
  assert.equal(record.status, "rotating");
});

test("ApiKeyRotationRecord revoked", () => {
  const record: ApiKeyRotationRecord = {
    keyId: "key_rotation_123",
    actorId: "actor_456",
    status: "revoked",
    createdAt: "2026-04-01T00:00:00.000Z",
    rotatedAt: "2026-04-15T00:00:00.000Z",
    expiresAt: "2026-04-20T00:00:00.000Z",
  };
  assert.equal(record.status, "revoked");
});

test("OidcOAuthConfig empty", () => {
  const config: OidcOAuthConfig = {
    providers: new Map(),
    jwksCache: new Map(),
    apiKeys: new Map(),
    rotationKeys: new Map(),
    trustedIssuers: [],
    audience: "default",
  };
  assert.equal(config.providers.size, 0);
  assert.equal(config.audience, "default");
});

test("OidcOAuthConfig with provider", () => {
  const config: OidcOAuthConfig = {
    providers: new Map([
      [
        "https://issuer.example.com",
        {
          issuer: "https://issuer.example.com",
          authorizationEndpoint: "https://issuer.example.com/authorize",
          tokenEndpoint: "https://issuer.example.com/token",
          jwksUri: "https://issuer.example.com/.well-known/jwks.json",
          scopes: ["openid"],
        },
      ],
    ]),
    jwksCache: new Map(),
    apiKeys: new Map(),
    rotationKeys: new Map(),
    trustedIssuers: ["https://issuer.example.com"],
    audience: "client-id",
  };
  assert.equal(config.providers.size, 1);
});

test("ApiKeyRecord structure", () => {
  const record: ApiKeyRecord = {
    apiKey: "ak_live_abc123",
    actorId: "actor_456",
    roles: ["admin", "user"],
    rotatedAt: null,
    expiresAt: null,
  };
  assert.equal(record.apiKey, "ak_live_abc123");
  assert.deepEqual(record.roles, ["admin", "user"]);
});

test("FetchLike type alias works with global fetch", () => {
  const fetchFn: FetchLike = fetch;
  assert.equal(typeof fetchFn, "function");
});