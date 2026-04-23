import test from "node:test";
import assert from "node:assert/strict";
import { decodeJwtJsonSegment, parseJwtHeader, parseFederatedTokenClaims, } from "../../../../../src/platform/interface/api/oidc-oauth/jwt-utils.js";
import { rsaAlgToNode, ecAlgToNode, hmacAlgToNode, } from "../../../../../src/platform/interface/api/oidc-oauth/crypto-utils.js";
test("OidcProvider type accepts valid configuration", () => {
    const provider = {
        issuer: "https://idp.example.com",
        authorizationEndpoint: "https://idp.example.com/authorize",
        tokenEndpoint: "https://idp.example.com/token",
        jwksUri: "https://idp.example.com/jwks",
        userInfoEndpoint: "https://idp.example.com/userinfo",
        scopes: ["openid", "profile", "email"],
    };
    assert.equal(provider.issuer, "https://idp.example.com");
    assert.equal(provider.authorizationEndpoint, "https://idp.example.com/authorize");
    assert.equal(provider.tokenEndpoint, "https://idp.example.com/token");
    assert.equal(provider.jwksUri, "https://idp.example.com/jwks");
    assert.equal(provider.userInfoEndpoint, "https://idp.example.com/userinfo");
    assert.deepStrictEqual(provider.scopes, ["openid", "profile", "email"]);
});
test("OidcProvider type works without optional fields", () => {
    const provider = {
        issuer: "https://idp.example.com",
        authorizationEndpoint: "https://idp.example.com/authorize",
        tokenEndpoint: "https://idp.example.com/token",
        jwksUri: "https://idp.example.com/jwks",
        scopes: ["openid"],
    };
    assert.equal(provider.issuer, "https://idp.example.com");
    assert.equal(provider.userInfoEndpoint, undefined);
});
test("JwksKey type accepts RSA key", () => {
    const key = {
        kty: "RSA",
        use: "sig",
        kid: "key-123",
        alg: "RS256",
        n: "0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw",
        e: "AQAB",
    };
    assert.equal(key.kty, "RSA");
    assert.equal(key.use, "sig");
    assert.equal(key.kid, "key-123");
    assert.equal(key.alg, "RS256");
    assert.ok(key.n !== undefined);
    assert.ok(key.e !== undefined);
});
test("JwksKey type accepts EC key", () => {
    const key = {
        kty: "EC",
        use: "sig",
        kid: "ec-key-456",
        alg: "ES256",
        x: "f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU",
        y: "x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0",
        crv: "P-256",
    };
    assert.equal(key.kty, "EC");
    assert.equal(key.use, "sig");
    assert.equal(key.kid, "ec-key-456");
    assert.equal(key.alg, "ES256");
    assert.ok(key.x !== undefined);
    assert.ok(key.y !== undefined);
    assert.equal(key.crv, "P-256");
});
test("JwksKey type accepts symmetric key", () => {
    const key = {
        kty: "oct",
        use: "sig",
        kid: "symmetric-key-789",
        alg: "HS256",
        k: "AyM32w-8r8P1L8_vI1iLJdS3RVxAqWnbJEuXBo",
    };
    assert.equal(key.kty, "oct");
    assert.equal(key.use, "sig");
    assert.equal(key.kid, "symmetric-key-789");
    assert.equal(key.alg, "HS256");
    assert.ok(key.k !== undefined);
});
test("FederatedTokenClaims type accepts minimal claims", () => {
    const claims = {
        sub: "user123",
        iss: "https://issuer.example.com",
        aud: "client-id",
        exp: 1700000000,
        iat: 1600000000,
    };
    assert.equal(claims.sub, "user123");
    assert.equal(claims.iss, "https://issuer.example.com");
    assert.equal(claims.aud, "client-id");
    assert.equal(claims.exp, 1700000000);
    assert.equal(claims.iat, 1600000000);
});
test("FederatedTokenClaims type accepts claims with string aud", () => {
    const claims = {
        sub: "user456",
        iss: "https://auth.example.com",
        aud: "single-audience",
        exp: 1700000000,
        iat: 1600000000,
    };
    assert.equal(claims.aud, "single-audience");
});
test("FederatedTokenClaims type accepts claims with array aud", () => {
    const claims = {
        sub: "user789",
        iss: "https://auth.example.com",
        aud: ["client-1", "client-2", "client-3"],
        exp: 1700000000,
        iat: 1600000000,
    };
    assert.deepStrictEqual(claims.aud, ["client-1", "client-2", "client-3"]);
});
test("FederatedTokenClaims type accepts claims with optional fields", () => {
    const claims = {
        sub: "user-with-optional",
        iss: "https://auth.example.com",
        aud: "client-id",
        exp: 1700000000,
        iat: 1600000000,
        email: "user@example.com",
        name: "Test User",
        roles: ["admin", "user", "viewer"],
    };
    assert.equal(claims.email, "user@example.com");
    assert.equal(claims.name, "Test User");
    assert.deepStrictEqual(claims.roles, ["admin", "user", "viewer"]);
});
test("TokenValidationResult type accepts valid result", () => {
    const result = {
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
    assert.equal(result.error, null);
    assert.ok(result.claims !== null);
    assert.equal(result.provider, "https://issuer.example.com");
});
test("TokenValidationResult type accepts invalid result", () => {
    const result = {
        valid: false,
        error: "token_expired",
        claims: null,
        provider: null,
    };
    assert.equal(result.valid, false);
    assert.equal(result.error, "token_expired");
    assert.equal(result.claims, null);
    assert.equal(result.provider, null);
});
test("ApiKeyRotationRecord type accepts active record", () => {
    const record = {
        keyId: "key-rot-001",
        actorId: "actor-123",
        status: "active",
        createdAt: "2024-01-01T00:00:00Z",
        rotatedAt: null,
        expiresAt: "2025-01-01T00:00:00Z",
    };
    assert.equal(record.keyId, "key-rot-001");
    assert.equal(record.actorId, "actor-123");
    assert.equal(record.status, "active");
    assert.equal(record.rotatedAt, null);
});
test("ApiKeyRotationRecord type accepts rotating record", () => {
    const record = {
        keyId: "key-rot-002",
        actorId: "actor-456",
        status: "rotating",
        createdAt: "2024-01-01T00:00:00Z",
        rotatedAt: "2024-06-01T00:00:00Z",
        expiresAt: "2025-01-01T00:00:00Z",
    };
    assert.equal(record.status, "rotating");
    assert.equal(record.rotatedAt, "2024-06-01T00:00:00Z");
});
test("ApiKeyRotationRecord type accepts revoked record", () => {
    const record = {
        keyId: "key-rot-003",
        actorId: "actor-789",
        status: "revoked",
        createdAt: "2024-01-01T00:00:00Z",
        rotatedAt: "2024-03-01T00:00:00Z",
        expiresAt: "2024-12-31T23:59:59Z",
    };
    assert.equal(record.status, "revoked");
});
test("OidcOAuthConfig type structure", () => {
    const config = {
        providers: new Map(),
        jwksCache: new Map(),
        apiKeys: new Map(),
        rotationKeys: new Map(),
        trustedIssuers: ["https://issuer1.example.com", "https://issuer2.example.com"],
        audience: "test-audience",
    };
    assert.ok(config.providers instanceof Map);
    assert.ok(config.jwksCache instanceof Map);
    assert.ok(config.apiKeys instanceof Map);
    assert.ok(config.rotationKeys instanceof Map);
    assert.deepStrictEqual(config.trustedIssuers, ["https://issuer1.example.com", "https://issuer2.example.com"]);
    assert.equal(config.audience, "test-audience");
});
test("OidcOAuthConfig accepts populated maps", () => {
    const jwksKey = {
        kty: "RSA",
        use: "sig",
        kid: "test-key",
        alg: "RS256",
        n: "test-n",
        e: "AQAB",
    };
    const apiKeyRecord = {
        apiKey: "sk-test-key",
        actorId: "actor-001",
        roles: ["user"],
        rotatedAt: null,
        expiresAt: null,
    };
    const config = {
        providers: new Map([["https://issuer.example.com", {
                    issuer: "https://issuer.example.com",
                    authorizationEndpoint: "https://issuer.example.com/auth",
                    tokenEndpoint: "https://issuer.example.com/token",
                    jwksUri: "https://issuer.example.com/jwks",
                    scopes: ["openid"],
                }]]),
        jwksCache: new Map([["https://issuer.example.com", {
                    keys: [jwksKey],
                    fetchedAt: Date.now(),
                }]]),
        apiKeys: new Map([["sk-test-key", apiKeyRecord]]),
        rotationKeys: new Map(),
        trustedIssuers: ["https://issuer.example.com"],
        audience: "test-audience",
    };
    assert.equal(config.providers.size, 1);
    assert.equal(config.jwksCache.size, 1);
    assert.equal(config.apiKeys.size, 1);
    assert.equal(config.rotationKeys.size, 0);
});
test("ApiKeyRecord type accepts valid record", () => {
    const record = {
        apiKey: "sk_live_abc123",
        actorId: "user-001",
        roles: ["admin", "developer"],
        rotatedAt: "2024-01-15T10:30:00Z",
        expiresAt: "2025-01-15T10:30:00Z",
    };
    assert.equal(record.apiKey, "sk_live_abc123");
    assert.equal(record.actorId, "user-001");
    assert.deepStrictEqual(record.roles, ["admin", "developer"]);
    assert.equal(record.rotatedAt, "2024-01-15T10:30:00Z");
    assert.equal(record.expiresAt, "2025-01-15T10:30:00Z");
});
test("ApiKeyRecord type accepts record without optional fields", () => {
    const record = {
        apiKey: "sk_test_xyz789",
        actorId: "user-002",
        roles: ["viewer"],
        rotatedAt: null,
        expiresAt: null,
    };
    assert.equal(record.apiKey, "sk_test_xyz789");
    assert.equal(record.rotatedAt, null);
    assert.equal(record.expiresAt, null);
});
test("FetchLike type is typeof fetch", () => {
    const fetchLike = fetch;
    assert.ok(typeof fetchLike === "function");
});
// crypto-utils tests
test("decodeJwtJsonSegment parses valid base64url header", () => {
    const headerObj = { alg: "RS256", kid: "key-1" };
    const encoded = Buffer.from(JSON.stringify(headerObj)).toString("base64url");
    const result = decodeJwtJsonSegment(encoded, "header");
    assert.deepStrictEqual(result, headerObj);
});
test("decodeJwtJsonSegment parses valid base64url payload", () => {
    const payloadObj = { sub: "user-123", iss: "https://auth.example.com", aud: "client-1", exp: 2000000000, iat: 1000000000 };
    const encoded = Buffer.from(JSON.stringify(payloadObj)).toString("base64url");
    const result = decodeJwtJsonSegment(encoded, "payload");
    assert.deepStrictEqual(result, payloadObj);
});
test("decodeJwtJsonSegment throws AuthError for invalid base64", () => {
    assert.throws(() => {
        decodeJwtJsonSegment("not-valid-base64!!!", "header");
    }, (err) => {
        return err.code === "jwt.header_invalid";
    });
});
test("decodeJwtJsonSegment throws AuthError for non-JSON content", () => {
    const encoded = Buffer.from("this is not json").toString("base64url");
    assert.throws(() => {
        decodeJwtJsonSegment(encoded, "payload");
    }, (err) => {
        return err.code === "jwt.payload_invalid";
    });
});
test("parseJwtHeader extracts kid and alg from valid header", () => {
    const result = parseJwtHeader({ alg: "RS256", kid: "key-42" });
    assert.deepStrictEqual(result, { alg: "RS256", kid: "key-42" });
});
test("parseJwtHeader handles header with only kid", () => {
    const result = parseJwtHeader({ kid: "key-1" });
    assert.deepStrictEqual(result, { kid: "key-1" });
});
test("parseJwtHeader handles header with only alg", () => {
    const result = parseJwtHeader({ alg: "ES256" });
    assert.deepStrictEqual(result, { alg: "ES256" });
});
test("parseJwtHeader handles empty header", () => {
    const result = parseJwtHeader({});
    assert.deepStrictEqual(result, {});
});
test("parseJwtHeader throws for non-object input", () => {
    assert.throws(() => {
        parseJwtHeader(null);
    }, (err) => {
        return err.code === "jwt.header_invalid";
    });
    assert.throws(() => {
        parseJwtHeader("string");
    }, (err) => {
        return err.code === "jwt.header_invalid";
    });
    assert.throws(() => {
        parseJwtHeader(123);
    }, (err) => {
        return err.code === "jwt.header_invalid";
    });
});
test("parseJwtHeader throws when kid is not a string", () => {
    assert.throws(() => {
        parseJwtHeader({ kid: 123 });
    }, (err) => {
        return err.code === "jwt.header_invalid";
    });
});
test("parseJwtHeader throws when alg is not a string", () => {
    assert.throws(() => {
        parseJwtHeader({ alg: { not: "string" } });
    }, (err) => {
        return err.code === "jwt.header_invalid";
    });
});
test("parseFederatedTokenClaims parses valid claims", () => {
    const claims = {
        sub: "user-abc",
        iss: "https://issuer.example.com",
        aud: "audience-1",
        exp: 2000000000,
        iat: 1000000000,
        email: "user@example.com",
        name: "Test User",
        roles: ["admin", "viewer"],
    };
    const result = parseFederatedTokenClaims(claims);
    assert.strictEqual(result.sub, "user-abc");
    assert.strictEqual(result.iss, "https://issuer.example.com");
    assert.strictEqual(result.aud, "audience-1");
    assert.strictEqual(result.exp, 2000000000);
    assert.strictEqual(result.iat, 1000000000);
    assert.strictEqual(result.email, "user@example.com");
    assert.strictEqual(result.name, "Test User");
    assert.deepStrictEqual(result.roles, ["admin", "viewer"]);
});
test("parseFederatedTokenClaims handles array audience", () => {
    const claims = {
        sub: "user-123",
        iss: "https://issuer.example.com",
        aud: ["audience-1", "audience-2"],
        exp: 2000000000,
        iat: 1000000000,
    };
    const result = parseFederatedTokenClaims(claims);
    assert.deepStrictEqual(result.aud, ["audience-1", "audience-2"]);
});
test("parseFederatedTokenClaims handles claims without optional fields", () => {
    const claims = {
        sub: "user-min",
        iss: "https://issuer.example.com",
        aud: "client",
        exp: 2000000000,
        iat: 1000000000,
    };
    const result = parseFederatedTokenClaims(claims);
    assert.strictEqual(result.sub, "user-min");
    assert.strictEqual(result.email, undefined);
    assert.strictEqual(result.name, undefined);
    assert.strictEqual(result.roles, undefined);
});
test("parseFederatedTokenClaims throws for non-object input", () => {
    assert.throws(() => {
        parseFederatedTokenClaims(null);
    }, (err) => {
        return err.code === "jwt.payload_invalid";
    });
    assert.throws(() => {
        parseFederatedTokenClaims("string");
    }, (err) => {
        return err.code === "jwt.payload_invalid";
    });
});
test("parseFederatedTokenClaims throws when sub is missing or not string", () => {
    assert.throws(() => {
        parseFederatedTokenClaims({ iss: "x", aud: "x", exp: 1, iat: 1 });
    }, (err) => err.code === "jwt.payload_invalid");
    assert.throws(() => {
        parseFederatedTokenClaims({ sub: 123, iss: "x", aud: "x", exp: 1, iat: 1 });
    }, (err) => err.code === "jwt.payload_invalid");
});
test("parseFederatedTokenClaims throws when iss is missing or not string", () => {
    assert.throws(() => {
        parseFederatedTokenClaims({ sub: "x", aud: "x", exp: 1, iat: 1 });
    }, (err) => err.code === "jwt.payload_invalid");
    assert.throws(() => {
        parseFederatedTokenClaims({ sub: "x", iss: 123, aud: "x", exp: 1, iat: 1 });
    }, (err) => err.code === "jwt.payload_invalid");
});
test("parseFederatedTokenClaims throws when exp or iat are not finite numbers", () => {
    assert.throws(() => {
        parseFederatedTokenClaims({ sub: "x", iss: "x", aud: "x", exp: "not-num", iat: 1 });
    }, (err) => err.code === "jwt.payload_invalid");
    assert.throws(() => {
        parseFederatedTokenClaims({ sub: "x", iss: "x", aud: "x", exp: 1, iat: "not-num" });
    }, (err) => err.code === "jwt.payload_invalid");
    assert.throws(() => {
        parseFederatedTokenClaims({ sub: "x", iss: "x", aud: "x", exp: Infinity, iat: 1 });
    }, (err) => err.code === "jwt.payload_invalid");
});
test("parseFederatedTokenClaims throws when aud is invalid", () => {
    assert.throws(() => {
        parseFederatedTokenClaims({ sub: "x", iss: "x", aud: 123, exp: 1, iat: 1 });
    }, (err) => err.code === "jwt.payload_invalid");
    assert.throws(() => {
        parseFederatedTokenClaims({ sub: "x", iss: "x", aud: ["a", 123], exp: 1, iat: 1 });
    }, (err) => err.code === "jwt.payload_invalid");
});
test("parseFederatedTokenClaims throws when email is not string", () => {
    assert.throws(() => {
        parseFederatedTokenClaims({ sub: "x", iss: "x", aud: "x", exp: 1, iat: 1, email: 123 });
    }, (err) => err.code === "jwt.payload_invalid");
});
test("parseFederatedTokenClaims throws when name is not string", () => {
    assert.throws(() => {
        parseFederatedTokenClaims({ sub: "x", iss: "x", aud: "x", exp: 1, iat: 1, name: 456 });
    }, (err) => err.code === "jwt.payload_invalid");
});
test("parseFederatedTokenClaims throws when roles is not array of strings", () => {
    assert.throws(() => {
        parseFederatedTokenClaims({ sub: "x", iss: "x", aud: "x", exp: 1, iat: 1, roles: "not-array" });
    }, (err) => err.code === "jwt.payload_invalid");
    assert.throws(() => {
        parseFederatedTokenClaims({ sub: "x", iss: "x", aud: "x", exp: 1, iat: 1, roles: [1, 2, 3] });
    }, (err) => err.code === "jwt.payload_invalid");
    assert.throws(() => {
        parseFederatedTokenClaims({ sub: "x", iss: "x", aud: "x", exp: 1, iat: 1, roles: ["ok", 123] });
    }, (err) => err.code === "jwt.payload_invalid");
});
// jwt-utils tests
test("rsaAlgToNode maps RSA algorithms to Node.js hash algorithms", () => {
    assert.strictEqual(rsaAlgToNode("RS256"), "RSA-SHA256");
    assert.strictEqual(rsaAlgToNode("RS384"), "RSA-SHA384");
    assert.strictEqual(rsaAlgToNode("RS512"), "RSA-SHA512");
});
test("rsaAlgToNode returns default for unknown algorithms", () => {
    assert.strictEqual(rsaAlgToNode("RS1"), "RSA-SHA256");
    assert.strictEqual(rsaAlgToNode("unknown"), "RSA-SHA256");
    assert.strictEqual(rsaAlgToNode(""), "RSA-SHA256");
});
test("ecAlgToNode maps EC algorithms to Node.js hash algorithms", () => {
    assert.strictEqual(ecAlgToNode("ES256"), "SHA256");
    assert.strictEqual(ecAlgToNode("ES384"), "SHA384");
    assert.strictEqual(ecAlgToNode("ES512"), "SHA512");
});
test("ecAlgToNode returns default for unknown algorithms", () => {
    assert.strictEqual(ecAlgToNode("ES1"), "SHA256");
    assert.strictEqual(ecAlgToNode("unknown"), "SHA256");
    assert.strictEqual(ecAlgToNode(""), "SHA256");
});
test("hmacAlgToNode maps HMAC algorithms to Node.js hash algorithm names", () => {
    assert.strictEqual(hmacAlgToNode("HS256"), "sha256");
    assert.strictEqual(hmacAlgToNode("HS384"), "sha384");
    assert.strictEqual(hmacAlgToNode("HS512"), "sha512");
});
test("hmacAlgToNode returns default for unknown algorithms", () => {
    assert.strictEqual(hmacAlgToNode("HS1"), "sha256");
    assert.strictEqual(hmacAlgToNode("unknown"), "sha256");
    assert.strictEqual(hmacAlgToNode(""), "sha256");
});
//# sourceMappingURL=oidc-oauth.test.js.map