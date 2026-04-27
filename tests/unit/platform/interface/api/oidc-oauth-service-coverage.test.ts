import test from "node:test";
import assert from "node:assert/strict";

import { OidcOAuthService } from "../../../../../src/platform/interface/api/oidc-oauth-service.js";
import type { OidcProvider, JwksKey } from "../../../../../src/platform/interface/api/oidc-oauth/types.js";

// Mock fetch implementation
function createMockFetch(response: unknown, ok = true): typeof fetch {
  return async (_url: string | URL | Request, _init?: RequestInit) => {
    return {
      ok,
      status: ok ? 200 : 500,
      json: async () => response,
    } as Response;
  };
}

test("OidcOAuthService registers provider on construction", () => {
  const provider: OidcProvider = {
    issuer: "https://idp.test.com",
    authorizationEndpoint: "https://idp.test.com/authorize",
    tokenEndpoint: "https://idp.test.com/token",
    jwksUri: "https://idp.test.com/jwks",
    scopes: ["openid", "profile"],
  };

  const service = new OidcOAuthService([provider], ["https://idp.test.com"], "test-audience");
  const registered = service.getProvider("https://idp.test.com");

  assert.ok(registered != null);
  assert.equal(registered!.issuer, "https://idp.test.com");
  assert.deepStrictEqual(registered!.scopes, ["openid", "profile"]);
});

test("OidcOAuthService lists all registered providers", () => {
  const provider1: OidcProvider = {
    issuer: "https://idp1.test.com",
    authorizationEndpoint: "https://idp1.test.com/authorize",
    tokenEndpoint: "https://idp1.test.com/token",
    jwksUri: "https://idp1.test.com/jwks",
    scopes: ["openid"],
  };

  const provider2: OidcProvider = {
    issuer: "https://idp2.test.com",
    authorizationEndpoint: "https://idp2.test.com/authorize",
    tokenEndpoint: "https://idp2.test.com/token",
    jwksUri: "https://idp2.test.com/jwks",
    scopes: ["openid", "email"],
  };

  const service = new OidcOAuthService([provider1, provider2]);
  const providers = service.listProviders();

  assert.equal(providers.length, 2);
});

test("OidcOAuthService fetchOidcDiscovery fetches and caches provider config", async () => {
  const discoveryDoc = {
    issuer: "https://idp.discovery.com",
    authorization_endpoint: "https://idp.discovery.com/authorize",
    token_endpoint: "https://idp.discovery.com/token",
    jwks_uri: "https://idp.discovery.com/jwks",
    userinfo_endpoint: "https://idp.discovery.com/userinfo",
    scopes_supported: ["openid", "profile", "email"],
  };

  const mockFetch = createMockFetch(discoveryDoc);
  const service = new OidcOAuthService([], ["https://idp.discovery.com"], "test", mockFetch);

  const provider = await service.fetchOidcDiscovery("https://idp.discovery.com");

  assert.equal(provider.issuer, "https://idp.discovery.com");
  assert.equal(provider.authorizationEndpoint, "https://idp.discovery.com/authorize");
  assert.equal(provider.tokenEndpoint, "https://idp.discovery.com/token");
  assert.equal(provider.jwksUri, "https://idp.discovery.com/jwks");
  assert.equal(provider.userInfoEndpoint, "https://idp.discovery.com/userinfo");
  assert.deepStrictEqual(provider.scopes, ["openid", "profile", "email"]);
});

test("OidcOAuthService fetchOidcDiscovery normalizes trailing slash in issuer", async () => {
  const discoveryDoc = {
    issuer: "https://idp.normalize.com",
    authorization_endpoint: "https://idp.normalize.com/authorize",
    token_endpoint: "https://idp.normalize.com/token",
    jwks_uri: "https://idp.normalize.com/jwks",
  };

  const mockFetch = createMockFetch(discoveryDoc);
  const service = new OidcOAuthService([], ["https://idp.normalize.com"], "test", mockFetch);

  await service.fetchOidcDiscovery("https://idp.normalize.com/");

  const provider = service.getProvider("https://idp.normalize.com");
  assert.ok(provider != null);
});

