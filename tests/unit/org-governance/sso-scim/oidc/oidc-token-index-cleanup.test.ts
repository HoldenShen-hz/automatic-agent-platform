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

test("OidcIdentityService cleanupExpiredSessions does not remove active sessions", () => {
  const service = new OidcIdentityService(createProviderConfig(), undefined, { allowMockFallback: true });
  service.createSession({
    accessToken: "active-access-token",
    idToken: "active-id-token",
    refreshToken: "active-refresh-token",
    expiresIn: 3600,
    tokenType: "Bearer",
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  }, {
    sub: "user-active",
    email: "active@example.com",
  });

  const cleaned = service.cleanupExpiredSessions();

  assert.equal(cleaned, 0);
  assert.ok(service.validateAccessToken("active-access-token"));
  assert.equal(service.getSessionCount(), 1);
});

test("OidcIdentityService cleanupExpiredSessions cleans up sessions expired just 1ms ago", () => {
  const service = new OidcIdentityService(createProviderConfig(), undefined, { allowMockFallback: true });
  service.createSession({
    accessToken: "barely-expired-token",
    idToken: "barely-expired-id-token",
    refreshToken: "barely-expired-refresh-token",
    expiresIn: -1,
    tokenType: "Bearer",
    expiresAt: new Date(Date.now() - 1).toISOString(),
  }, {
    sub: "user-barely-expired",
    email: "barely@example.com",
  });

  const cleaned = service.cleanupExpiredSessions();

  // This would fail with the old buggy code that added maxSessionAgeMs (24h) extra delay
  assert.equal(cleaned, 1);
  assert.equal(service.validateAccessToken("barely-expired-token"), null);
  assert.equal(service.getSessionCount(), 0);
});

test("OidcIdentityService cleanupExpiredSessions cleans up sessions expired days ago", () => {
  const service = new OidcIdentityService(createProviderConfig(), undefined, { allowMockFallback: true });
  const daysAgo = 7 * 24 * 60 * 60 * 1000; // 7 days ago
  service.createSession({
    accessToken: "ancient-expired-token",
    idToken: "ancient-expired-id-token",
    refreshToken: "ancient-expired-refresh-token",
    expiresIn: -1,
    tokenType: "Bearer",
    expiresAt: new Date(Date.now() - daysAgo).toISOString(),
  }, {
    sub: "user-ancient",
    email: "ancient@example.com",
  });

  const cleaned = service.cleanupExpiredSessions();

  // Old code added 24h extra delay, so sessions expired < 24h would not be cleaned
  assert.equal(cleaned, 1);
  assert.equal(service.validateAccessToken("ancient-expired-token"), null);
  assert.equal(service.getSessionCount(), 0);
});
