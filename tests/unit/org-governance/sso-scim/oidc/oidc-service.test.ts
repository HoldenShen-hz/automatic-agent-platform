/**
 * Unit tests for OIDC Service
 * Tests cover specific security issues:
 * - Issue #1969: No PKCE support - auth code flow vulnerable to interception
 * - Issue #1970: userinfo failure falls back to mock admin - privilege escalation
 * - Issue #1971: refresh token not rotated
 * - Issue #1982: Expired session cleanup waits 24h
 */

import assert from "node:assert/strict";
import test from "node:test";

import { OidcIdentityService, InMemoryOidcStateStore, createOidcIdentityService } from "../../../../../src/org-governance/sso-scim/oidc/oidc-service.js";
import type { OidcProviderConfig, OidcSession } from "../../../../../src/org-governance/sso-scim/oidc/index.js";

function createOidcConfig(): OidcProviderConfig {
  return {
    providerId: "test-provider",
    issuer: "https://idp.example.com",
    clientId: "test-client",
    redirectUri: "https://app.example.com/auth/callback",
    scopes: ["openid", "profile", "email"],
  };
}

// ─── Issue #1969: No PKCE support ─────────────────────────────────────────────

test("OidcIdentityService initiateFlow does not include PKCE parameters - demonstrates missing PKCE support", () => {
  const service = new OidcIdentityService(createOidcConfig());
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";

  try {
    const { authorizationUrl } = service.initiateFlow("https://app.example.com/callback");

    // The authorization URL should include code_challenge and code_challenge_method
    // for PKCE support, but currently it does not
    assert.ok(authorizationUrl.includes("client_id=test-client"));
    assert.ok(authorizationUrl.includes("response_type=code"));
    // PKCE parameters are NOT present - this is the bug
    assert.ok(!authorizationUrl.includes("code_challenge"));
    assert.ok(!authorizationUrl.includes("code_challenge_method"));
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

test("OidcIdentityService token exchange does not verify PKCE code_verifier - demonstrates vulnerability", async () => {
  const service = new OidcIdentityService(createOidcConfig());
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";

  try {
    const { state } = service.initiateFlow("https://app.example.com/callback");

    // An attacker who intercepts the authorization code can exchange it
    // without providing a code_verifier because PKCE is not enforced
    const tokens = await service.exchangeCodeForTokens("stolen-auth-code", state);

    // Token exchange succeeds without PKCE verification
    assert.ok(tokens);
    assert.ok(tokens.accessToken);
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

// ─── Issue #1970: userinfo failure falls back to mock admin - privilege escalation ───

test("OidcIdentityService fetchUserInfo falls back to mock admin on network failure - demonstrates privilege escalation", async () => {
  const service = new OidcIdentityService(createOidcConfig());
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";

  try {
    // Simulate network failure by using an unreachable endpoint
    const mockTokens = {
      accessToken: "at_real_access_token",
      idToken: "id_real_id_token",
      refreshToken: "rt_real_refresh_token",
      expiresIn: 3600,
      tokenType: "Bearer" as const,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    };

    // When userInfo endpoint fails, the service falls back to simulating user info
    // This could be exploited if an attacker gets a valid access token
    const userInfo = await service.fetchUserInfo(mockTokens.accessToken);

    // The fallback returns mock admin privileges
    assert.ok(userInfo);
    assert.ok(userInfo.sub);
    // The mock user has admin groups - this is the privilege escalation risk
    assert.ok(userInfo.groups?.includes("admins"));
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

test("OidcIdentityService fetchUserInfo falls back when userInfoEndpoint returns non-OK", async () => {
  const config = createOidcConfig();
  config.userInfoEndpoint = "https://unreachable.example.com/userinfo";
  const service = new OidcIdentityService(config);
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";

  try {
    // Any non-OK response triggers fallback to mock
    const userInfo = await service.fetchUserInfo("any-access-token");

    // Mock fallback is used
    assert.ok(userInfo);
    assert.equal(userInfo.email, "user@example.com");
    assert.ok(userInfo.groups?.includes("admins"));
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

// ─── Issue #1971: refresh token not rotated ────────────────────────────────────

test("OidcIdentityService refreshAccessToken does not rotate refresh token - demonstrates token reuse vulnerability", async () => {
  const service = new OidcIdentityService(createOidcConfig());
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";

  try {
    // Create a session with a known refresh token
    const { state } = service.initiateFlow("https://app.example.com/callback");
    const tokens = await service.exchangeCodeForTokens("auth-code", state);
    const userInfo = await service.fetchUserInfo(tokens!.accessToken);
    const session = service.createSession(tokens!, userInfo!);

    const originalRefreshToken = session.refreshToken;
    assert.ok(originalRefreshToken);

    // Refresh the session
    const newTokens = await service.refreshAccessToken(session.sessionId);

    assert.ok(newTokens);
    // The refresh token should be rotated (new value) but it is NOT
    // This is the bug - refresh token reuse is possible
    assert.strictEqual(newTokens.refreshToken, originalRefreshToken);
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

test("OidcIdentityService refreshAccessToken returns same refresh token on multiple refreshes", async () => {
  const service = new OidcIdentityService(createOidcConfig());
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";

  try {
    const { state } = service.initiateFlow("https://app.example.com/callback");
    const tokens = await service.exchangeCodeForTokens("auth-code", state);
    const userInfo = await service.fetchUserInfo(tokens!.accessToken);
    const session = service.createSession(tokens!, userInfo!);

    // First refresh
    const newTokens1 = await service.refreshAccessToken(session.sessionId);
    // Second refresh
    const newTokens2 = await service.refreshAccessToken(session.sessionId);

    // Both return the same refresh token - no rotation
    assert.strictEqual(newTokens1.refreshToken, newTokens2.refreshToken);
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

// ─── Issue #1982: Expired session cleanup waits 24h ────────────────────────────

test("OidcIdentityService cleanupExpiredSessions uses 24h maxSessionAgeMs - cleanup delay issue", () => {
  const service = new OidcIdentityService(createOidcConfig());
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";

  try {
    // The default maxSessionAgeMs is 86400000 (24 hours)
    // Sessions that expired 23 hours ago won't be cleaned up
    // because cleanup only removes sessions older than maxSessionAgeMs
    const sessionTtlMs = 3600000; // 1 hour
    const maxSessionAgeMs = 86400000; // 24 hours (default)

    // Create a session that expired 23 hours ago
    const sessionId = "test-session";
    const expired23hAgo = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
    const recentActivity = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();

    // Manually inject an "expired" session
    (service as unknown as { sessions: Map<string, { sessionId: string; userId: string; accessToken: string; refreshToken?: string; idToken: string; expiresAt: string; createdAt: string; lastActivityAt: string; providerId: string }> }).sessions.set(sessionId, {
      sessionId,
      userId: "user-1",
      accessToken: "expired-token",
      idToken: "expired-id-token",
      expiresAt: expired23hAgo, // expired 23 hours ago
      createdAt: recentActivity,
      lastActivityAt: recentActivity,
      providerId: "test-provider",
    });

    // Cleanup should not remove this session (only 23h old, not 24h)
    const cleaned = service.cleanupExpiredSessions();

    // The session is NOT cleaned up because it hasn't exceeded 24h
    assert.equal(cleaned, 0);

    // Session is still present
    assert.ok(service.validateAccessToken("expired-token"));
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

test("OidcIdentityService cleanupExpiredSessions removes sessions older than maxSessionAgeMs", () => {
  const service = new OidcIdentityService(createOidcConfig());
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";

  try {
    // Inject a session that expired 25 hours ago (> 24h maxSessionAgeMs)
    const sessionId = "old-session";
    const expired25hAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const oldActivity = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

    (service as unknown as { sessions: Map<string, { sessionId: string; userId: string; accessToken: string; refreshToken?: string; idToken: string; expiresAt: string; createdAt: string; lastActivityAt: string; providerId: string }> }).sessions.set(sessionId, {
      sessionId,
      userId: "user-old",
      accessToken: "old-token",
      idToken: "old-id-token",
      expiresAt: expired25hAgo,
      createdAt: oldActivity,
      lastActivityAt: oldActivity,
      providerId: "test-provider",
    });

    const cleaned = service.cleanupExpiredSessions();

    // Session is now cleaned up because it exceeded 24h
    assert.equal(cleaned, 1);
    assert.equal(service.validateAccessToken("old-token"), null);
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

// ─── Additional security tests ──────────────────────────────────────────────────

test("OidcIdentityService validateAccessToken rejects tokens in NODE_ENV production", () => {
  const service = new OidcIdentityService(createOidcConfig());
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  try {
    // Mock tokens with at_, id_, rt_ prefixes should be rejected in production
    assert.throws(() => {
      service.validateAccessToken("at_mock_token");
    }, /Production Hardening/);
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

test("InMemoryOidcStateStore saves and retrieves state", () => {
  const store = new InMemoryOidcStateStore();

  store.saveState("state-123", "nonce-456", "https://app.example.com/callback");

  const retrieved = store.getState("state-123");
  assert.ok(retrieved);
  assert.equal(retrieved.nonce, "nonce-456");
  assert.equal(retrieved.redirectUri, "https://app.example.com/callback");
});

test("InMemoryOidcStateStore returns null for expired state", () => {
  const store = new InMemoryOidcStateStore();
  const originalDateNow = Date.now;

  // Mock Date.now to simulate time passing beyond 10 minute expiry
  Date.now = () => originalDateNow() + 11 * 60 * 1000;

  try {
    store.saveState("state-expired", "nonce", "https://app.example.com/callback");
    const retrieved = store.getState("state-expired");

    // State should be expired and deleted
    assert.equal(retrieved, null);
  } finally {
    Date.now = originalDateNow;
  }
});

test("InMemoryOidcStateStore deletes state after retrieval", () => {
  const store = new InMemoryOidcStateStore();

  store.saveState("state-to-delete", "nonce", "https://app.example.com/callback");
  store.getState("state-to-delete");

  // State should be deleted after first retrieval
  assert.equal(store.getState("state-to-delete"), null);
});

test("createOidcIdentityService factory creates service with default config", () => {
  const service = createOidcIdentityService(createOidcConfig());

  const { authorizationUrl } = service.initiateFlow("https://app.example.com/callback");
  assert.ok(authorizationUrl.includes("https://idp.example.com/authorize"));
});

test("createOidcIdentityService factory allows custom config override", () => {
  const service = createOidcIdentityService(createOidcConfig(), undefined, {
    sessionTtlMs: 7200000,
    allowMockFallback: true,
  });

  const { authorizationUrl } = service.initiateFlow("https://app.example.com/callback");
  assert.ok(authorizationUrl.includes("https://idp.example.com/authorize"));
});

test("OidcIdentityService revokeAllUserSessions removes all sessions", async () => {
  const service = new OidcIdentityService(createOidcConfig());
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";

  try {
    const { state: state1 } = service.initiateFlow("https://app.example.com/callback");
    const { state: state2 } = service.initiateFlow("https://app.example.com/callback");
    const tokens1 = await service.exchangeCodeForTokens("auth-code-1", state1);
    const tokens2 = await service.exchangeCodeForTokens("auth-code-2", state2);
    const userInfo1 = await service.fetchUserInfo(tokens1!.accessToken);
    const userInfo2 = await service.fetchUserInfo(tokens2!.accessToken);
    service.createSession(tokens1!, userInfo1!);
    service.createSession(tokens2!, userInfo1!); // Same user

    const count = service.revokeAllUserSessions(userInfo1!.sub);

    assert.equal(count, 2);
    assert.equal(service.getSessionCount(), 0);
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

test("OidcIdentityService getUserSessions returns active sessions only", async () => {
  const service = new OidcIdentityService(createOidcConfig());
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";

  try {
    const { state } = service.initiateFlow("https://app.example.com/callback");
    const tokens = await service.exchangeCodeForTokens("auth-code", state);
    const userInfo = await service.fetchUserInfo(tokens!.accessToken);
    const session = service.createSession(tokens!, userInfo!);

    const sessions = service.getUserSessions(userInfo!.sub);
    assert.ok(sessions.length >= 1);
    assert.ok(sessions.some(s => s.sessionId === session.sessionId));
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

test("OidcIdentityService touchSession updates lastActivityAt", async () => {
  const service = new OidcIdentityService(createOidcConfig());
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";

  try {
    const { state } = service.initiateFlow("https://app.example.com/callback");
    const tokens = await service.exchangeCodeForTokens("auth-code", state);
    const userInfo = await service.fetchUserInfo(tokens!.accessToken);
    const session = service.createSession(tokens!, userInfo!);

    const beforeTouch = service.getUserSessions(userInfo!.sub)[0]?.lastActivityAt;
    service.touchSession(session.sessionId);
    const afterTouch = service.getUserSessions(userInfo!.sub)[0]?.lastActivityAt;

    assert.ok(afterTouch);
    assert.ok(afterTouch >= beforeTouch);
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});
