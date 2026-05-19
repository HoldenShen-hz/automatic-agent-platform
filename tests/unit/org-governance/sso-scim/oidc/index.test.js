import assert from "node:assert/strict";
import test from "node:test";
import { OidcProviderConfigSchema, buildOidcAuthorizationUrl, } from "../../../../../src/org-governance/sso-scim/oidc/index.js";
test("OidcProviderConfigSchema validates complete valid config", () => {
    const validConfig = {
        providerId: "provider-1",
        issuer: "https://idp.example.com",
        clientId: "client-id",
        redirectUri: "https://app.example.com/callback",
        scopes: ["openid", "profile", "email"],
    };
    const result = OidcProviderConfigSchema.safeParse(validConfig);
    assert.strictEqual(result.success, true);
});
test("OidcProviderConfigSchema applies default scopes", () => {
    const minimalConfig = {
        providerId: "provider-1",
        issuer: "https://idp.example.com",
        clientId: "client-id",
        redirectUri: "https://app.example.com/callback",
    };
    const result = OidcProviderConfigSchema.safeParse(minimalConfig);
    assert.strictEqual(result.success, true);
    if (result.success) {
        assert.deepStrictEqual(result.data.scopes, ["openid", "profile", "email"]);
    }
});
test("OidcProviderConfigSchema rejects empty providerId", () => {
    const invalidConfig = {
        providerId: "",
        issuer: "https://idp.example.com",
        clientId: "client-id",
        redirectUri: "https://app.example.com/callback",
    };
    const result = OidcProviderConfigSchema.safeParse(invalidConfig);
    assert.strictEqual(result.success, false);
});
test("OidcProviderConfigSchema rejects empty issuer", () => {
    const invalidConfig = {
        providerId: "provider-1",
        issuer: "",
        clientId: "client-id",
        redirectUri: "https://app.example.com/callback",
    };
    const result = OidcProviderConfigSchema.safeParse(invalidConfig);
    assert.strictEqual(result.success, false);
});
test("OidcProviderConfigSchema accepts optional clientSecret", () => {
    const configWithSecret = {
        providerId: "provider-1",
        issuer: "https://idp.example.com",
        clientId: "client-id",
        clientSecret: "secret-value",
        redirectUri: "https://app.example.com/callback",
    };
    const result = OidcProviderConfigSchema.safeParse(configWithSecret);
    assert.strictEqual(result.success, true);
});
test("OidcProviderConfigSchema accepts optional authorizationEndpoint", () => {
    const configWithAuthzEndpoint = {
        providerId: "provider-1",
        issuer: "https://idp.example.com",
        clientId: "client-id",
        redirectUri: "https://app.example.com/callback",
        authorizationEndpoint: "https://custom.idp.example.com/authorize",
    };
    const result = OidcProviderConfigSchema.safeParse(configWithAuthzEndpoint);
    assert.strictEqual(result.success, true);
});
test("OidcProviderConfigSchema accepts optional tokenEndpoint", () => {
    const configWithTokenEndpoint = {
        providerId: "provider-1",
        issuer: "https://idp.example.com",
        clientId: "client-id",
        redirectUri: "https://app.example.com/callback",
        tokenEndpoint: "https://custom.idp.example.com/token",
    };
    const result = OidcProviderConfigSchema.safeParse(configWithTokenEndpoint);
    assert.strictEqual(result.success, true);
});
test("OidcProviderConfigSchema accepts optional userInfoEndpoint", () => {
    const configWithUserInfoEndpoint = {
        providerId: "provider-1",
        issuer: "https://idp.example.com",
        clientId: "client-id",
        redirectUri: "https://app.example.com/callback",
        userInfoEndpoint: "https://custom.idp.example.com/userinfo",
    };
    const result = OidcProviderConfigSchema.safeParse(configWithUserInfoEndpoint);
    assert.strictEqual(result.success, true);
});
test("buildOidcAuthorizationUrl constructs valid authorization URL", () => {
    const config = {
        providerId: "test-provider",
        issuer: "https://idp.example.com",
        clientId: "test-client-id",
        redirectUri: "https://app.example.com/auth/callback",
        scopes: ["openid", "profile"],
    };
    const url = buildOidcAuthorizationUrl(config, "state-123");
    assert.ok(url.includes("https://idp.example.com/authorize"));
    assert.ok(url.includes("client_id=test-client-id"));
    assert.ok(url.includes("redirect_uri=https%3A%2F%2Fapp.example.com%2Fauth%2Fcallback"));
    assert.ok(url.includes("response_type=code"));
    // Scopes are encoded: spaces become %20 or +
    assert.ok(url.includes("scope=openid") && url.includes("profile"));
    assert.ok(url.includes("state=state-123"));
});
test("buildOidcAuthorizationUrl uses custom authorizationEndpoint when provided", () => {
    const config = {
        providerId: "test-provider",
        issuer: "https://idp.example.com",
        clientId: "test-client-id",
        redirectUri: "https://app.example.com/auth/callback",
        authorizationEndpoint: "https://custom.idp.example.com/oauth/authorize",
        scopes: ["openid"],
    };
    const url = buildOidcAuthorizationUrl(config, "custom-state");
    assert.ok(url.includes("https://custom.idp.example.com/oauth/authorize"));
});
test("buildOidcAuthorizationUrl encodes state parameter properly", () => {
    const config = {
        providerId: "test-provider",
        issuer: "https://idp.example.com",
        clientId: "test-client-id",
        redirectUri: "https://app.example.com/auth/callback",
        scopes: ["openid"],
    };
    const url = buildOidcAuthorizationUrl(config, "state-with-special-chars-!@#$");
    assert.ok(url.includes("state=state-with-special-chars-!%40%23%24"));
});
//# sourceMappingURL=index.test.js.map