test("OidcOAuthService fetchOidcDiscovery throws on HTTP error", async () => {
  const mockFetch = createMockFetch({}, false);
  const service = new OidcOAuthService([], ["https://idp.error.com"], "test", mockFetch);

  await assert.rejects(
    async () => service.fetchOidcDiscovery("https://idp.error.com"),
    (err: unknown) => {
      return (err as { code?: string }).code === "oidc.discovery_failed";
    },
  );
});

test("OidcOAuthService fetchJwks fetches and caches JWKS", async () => {
  const jwks = {
    keys: [
      {
        kty: "RSA",
        use: "sig",
        kid: "key-1",
        alg: "RS256",
        n: "test-n",
        e: "AQAB",
      },
    ],
  };

  const mockFetch = createMockFetch(jwks);
  const service = new OidcOAuthService([], ["https://idp.jwks.com"], "test", mockFetch);

  service.registerProvider({
    issuer: "https://idp.jwks.com",
    authorizationEndpoint: "https://idp.jwks.com/authorize",
    tokenEndpoint: "https://idp.jwks.com/token",
    jwksUri: "https://idp.jwks.com/jwks",
    scopes: ["openid"],
  });

  const keys = await service.fetchJwks("https://idp.jwks.com");

  assert.equal(keys.length, 1);
  assert.equal(keys[0]!.kid, "key-1");
  assert.equal(keys[0]!.kty, "RSA");
});

test("OidcOAuthService fetchJwks returns cached keys within TTL", async () => {
  const jwks = {
    keys: [
      {
        kty: "RSA",
        use: "sig",
        kid: "key-cached",
        alg: "RS256",
        n: "test-n",
        e: "AQAB",
      },
    ],
  };

  const mockFetch = createMockFetch(jwks);
  const service = new OidcOAuthService([], ["https://idp.cached.com"], "test", mockFetch);

  service.registerProvider({
    issuer: "https://idp.cached.com",
    authorizationEndpoint: "https://idp.cached.com/authorize",
    tokenEndpoint: "https://idp.cached.com/token",
    jwksUri: "https://idp.cached.com/jwks",
    scopes: ["openid"],
  });

  // First fetch
  const keys1 = await service.fetchJwks("https://idp.cached.com");
  assert.equal(keys1[0]!.kid, "key-cached");

  // Modify the mock to return different keys
  const differentJwks = { keys: [{ ...jwks.keys[0]!, kid: "key-different" }] };
  const differentMockFetch = createMockFetch(differentJwks);
  (service as unknown as { fetchImpl: typeof fetch }).fetchImpl = differentMockFetch;

  // Second fetch should return cached keys
  const keys2 = await service.fetchJwks("https://idp.cached.com");
  assert.equal(keys2[0]!.kid, "key-cached");
});

test("OidcOAuthService fetchJwks throws when provider not registered", async () => {
  const service = new OidcOAuthService([], ["https://idp.unknown.com"], "test");

  await assert.rejects(
    async () => service.fetchJwks("https://idp.unknown.com"),
    (err: unknown) => {
      return (err as { code?: string }).code === "oidc.provider_not_registered";
    },
  );
});

test("OidcOAuthService validateFederatedToken rejects malformed JWT", async () => {
  const service = new OidcOAuthService([], ["https://idp.test.com"], "test", undefined, true);

  const result = await service.validateFederatedToken("not-a-valid-jwt");

  assert.equal(result.valid, false);
  assert.equal(result.error, "jwt.malformed");
  assert.equal(result.claims, null);
});

test("OidcOAuthService validateFederatedToken rejects untrusted issuer", async () => {
  const service = new OidcOAuthService([], ["https://trusted.com"], "test", undefined, true);

  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "key-1" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    sub: "user-123",
    iss: "https://untrusted.com",
    aud: "test",
    exp: 2000000000,
    iat: 1000000000,
  })).toString("base64url");
  const token = `${header}.${payload}.signature`;

  const result = await service.validateFederatedToken(token);

  assert.equal(result.valid, false);
  assert.equal(result.error, "jwt.untrusted_issuer");
});

