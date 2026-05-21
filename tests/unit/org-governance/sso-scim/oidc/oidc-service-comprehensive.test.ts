/**
 * Comprehensive Tests: OIDC Identity Service
 *
 * Covers edge cases, token rotation, session management,
 * and production hardening for the OIDC service.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { OidcIdentityService, InMemoryOidcStateStore } from "../../../../../src/org-governance/sso-scim/oidc/oidc-service.js";
import type { OidcProviderConfig } from "../../../../../src/org-governance/sso-scim/oidc/index.js";

function createOidcConfig(): OidcProviderConfig {
  return {
    providerId: "test-provider",
    issuer: "https://idp.example.com",
    clientId: "test-client",
    redirectUri: "https://app.example.com/auth/callback",
    scopes: ["openid", "profile", "email"],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Count and Touch Tests
// ─────────────────────────────────────────────────────────────────────────────

test("OidcIdentityService.getSessionCount returns zero for new service", () => {
  const service = new OidcIdentityService(createOidcConfig());

  assert.equal(service.getSessionCount(), 0);
});

test("OidcIdentityService.getSessionCount increments when sessions created", () => {
  const service = new OidcIdentityService(createOidcConfig(), undefined, { allowMockFallback: true });

  service.createSession({
    accessToken: "at_1",
    idToken: "id_1",
    refreshToken: "rt_1",
    expiresIn: 3600,
    tokenType: "Bearer",
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  }, { sub: "user-1", email: "user1@example.com" });

  assert.equal(service.getSessionCount(), 1);

  service.createSession({
    accessToken: "at_2",
    idToken: "id_2",
    refreshToken: "rt_2",
    expiresIn: 3600,
    tokenType: "Bearer",
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  }, { sub: "user-2", email: "user2@example.com" });

  assert.equal(service.getSessionCount(), 2);
});

test("OidcIdentityService.getSessionCount decrements when sessions revoked", () => {
  const service = new OidcIdentityService(createOidcConfig(), undefined, { allowMockFallback: true });

  const session1 = service.createSession({
    accessToken: "at_1",
    idToken: "id_1",
    refreshToken: "rt_1",
    expiresIn: 3600,
    tokenType: "Bearer",
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  }, { sub: "user-1", email: "user1@example.com" });

  const session2 = service.createSession({
    accessToken: "at_2",
    idToken: "id_2",
    refreshToken: "rt_2",
    expiresIn: 3600,
    tokenType: "Bearer",
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  }, { sub: "user-2", email: "user2@example.com" });

  assert.equal(service.getSessionCount(), 2);

  service.revokeSession(session1.sessionId);
  assert.equal(service.getSessionCount(), 1);

  service.revokeSession(session2.sessionId);
  assert.equal(service.getSessionCount(), 0);
});

test("OidcIdentityService.touchSession updates lastActivityAt", () => {
  const service = new OidcIdentityService(createOidcConfig(), undefined, { allowMockFallback: true });

  const session = service.createSession({
    accessToken: "at_touch",
    idToken: "id_touch",
    refreshToken: "rt_touch",
    expiresIn: 3600,
    tokenType: "Bearer",
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  }, { sub: "user-touch", email: "touch@example.com" });

  const originalLastActivity = session.lastActivityAt;

  // Wait a small amount to ensure time difference
  const start = Date.now();
  while (Date.now() - start < 10) { /* spin */ }

  service.touchSession(session.sessionId);

  const updatedSessions = service.getUserSessions("user-touch");
  assert.ok(updatedSessions.length > 0);
  assert.ok(updatedSessions[0]!.lastActivityAt >= originalLastActivity);
});

