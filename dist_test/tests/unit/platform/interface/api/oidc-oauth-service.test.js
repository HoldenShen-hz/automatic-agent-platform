import assert from "node:assert/strict";
import test from "node:test";
import { OidcOAuthService } from "../../../../../src/platform/interface/api/oidc-oauth-service.js";
function createService(providers = [], trustedIssuers = [], skipSignatureVerification = false) {
    return new OidcOAuthService(providers, trustedIssuers, "test-audience", undefined, skipSignatureVerification);
}
test("OidcOAuthService can be instantiated", () => {
    const service = createService();
    assert.ok(service !== undefined);
});
test("registerProvider stores provider by issuer", () => {
    const service = createService();
    const provider = {
        issuer: "https://idp.example.com",
        authorizationEndpoint: "https://idp.example.com/auth",
        tokenEndpoint: "https://idp.example.com/token",
        jwksUri: "https://idp.example.com/.well-known/jwks.json",
        scopes: ["openid", "profile"],
    };
    service.registerProvider(provider);
    const retrieved = service.getProvider("https://idp.example.com");
    assert.ok(retrieved !== null);
    assert.equal(retrieved.issuer, "https://idp.example.com");
    assert.equal(retrieved.authorizationEndpoint, "https://idp.example.com/auth");
});
test("listProviders returns all registered providers", () => {
    const service = createService([
        {
            issuer: "https://idp1.example.com",
            authorizationEndpoint: "https://idp1.example.com/auth",
            tokenEndpoint: "https://idp1.example.com/token",
            jwksUri: "https://idp1.example.com/jwks",
            scopes: ["openid"],
        },
        {
            issuer: "https://idp2.example.com",
            authorizationEndpoint: "https://idp2.example.com/auth",
            tokenEndpoint: "https://idp2.example.com/token",
            jwksUri: "https://idp2.example.com/jwks",
            scopes: ["openid"],
        },
    ]);
    const providers = service.listProviders();
    assert.equal(providers.length, 2);
});
test("getProvider returns null for unknown issuer", () => {
    const service = createService();
    const result = service.getProvider("https://unknown.example.com");
    assert.equal(result, null);
});
test("registerApiKey stores API key record", () => {
    const service = createService();
    service.registerApiKey("test-api-key", "actor-123", ["read", "write"]);
    const result = service.validateApiKey("test-api-key");
    assert.equal(result.valid, true);
    assert.equal(result.actorId, "actor-123");
    assert.deepEqual(result.roles, ["read", "write"]);
});
test("validateApiKey returns invalid for unknown key", () => {
    const service = createService();
    const result = service.validateApiKey("unknown-key");
    assert.equal(result.valid, false);
    assert.equal(result.actorId, null);
    assert.deepEqual(result.roles, []);
});
test("validateApiKey returns invalid for expired key", () => {
    const service = createService();
    const expiredDate = new Date(Date.now() - 1000).toISOString();
    service.registerApiKey("expired-key", "actor-123", ["read"], expiredDate);
    const result = service.validateApiKey("expired-key");
    assert.equal(result.valid, false);
});
test("initiateKeyRotation creates rotation record and new key", () => {
    const service = createService();
    service.registerApiKey("old-key", "actor-123", ["read", "write"]);
    const result = service.initiateKeyRotation("old-key");
    assert.equal(result.success, true);
    assert.ok(result.rotationId !== null);
    assert.ok(result.rotationId.startsWith("rot_"));
    assert.ok(result.newKey !== null);
    assert.ok(result.newKey.startsWith("ak_"));
    // New key should be valid
    const newKeyResult = service.validateApiKey(result.newKey);
    assert.equal(newKeyResult.valid, true);
    assert.equal(newKeyResult.actorId, "actor-123");
});
test("initiateKeyRotation returns failure for unknown key", () => {
    const service = createService();
    const result = service.initiateKeyRotation("unknown-key");
    assert.equal(result.success, false);
    assert.equal(result.rotationId, null);
    assert.equal(result.newKey, null);
});
test("completeKeyRotation marks rotation as revoked", () => {
    const service = createService();
    service.registerApiKey("old-key", "actor-123", ["read"]);
    const { rotationId, newKey } = service.initiateKeyRotation("old-key");
    assert.ok(rotationId);
    const completed = service.completeKeyRotation(rotationId);
    assert.equal(completed, true);
    const status = service.getRotationStatus(rotationId);
    assert.ok(status !== null);
    assert.equal(status.status, "revoked");
});
test("completeKeyRotation returns false for unknown rotation", () => {
    const service = createService();
    const result = service.completeKeyRotation("unknown-rotation");
    assert.equal(result, false);
});
test("getRotationStatus returns null for unknown rotation", () => {
    const service = createService();
    const status = service.getRotationStatus("unknown-rotation");
    assert.equal(status, null);
});
test("generateCodeVerifier creates URL-safe random string", () => {
    const service = createService();
    const verifier1 = service.generateCodeVerifier();
    const verifier2 = service.generateCodeVerifier();
    assert.ok(verifier1.length > 0);
    assert.ok(verifier2.length > 0);
    assert.notEqual(verifier1, verifier2);
    // Should be base64url encoded (URL-safe)
    assert.ok(!verifier1.includes("+"));
    assert.ok(!verifier1.includes("/"));
    assert.ok(!verifier1.includes("="));
});
test("generateCodeChallenge creates S256 hash of verifier", () => {
    const service = createService();
    const verifier = service.generateCodeVerifier();
    const challenge = service.generateCodeChallenge(verifier);
    assert.ok(challenge.length > 0);
    // SHA256 produces 32 bytes = 43 base64url chars
    assert.equal(challenge.length, 43);
    // Should be URL-safe
    assert.ok(!challenge.includes("+"));
    assert.ok(!challenge.includes("/"));
});
test("buildAuthorizationUrl constructs correct URL", () => {
    const service = createService();
    const provider = {
        issuer: "https://idp.example.com",
        authorizationEndpoint: "https://idp.example.com/auth",
        tokenEndpoint: "https://idp.example.com/token",
        jwksUri: "https://idp.example.com/jwks",
        scopes: ["openid", "profile", "email"],
    };
    const url = service.buildAuthorizationUrl(provider, "client-123", "https://app.example.com/callback", "state-abc", "challenge-xyz", ["openid", "profile"]);
    assert.ok(url.startsWith("https://idp.example.com/auth?"));
    assert.ok(url.includes("response_type=code"));
    assert.ok(url.includes("client_id=client-123"));
    assert.ok(url.includes("redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback"));
    assert.ok(url.includes("state=state-abc"));
    assert.ok(url.includes("code_challenge=challenge-xyz"));
    assert.ok(url.includes("code_challenge_method=S256"));
    assert.ok(url.includes("scope=openid+profile"));
});
test("validateFederatedToken rejects malformed JWT", async () => {
    const service = createService([], ["https://idp.example.com"]);
    const result = await service.validateFederatedToken("not-a-jwt");
    assert.equal(result.valid, false);
    assert.equal(result.error, "jwt.malformed");
});
test("validateFederatedToken rejects invalid JWT header schema", async () => {
    const service = createService([], ["https://idp.example.com"]);
    const header = Buffer.from(JSON.stringify({ alg: 123 })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
        iss: "https://idp.example.com",
        sub: "user123",
        aud: "test-audience",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
    })).toString("base64url");
    const result = await service.validateFederatedToken(`${header}.${payload}.signature`);
    assert.equal(result.valid, false);
    assert.equal(result.error, "jwt.header_invalid");
});
test("validateFederatedToken rejects JWT with wrong number of parts", async () => {
    const service = createService([], ["https://idp.example.com"]);
    const result = await service.validateFederatedToken("part1.part2");
    assert.equal(result.valid, false);
    assert.equal(result.error, "jwt.malformed");
});
test("validateFederatedToken rejects untrusted issuer", async () => {
    const service = createService([], ["https://trusted.example.com"]);
    // Create a simple JWT-like structure (not cryptographically signed)
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
        iss: "https://untrusted.example.com",
        sub: "user123",
        aud: "test-audience",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
    })).toString("base64url");
    const token = `${header}.${payload}.signature`;
    const result = await service.validateFederatedToken(token);
    assert.equal(result.valid, false);
    assert.equal(result.error, "jwt.untrusted_issuer");
});
test("validateFederatedToken rejects wrong audience", async () => {
    const service = createService([], ["https://idp.example.com"]);
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
        iss: "https://idp.example.com",
        sub: "user123",
        aud: "wrong-audience",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
    })).toString("base64url");
    const token = `${header}.${payload}.signature`;
    const result = await service.validateFederatedToken(token);
    assert.equal(result.valid, false);
    assert.equal(result.error, "jwt.invalid_audience");
});
test("validateFederatedToken rejects invalid JWT payload schema", async () => {
    const service = createService([], ["https://idp.example.com"]);
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
        iss: "https://idp.example.com",
        sub: "user123",
        aud: ["test-audience", 42],
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
    })).toString("base64url");
    const result = await service.validateFederatedToken(`${header}.${payload}.signature`);
    assert.equal(result.valid, false);
    assert.equal(result.error, "jwt.payload_invalid");
});
test("validateFederatedToken rejects expired token", async () => {
    const service = createService([], ["https://idp.example.com"]);
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
        iss: "https://idp.example.com",
        sub: "user123",
        aud: "test-audience",
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        iat: Math.floor(Date.now() / 1000) - 7200,
    })).toString("base64url");
    const token = `${header}.${payload}.signature`;
    const result = await service.validateFederatedToken(token);
    assert.equal(result.valid, false);
    assert.equal(result.error, "jwt.token_expired");
});
test("validateFederatedToken accepts valid token from trusted issuer", async () => {
    const service = createService([], ["https://idp.example.com"], true); // skip sig verification for mock token
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
        iss: "https://idp.example.com",
        sub: "user123",
        aud: "test-audience",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        email: "user@example.com",
        name: "Test User",
    })).toString("base64url");
    const token = `${header}.${payload}.signature`;
    const result = await service.validateFederatedToken(token);
    assert.equal(result.valid, true);
    assert.equal(result.error, null);
    assert.ok(result.claims !== null);
    assert.equal(result.claims.sub, "user123");
    assert.equal(result.claims.iss, "https://idp.example.com");
    assert.equal(result.provider, "https://idp.example.com");
});
test("validateFederatedToken accepts array audience", async () => {
    const service = createService([], ["https://idp.example.com"], true); // skip sig verification for mock token
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
        iss: "https://idp.example.com",
        sub: "user123",
        aud: ["other-audience", "test-audience", "another-audience"],
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
    })).toString("base64url");
    const token = `${header}.${payload}.signature`;
    const result = await service.validateFederatedToken(token);
    assert.equal(result.valid, true);
});
test("fetchOidcDiscovery is not implemented with mock fetch", () => {
    const service = createService();
    // This would make a real HTTP call, which we don't want in unit tests
    // The method exists and would throw if called with a real fetch
    const provider = {
        issuer: "https://idp.example.com",
        authorizationEndpoint: "https://idp.example.com/auth",
        tokenEndpoint: "https://idp.example.com/token",
        jwksUri: "https://idp.example.com/jwks",
        scopes: ["openid", "profile"],
    };
    // Register manually (simulating what fetchOidcDiscovery would do)
    service.registerProvider(provider);
    const retrieved = service.getProvider("https://idp.example.com");
    assert.ok(retrieved !== null);
});
test("fetchJwks returns cached keys when fresh", async () => {
    const provider = {
        issuer: "https://idp.example.com",
        authorizationEndpoint: "https://idp.example.com/auth",
        tokenEndpoint: "https://idp.example.com/token",
        jwksUri: "https://idp.example.com/jwks",
        scopes: ["openid"],
    };
    const mockJwks = {
        keys: [
            { kty: "RSA", use: "sig", kid: "key-1", alg: "RS256", n: "abc", e: "AQAB" },
        ],
    };
    let callCount = 0;
    const mockFetch = async (url) => {
        callCount++;
        return {
            ok: true,
            json: async () => mockJwks,
        };
    };
    const service = new OidcOAuthService([provider], [], "test-audience", mockFetch);
    // First call fetches
    const keys1 = await service.fetchJwks("https://idp.example.com");
    assert.equal(callCount, 1);
    assert.equal(keys1.length, 1);
    // Second call uses cache
    const keys2 = await service.fetchJwks("https://idp.example.com");
    assert.equal(callCount, 1); // Still 1, not fetched again
    assert.equal(keys2.length, 1);
});
test("fetchJwks throws for unregistered provider", async () => {
    const service = createService();
    await assert.rejects(async () => service.fetchJwks("https://unknown.example.com"), (err) => err.message.includes("oidc.provider_not_registered"));
});
test("exchangeCodeForTokens works with mock fetch", async () => {
    const provider = {
        issuer: "https://idp.example.com",
        authorizationEndpoint: "https://idp.example.com/auth",
        tokenEndpoint: "https://idp.example.com/token",
        jwksUri: "https://idp.example.com/jwks",
        scopes: ["openid"],
    };
    const mockFetch = async (url) => {
        const urlStr = url instanceof URL ? url.toString() : typeof url === "string" ? url : url.url;
        if (urlStr === provider.tokenEndpoint) {
            return {
                ok: true,
                json: async () => ({
                    access_token: "access-123",
                    id_token: "id-456",
                    expires_in: 3600,
                }),
            };
        }
        return { ok: false, status: 404 };
    };
    const service = new OidcOAuthService([provider], [], "test-audience", mockFetch);
    const result = await service.exchangeCodeForTokens("auth-code-123", "https://app.example.com/callback", "code-verifier-456", provider, "client-id", "client-secret");
    assert.equal(result.accessToken, "access-123");
    assert.equal(result.idToken, "id-456");
    assert.equal(result.expiresIn, 3600);
});
//# sourceMappingURL=oidc-oauth-service.test.js.map