test("OidcOAuthService validateFederatedToken rejects invalid audience", async () => {
  const service = new OidcOAuthService([], ["https://idp.test.com"], "expected-audience", undefined, true);

  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "key-1" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    sub: "user-123",
    iss: "https://idp.test.com",
    aud: "wrong-audience",
    exp: 2000000000,
    iat: 1000000000,
  })).toString("base64url");
  const token = `${header}.${payload}.signature`;

  const result = await service.validateFederatedToken(token);

  assert.equal(result.valid, false);
  assert.equal(result.error, "jwt.invalid_audience");
});

test("OidcOAuthService validateFederatedToken accepts array audience", async () => {
  const service = new OidcOAuthService([], ["https://idp.test.com"], "expected-audience", undefined, true);

  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "key-1" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    sub: "user-123",
    iss: "https://idp.test.com",
    aud: ["other-audience", "expected-audience"],
    exp: 2000000000,
    iat: 1000000000,
  })).toString("base64url");
  const token = `${header}.${payload}.signature`;

  const result = await service.validateFederatedToken(token);

  assert.equal(result.valid, true);
  assert.equal(result.error, null);
});

test("OidcOAuthService validateFederatedToken rejects expired token", async () => {
  const service = new OidcOAuthService([], ["https://idp.test.com"], "test", undefined, true);

  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "key-1" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    sub: "user-123",
    iss: "https://idp.test.com",
    aud: "test",
    exp: 1000000000, // In the past
    iat: 1000000000,
  })).toString("base64url");
  const token = `${header}.${payload}.signature`;

  const result = await service.validateFederatedToken(token);

  assert.equal(result.valid, false);
  assert.equal(result.error, "jwt.token_expired");
});

test("OidcOAuthService validateFederatedToken handles exception gracefully", async () => {
  const service = new OidcOAuthService([], ["https://idp.test.com"], "test", undefined, true);

  const result = await service.validateFederatedToken("header.payload.signature");

  assert.equal(result.valid, false);
  assert.ok(result.error != null);
});

test("OidcOAuthService registerApiKey stores key with roles and expiration", () => {
  const service = new OidcOAuthService();

  service.registerApiKey("test-api-key", "actor-123", ["admin", "developer"], "2027-12-31T23:59:59Z");

  const result = service.validateApiKey("test-api-key");

  assert.equal(result.valid, true);
  assert.equal(result.actorId, "actor-123");
  assert.deepStrictEqual(result.roles, ["admin", "developer"]);
});

test("OidcOAuthService validateApiKey returns invalid for unknown key", () => {
  const service = new OidcOAuthService();

  const result = service.validateApiKey("unknown-key");

  assert.equal(result.valid, false);
  assert.equal(result.actorId, null);
  assert.deepStrictEqual(result.roles, []);
});

test("OidcOAuthService validateApiKey returns invalid for expired key", () => {
  const service = new OidcOAuthService();

  service.registerApiKey("expired-key", "actor-123", ["user"], "2020-01-01T00:00:00Z");

  const result = service.validateApiKey("expired-key");

  assert.equal(result.valid, false);
  assert.equal(result.actorId, null);
});

test("OidcOAuthService initiateKeyRotation creates new key and rotation record", () => {
  const service = new OidcOAuthService();

  service.registerApiKey("old-key", "actor-123", ["user"]);
  const result = service.initiateKeyRotation("old-key");

  assert.equal(result.success, true);
  assert.ok(result.rotationId != null);
  assert.ok(result.newKey != null);
  assert.ok(result.rotationId!.startsWith("rot_"));
  assert.ok(result.newKey!.startsWith("ak_"));

  // New key should be valid
  const newKeyResult = service.validateApiKey(result.newKey!);
  assert.equal(newKeyResult.valid, true);
  assert.equal(newKeyResult.actorId, "actor-123");
});

test("OidcOAuthService initiateKeyRotation fails for unknown key", () => {
  const service = new OidcOAuthService();

  const result = service.initiateKeyRotation("unknown-key");

  assert.equal(result.success, false);
  assert.equal(result.rotationId, null);
  assert.equal(result.newKey, null);
});

test("OidcOAuthService completeKeyRotation marks rotation as revoked", () => {
  const service = new OidcOAuthService();

  service.registerApiKey("old-key", "actor-123", ["user"]);
  const rotation = service.initiateKeyRotation("old-key");

  const completed = service.completeKeyRotation(rotation.rotationId!);

  assert.equal(completed, true);

  const status = service.getRotationStatus(rotation.rotationId!);
  assert.ok(status != null);
  assert.equal(status!.status, "revoked");
});

