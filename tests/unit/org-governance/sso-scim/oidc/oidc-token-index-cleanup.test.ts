import assert from "node:assert/strict";
import test from "node:test";

import { OidcIdentityService, type OidcProviderConfig } from "../../../../../src/org-governance/sso-scim/oidc/index.js";

function createProviderConfig(): OidcProviderConfig {
  return {
    providerId: "test-provider",
    issuer: "https://idp.example.com",
    clientId: "client-id",
    clientSecret: "client-secret",
    redirectUri: "https://app.example.com/callback",
    scopes: ["openid", "profile", "email"],
  };
}

test("OidcIdentityService validates access tokens through the accessToken index", () => {
  const service = new OidcIdentityService(createProviderConfig(), undefined, { allowMockFallback: true });
  service.createSession({
    accessToken: "access-token-1",
    idToken: "id-token-1",
    refreshToken: "refresh-token-1",
    expiresIn: 3600,
    tokenType: "Bearer",
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  }, {
    sub: "user-1",
    email: "user-1@example.com",
  });

  const session = service.validateAccessToken("access-token-1");

  assert.ok(session);
  assert.equal(session.userId, "user-1");
});

test("OidcIdentityService cleanupExpiredSessions immediately revokes expired sessions", () => {
  const service = new OidcIdentityService(createProviderConfig(), undefined, { allowMockFallback: true });
  service.createSession({
    accessToken: "expired-access-token",
    idToken: "expired-id-token",
    refreshToken: "expired-refresh-token",
    expiresIn: -1,
    tokenType: "Bearer",
    expiresAt: new Date(Date.now() - 1_000).toISOString(),
  }, {
    sub: "user-expired",
    email: "expired@example.com",
  });

  const cleaned = service.cleanupExpiredSessions();

  assert.equal(cleaned, 1);
  assert.equal(service.validateAccessToken("expired-access-token"), null);
  assert.equal(service.getSessionCount(), 0);
});