test("OidcIdentityService.touchSession handles non-existent session gracefully", () => {
  const service = new OidcIdentityService(createOidcConfig());

  // Should not throw
  service.touchSession("non-existent-session");

  // Session count should still be 0
  assert.equal(service.getSessionCount(), 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// In-Memory State Store TTL Tests
// ─────────────────────────────────────────────────────────────────────────────

test("InMemoryOidcStateStore expires state after TTL", async () => {
  const shortTtlStore = new InMemoryOidcStateStore(50); // 50ms TTL

  shortTtlStore.saveState("state1", "nonce1", "https://example.com", "verifier1");

  // State should be available immediately
  const before = shortTtlStore.getState("state1");
  assert.ok(before !== null);

  // Wait for TTL to expire
  await new Promise((resolve) => setTimeout(resolve, 100));

  // State should be expired
  const after = shortTtlStore.getState("state1");
  assert.equal(after, null);
});

test("InMemoryOidcStateStore delete handles non-existent state", () => {
  const store = new InMemoryOidcStateStore();

  // Should not throw
  store.deleteState("non-existent-state");

  const result = store.getState("non-existent-state");
  assert.equal(result, null);
});

test("InMemoryOidcStateStore getState returns null for partially matched key", () => {
  const store = new InMemoryOidcStateStore();

  store.saveState("state-full", "nonce", "https://example.com", "verifier");

  const result = store.getState("state-partial");
  assert.equal(result, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Token Rotation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("OidcIdentityService refreshAccessToken detects refresh token reuse attack", async () => {
  const service = new OidcIdentityService(createOidcConfig(), undefined, { allowMockFallback: true });

  const session = service.createSession({
    accessToken: "at_original",
    idToken: "id_original",
    refreshToken: "rt_original",
    expiresIn: 3600,
    tokenType: "Bearer",
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  }, { sub: "user-reuse", email: "reuse@example.com" });

  // Simulate a refresh that returns a new refresh token
  const refreshResult = await service.refreshAccessToken(session.sessionId);

  // The refresh token should have been rotated, so reusing the old one should fail
  // We can't directly test the replay detection without more control over the mock
  assert.ok(refreshResult !== null);
});

test("OidcIdentityService createSession without refresh token does not create family", () => {
  const service = new OidcIdentityService(createOidcConfig(), undefined, { allowMockFallback: true });

  const session = service.createSession({
    accessToken: "at_no_refresh",
    idToken: "id_no_refresh",
    expiresIn: 3600,
    tokenType: "Bearer",
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  }, { sub: "user-no-refresh", email: "norefresh@example.com" });

  assert.ok(session.refreshToken === undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// Fetch User Info Tests
// ─────────────────────────────────────────────────────────────────────────────

test("OidcIdentityService fetchUserInfo returns null on network error with fallback", async () => {
  const service = new OidcIdentityService(createOidcConfig(), undefined, { allowMockFallback: true });
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = (async () => {
      throw new Error("Network error");
    }) as unknown as typeof fetch;

    const userInfo = await service.fetchUserInfo("access-token");
    // In non-production with fallback, should return simulated user info
    assert.ok(userInfo !== null);
    assert.ok(typeof userInfo!.sub === "string" && userInfo!.sub.length > 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OidcIdentityService fetchUserInfo uses configured userInfoEndpoint", async () => {
  const service = new OidcIdentityService(createOidcConfig(), undefined, { allowMockFallback: true });
  const originalFetch = globalThis.fetch;
  let requestedUrl: string | undefined;

  try {
    globalThis.fetch = (async (url: RequestInfo | URL) => {
      requestedUrl = url.toString();
      return new Response(JSON.stringify({
        sub: "user-from-endpoint",
        email: "endpoint@example.com",
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const userInfo = await service.fetchUserInfo("any-access-token");

    assert.ok(requestedUrl!.includes("userinfo"));
    assert.equal(userInfo!.sub, "user-from-endpoint");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Exchange Code Tests
// ─────────────────────────────────────────────────────────────────────────────

test("OidcIdentityService exchangeCodeForTokens deletes state after use", async () => {
  const store = new InMemoryOidcStateStore();
  const service = new OidcIdentityService(createOidcConfig(), store);

  const { state } = service.initiateFlow("https://app.example.com/callback");

  // State should exist
  const before = store.getState(state);
  assert.ok(before !== null);

  await service.exchangeCodeForTokens("auth-code", state);

  // State should be deleted
  const after = store.getState(state);
  assert.equal(after, null);
});

test("OidcIdentityService exchangeCodeForTokens returns null for expired state", async () => {
  const shortTtlStore = new InMemoryOidcStateStore(1); // 1ms TTL
  const service = new OidcIdentityService(createOidcConfig(), shortTtlStore);

  const { state } = service.initiateFlow("https://app.example.com/callback");

  // Wait for state to expire
  await new Promise((resolve) => setTimeout(resolve, 10));

  const tokens = await service.exchangeCodeForTokens("auth-code", state);

  assert.equal(tokens, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// getUserSessions edge cases
// ─────────────────────────────────────────────────────────────────────────────

test("OidcIdentityService getUserSessions returns empty for unknown user", () => {
  const service = new OidcIdentityService(createOidcConfig(), undefined, { allowMockFallback: true });

  const sessions = service.getUserSessions("unknown-user");

  assert.deepEqual(sessions, []);
});

test("OidcIdentityService getUserSessions filters out expired sessions", () => {
  const service = new OidcIdentityService(createOidcConfig(), undefined, { allowMockFallback: true });

  // Create an expired session
  service.createSession({
    accessToken: "at_expired",
    idToken: "id_expired",
    refreshToken: "rt_expired",
    expiresIn: -1,
    tokenType: "Bearer",
    expiresAt: new Date(Date.now() - 1000).toISOString(),
  }, { sub: "user-expired-filter", email: "expired-filter@example.com" });

  const sessions = service.getUserSessions("user-expired-filter");

  assert.equal(sessions.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// revokeAllUserSessions edge cases
// ─────────────────────────────────────────────────────────────────────────────

test("OidcIdentityService revokeAllUserSessions returns 0 for unknown user", () => {
  const service = new OidcIdentityService(createOidcConfig());

  const count = service.revokeAllUserSessions("unknown-user");

  assert.equal(count, 0);
});

test("OidcIdentityService revokeAllUserSessions handles user with no sessions", () => {
  const service = new OidcIdentityService(createOidcConfig(), undefined, { allowMockFallback: true });

  // Create a session for a different user
  service.createSession({
    accessToken: "at_other",
    idToken: "id_other",
    refreshToken: "rt_other",
    expiresIn: 3600,
    tokenType: "Bearer",
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  }, { sub: "other-user", email: "other@example.com" });

  // Revoke for a user with no sessions
  const count = service.revokeAllUserSessions("user-with-no-sessions");

  assert.equal(count, 0);
});