test("OidcOAuthService completeKeyRotation returns false for unknown rotation", () => {
  const service = new OidcOAuthService();

  const result = service.completeKeyRotation("unknown-rotation-id");

  assert.equal(result, false);
});

test("OidcOAuthService completeKeyRotation returns false for already completed rotation", () => {
  const service = new OidcOAuthService();

  service.registerApiKey("old-key", "actor-123", ["user"]);
  const rotation = service.initiateKeyRotation("old-key");
  service.completeKeyRotation(rotation.rotationId!);

  const secondAttempt = service.completeKeyRotation(rotation.rotationId!);

  assert.equal(secondAttempt, false);
});

test("OidcOAuthService getRotationStatus returns null for unknown rotation", () => {
  const service = new OidcOAuthService();

  const result = service.getRotationStatus("unknown-rotation-id");

  assert.equal(result, null);
});

test("OidcOAuthService registerProvider adds new provider", () => {
  const service = new OidcOAuthService();

  service.registerProvider({
    issuer: "https://new-provider.com",
    authorizationEndpoint: "https://new-provider.com/authorize",
    tokenEndpoint: "https://new-provider.com/token",
    jwksUri: "https://new-provider.com/jwks",
    scopes: ["openid"],
  });

  const provider = service.getProvider("https://new-provider.com");

  assert.ok(provider != null);
  assert.equal(provider!.issuer, "https://new-provider.com");
});

test("OidcOAuthService generateCodeVerifier returns base64url string", () => {
  const service = new OidcOAuthService();

  const verifier = service.generateCodeVerifier();

  assert.ok(verifier.length > 0);
  // Should be base64url encoded (32 bytes = ~43 chars base64url)
  assert.ok(verifier.length >= 40);
});

test("OidcOAuthService generateCodeChallenge returns SHA256 hash", () => {
  const service = new OidcOAuthService();

  const verifier = "test-verifier-string";
  const challenge = service.generateCodeChallenge(verifier);

  assert.ok(challenge.length > 0);
  // SHA256 of "test-verifier-string" should be consistent
  assert.equal(challenge, "LHKy4-q59ocwlltGr-0vD9UbiHBsIU09drZuupn1ghs");
});

test("OidcOAuthService buildAuthorizationUrl constructs valid URL", () => {
  const service = new OidcOAuthService();

  const provider: OidcProvider = {
    issuer: "https://idp.auth.com",
    authorizationEndpoint: "https://idp.auth.com/authorize",
    tokenEndpoint: "https://idp.auth.com/token",
    jwksUri: "https://idp.auth.com/jwks",
    scopes: ["openid", "profile"],
  };

  const url = service.buildAuthorizationUrl(
    provider,
    "client-123",
    "https://app.example.com/callback",
    "state-abc",
    "challenge-xyz",
  );

  assert.ok(url.startsWith("https://idp.auth.com/authorize?"));
  assert.ok(url.includes("response_type=code"));
  assert.ok(url.includes("client_id=client-123"));
  assert.ok(url.includes("redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback"));
  assert.ok(url.includes("state=state-abc"));
  assert.ok(url.includes("code_challenge=challenge-xyz"));
  assert.ok(url.includes("code_challenge_method=S256"));
  assert.ok(url.includes("scope=openid+profile"));
});

test("OidcOAuthService buildAuthorizationUrl uses custom scopes when provided", () => {
  const service = new OidcOAuthService();

  const provider: OidcProvider = {
    issuer: "https://idp.auth.com",
    authorizationEndpoint: "https://idp.auth.com/authorize",
    tokenEndpoint: "https://idp.auth.com/token",
    jwksUri: "https://idp.auth.com/jwks",
    scopes: ["openid", "profile", "email", "custom"],
  };

  const url = service.buildAuthorizationUrl(
    provider,
    "client-123",
    "https://app.example.com/callback",
    "state-abc",
    "challenge-xyz",
    ["openid", "email"],
  );

  assert.ok(url.includes("scope=openid+email"));
});
