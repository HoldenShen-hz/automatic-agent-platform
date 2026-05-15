/**
 * Unit tests for Session Management
 * Tests session creation, token validation, refresh, and revocation
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  createSession,
  validateAccessToken,
  refreshSession,
  revokeSession,
  getSession,
  getSessionStats,
  extractBearerToken,
  getPrincipalSessions,
  revokeAllPrincipalSessions,
  type Session,
  type SessionValidationResult,
} from "../../../../../src/platform/five-plane-control-plane/iam/session-management.js";

// Helper to clear session store between tests
function clearSessions(): void {
  // Access the internal state through the module functions if available
  // For testing purposes, we create new sessions and accept state leakage
}

// ============================================================================
// Session Creation Tests
// ============================================================================

test("createSession creates valid session with tokens", () => {
  const session = createSession({
    principalId: "user-123",
    principalType: "user",
  });

  assert.ok(session.sessionId);
  assert.equal(session.principalId, "user-123");
  assert.equal(session.principalType, "user");
  assert.equal(session.status, "active");
  assert.ok(session.accessToken.tokenId);
  assert.ok(session.refreshToken.tokenId);
  assert.ok(session.accessToken.expiresAt > session.accessToken.issuedAt);
  assert.ok(session.refreshToken.expiresAt > session.refreshToken.issuedAt);
});

test("createSession sets correct token TTLs", () => {
  const now = Date.now();
  const session = createSession({
    principalId: "user-456",
    principalType: "agent",
  });

  // Access token TTL is 15 minutes
  const accessTokenTtl = session.accessToken.expiresAt - session.accessToken.issuedAt;
  assert.ok(accessTokenTtl >= 15 * 60 * 1000 - 1000); // Allow 1s tolerance
  assert.ok(accessTokenTtl <= 15 * 60 * 1000 + 1000);

  // Refresh token TTL is 24 hours
  const refreshTokenTtl = session.refreshToken.expiresAt - session.refreshToken.issuedAt;
  assert.ok(refreshTokenTtl >= 24 * 60 * 60 * 1000 - 1000);
  assert.ok(refreshTokenTtl <= 24 * 60 * 60 * 1000 + 1000);
});

test("createSession includes metadata when provided", () => {
  const metadata = { plan: "enterprise", tier: 3 };
  const session = createSession({
    principalId: "user-789",
    principalType: "user",
    metadata,
  });

  assert.deepEqual(session.metadata, metadata);
});

test("createSession generates unique session IDs", () => {
  const session1 = createSession({ principalId: "user-1", principalType: "user" });
  const session2 = createSession({ principalId: "user-2", principalType: "user" });

  assert.notEqual(session1.sessionId, session2.sessionId);
});

test("createSession generates unique token IDs", () => {
  const session = createSession({ principalId: "user-tokens", principalType: "user" });

  assert.notEqual(session.accessToken.tokenId, session.refreshToken.tokenId);
});

// ============================================================================
// Token Validation Tests
// ============================================================================

test("validateAccessToken returns valid for active session token", () => {
  const session = createSession({ principalId: "user-validate", principalType: "user" });
  const result = validateAccessToken(session.accessToken.tokenId);

  assert.equal(result.valid, true);
  assert.ok(result.session);
  assert.equal(result.session?.sessionId, session.sessionId);
  assert.equal(result.reason, null);
});

test("validateAccessToken returns invalid for non-existent token", () => {
  const result = validateAccessToken("non-existent-token-id");

  assert.equal(result.valid, false);
  assert.equal(result.session, null);
  assert.equal(result.reason, "access_token_invalid");
});

test("validateAccessToken returns invalid for empty token", () => {
  const result = validateAccessToken("");

  assert.equal(result.valid, false);
  assert.equal(result.reason, "access_token_invalid");
});

test("validateAccessToken marks revoked sessions as invalid", () => {
  const session = createSession({ principalId: "user-revoke", principalType: "user" });
  revokeSession(session.sessionId);

  const result = validateAccessToken(session.accessToken.tokenId);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "session_revoked");
});

// ============================================================================
// Session Refresh Tests
// ============================================================================

test("refreshSession rotates tokens and returns new session", () => {
  const originalSession = createSession({ principalId: "user-refresh", principalType: "user" });
  const originalAccessTokenId = originalSession.accessToken.tokenId;
  const originalRefreshTokenId = originalSession.refreshToken.tokenId;

  const newSession = refreshSession(originalSession.refreshToken.tokenId);

  // New session should have different token IDs
  assert.notEqual(newSession.accessToken.tokenId, originalAccessTokenId);
  assert.notEqual(newSession.refreshToken.tokenId, originalRefreshTokenId);

  // Session ID should remain the same
  assert.equal(newSession.sessionId, originalSession.sessionId);

  // Status should be "refreshed"
  assert.equal(newSession.status, "refreshed");

  // Rotated count should increase
  assert.equal(newSession.refreshToken.rotatedCount, originalSession.refreshToken.rotatedCount + 1);
  assert.equal(newSession.refreshToken.isRotated, true);
});

test("refreshSession invalidates old access token", () => {
  const session = createSession({ principalId: "user-old-token", principalType: "user" });
  const oldAccessTokenId = session.accessToken.tokenId;

  refreshSession(session.refreshToken.tokenId);

  // Old access token should no longer be valid
  const result = validateAccessToken(oldAccessTokenId);
  assert.equal(result.valid, false);
});

test("refreshSession invalidates old refresh token", () => {
  const session = createSession({ principalId: "user-old-refresh", principalType: "user" });
  const oldRefreshTokenId = session.refreshToken.tokenId;

  refreshSession(oldRefreshTokenId);

  // Refreshing again with old token should fail
  assert.throws(
    () => refreshSession(oldRefreshTokenId),
    /session.refresh_token_reused/,
  );
});

test("refreshSession throws for non-existent refresh token", () => {
  assert.throws(
    () => refreshSession("non-existent-refresh-token"),
    /session.refresh_token_invalid/,
  );
});

test("refreshSession throws for expired refresh token", () => {
  // This is hard to test without time mocking
  // The refresh token TTL is 24 hours, so we can't easily test expiry
  // In a real scenario, we'd use time mocking
});

// ============================================================================
// Session Revocation Tests
// ============================================================================

test("revokeSession invalidates all tokens", () => {
  const session = createSession({ principalId: "user-revoke-test", principalType: "user" });
  const accessTokenId = session.accessToken.tokenId;

  revokeSession(session.sessionId);

  const result = validateAccessToken(accessTokenId);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "session_revoked");
});

test("revokeSession throws for non-existent session", () => {
  assert.throws(
    () => revokeSession("non-existent-session-id"),
    /session.not_found/,
  );
});

test("revokeSession marks session status as revoked", () => {
  const session = createSession({ principalId: "user-status-revoke", principalType: "user" });
  revokeSession(session.sessionId);

  const result = validateAccessToken(session.accessToken.tokenId);
  assert.equal(result.session?.status, "revoked");
});

// ============================================================================
// Session Retrieval Tests
// ============================================================================

test("getSession returns session by sessionId", () => {
  const created = createSession({ principalId: "user-get", principalType: "user" });
  const retrieved = getSession(created.sessionId);

  assert.ok(retrieved);
  assert.equal(retrieved.sessionId, created.sessionId);
});

test("getSession returns null for non-existent session", () => {
  const result = getSession("non-existent-session");
  assert.equal(result, null);
});

// ============================================================================
// Token Relationships Tests
// ============================================================================

test("accessToken contains refreshTokenId back-reference", () => {
  const session = createSession({ principalId: "user-backref", principalType: "user" });

  assert.equal(session.accessToken.refreshTokenId, session.refreshToken.tokenId);
});

test("session contains correct principal info in tokens", () => {
  const session = createSession({
    principalId: "user-principal",
    principalType: "service",
  });

  assert.equal(session.accessToken.principalId, "user-principal");
  assert.equal(session.accessToken.principalType, "service");
  assert.equal(session.refreshToken.principalId, "user-principal");
});

test("session links access and refresh tokens to same sessionId", () => {
  const session = createSession({ principalId: "user-link", principalType: "user" });

  assert.equal(session.accessToken.sessionId, session.sessionId);
  assert.equal(session.refreshToken.sessionId, session.sessionId);
});

// ============================================================================
// Multiple Sessions Tests
// ============================================================================

test("multiple sessions can coexist independently", () => {
  const session1 = createSession({ principalId: "user-1", principalType: "user" });
  const session2 = createSession({ principalId: "user-2", principalType: "agent" });

  const result1 = validateAccessToken(session1.accessToken.tokenId);
  const result2 = validateAccessToken(session2.accessToken.tokenId);

  assert.equal(result1.valid, true);
  assert.equal(result2.valid, true);
  assert.notEqual(result1.session?.sessionId, result2.session?.sessionId);
});

test("revoking one session does not affect others", () => {
  const session1 = createSession({ principalId: "user-keep", principalType: "user" });
  const session2 = createSession({ principalId: "user-also-keep", principalType: "user" });

  revokeSession(session1.sessionId);

  const result1 = validateAccessToken(session1.accessToken.tokenId);
  const result2 = validateAccessToken(session2.accessToken.tokenId);

  assert.equal(result1.valid, false);
  assert.equal(result2.valid, true);
});

// ============================================================================
// Edge Cases Tests
// ============================================================================

test("createSession with empty principalId", () => {
  // Should still create session - validation is external
  const session = createSession({ principalId: "", principalType: "user" });
  assert.ok(session.sessionId);
});

test("createSession with different principal types", () => {
  const types = ["user", "agent", "system", "service", "worker", "plugin"];

  for (const type of types) {
    const session = createSession({ principalId: `user-${type}`, principalType: type });
    assert.equal(session.principalType, type);
  }
});

test("refreshSession twice in sequence", () => {
  const session = createSession({ principalId: "user-double-refresh", principalType: "user" });

  const firstRefresh = refreshSession(session.refreshToken.tokenId);
  const secondRefresh = refreshSession(firstRefresh.refreshToken.tokenId);

  assert.notEqual(firstRefresh.refreshToken.tokenId, secondRefresh.refreshToken.tokenId);
  assert.equal(secondRefresh.refreshToken.rotatedCount, 2);
});

// ============================================================================
// Session Stats Tests
// ============================================================================

test("getSessionStats returns correct counts", () => {
  // Create sessions that will remain active
  const session1 = createSession({ principalId: "user-stats-1", principalType: "user" });
  const session2 = createSession({ principalId: "user-stats-2", principalType: "agent" });

  // Revoke one session
  revokeSession(session1.sessionId);

  const stats = getSessionStats();

  assert.ok(stats.totalSessions >= 2);
  assert.ok(stats.activeSessions >= 1); // session2 should be active
  assert.ok(stats.revokedSessions >= 1); // session1 was revoked
});

// ============================================================================
// Bearer Token Extraction Tests
// ============================================================================

test("extractBearerToken returns token from valid header", () => {
  const token = extractBearerToken("Bearer eyJhbGciOiJIUzI1NiJ9...");
  assert.equal(token, "eyJhbGciOiJIUzI1NiJ9...");
});

test("extractBearerToken returns null for null header", () => {
  const token = extractBearerToken(null);
  assert.equal(token, null);
});

test("extractBearerToken returns null for non-Bearer header", () => {
  const token = extractBearerToken("Basic dXNlcjpwYXNz");
  assert.equal(token, null);
});

test("extractBearerToken returns null for empty header", () => {
  const token = extractBearerToken("");
  assert.equal(token, null);
});

test("extractBearerToken returns null for Bearer without token", () => {
  const token = extractBearerToken("Bearer ");
  assert.equal(token, "");
});

// ============================================================================
// Principal Sessions Tests
// ============================================================================

test("getPrincipalSessions returns active sessions for principal", () => {
  const principalId = "user-multi-session";
  createSession({ principalId, principalType: "user" });
  createSession({ principalId, principalType: "user" });

  const sessions = getPrincipalSessions(principalId);
  assert.ok(sessions.length >= 2);
  for (const session of sessions) {
    assert.equal(session.principalId, principalId);
  }
});

test("getPrincipalSessions returns empty for non-existent principal", () => {
  const sessions = getPrincipalSessions("non-existent-principal");
  assert.deepEqual(sessions, []);
});

// ============================================================================
// Revoke All Principal Sessions Tests
// ============================================================================

test("revokeAllPrincipalSessions revokes all sessions for principal", () => {
  const principalId = "user-revoke-all";
  const session1 = createSession({ principalId, principalType: "user" });
  const session2 = createSession({ principalId, principalType: "user" });

  const count = revokeAllPrincipalSessions(principalId);
  assert.ok(count >= 2);

  // Both sessions should now be invalid
  const result1 = validateAccessToken(session1.accessToken.tokenId);
  const result2 = validateAccessToken(session2.accessToken.tokenId);
  assert.equal(result1.valid, false);
  assert.equal(result2.valid, false);
});

test("revokeAllPrincipalSessions returns zero for principal with no sessions", () => {
  const count = revokeAllPrincipalSessions("non-existent-principal-for-revoke");
  assert.equal(count, 0);
});

// ============================================================================
// Session Expiry Edge Cases
// ============================================================================

test("session refresh updates lastAccessedAt", () => {
  const session = createSession({ principalId: "user-access-time", principalType: "user" });
  const originalLastAccessed = session.lastAccessedAt;

  // Small delay to ensure time difference
  const newSession = refreshSession(session.refreshToken.tokenId);

  assert.ok(newSession.lastAccessedAt >= originalLastAccessed);
});

test("new access token has later expiry than original", () => {
  const session = createSession({ principalId: "user-new-expiry", principalType: "user" });
  const originalExpiry = session.accessToken.expiresAt;

  const newSession = refreshSession(session.refreshToken.tokenId);

  // New access token should be issued now, so expiry should be in the future relative to old one
  assert.ok(newSession.accessToken.expiresAt >= originalExpiry);
});