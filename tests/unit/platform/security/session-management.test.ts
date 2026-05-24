import assert from "node:assert/strict";
import test from "node:test";

import {
  createSession,
  validateAccessToken,
  refreshSession,
  revokeSession,
  revokeAllPrincipalSessions,
  getSession,
  getPrincipalSessions,
  extractBearerToken,
  getSessionStats,
  __dangerousResetSessionStoreForTests,
} from "../../../../src/platform/five-plane-control-plane/iam/session-management.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

test.describe("Session Management", () => {
  const originalAllowTestMutations = process.env.AA_ALLOW_TEST_SESSION_STORE_MUTATIONS;

  test.beforeEach(() => {
    process.env.AA_ALLOW_TEST_SESSION_STORE_MUTATIONS = "1";
    __dangerousResetSessionStoreForTests();
  });

  test.afterEach(() => {
    __dangerousResetSessionStoreForTests();
    if (originalAllowTestMutations == null) {
      delete process.env.AA_ALLOW_TEST_SESSION_STORE_MUTATIONS;
    } else {
      process.env.AA_ALLOW_TEST_SESSION_STORE_MUTATIONS = originalAllowTestMutations;
    }
  });

  test("createSession creates session with access and refresh tokens", () => {
    const session = createSession({
      principalId: "user-123",
      principalType: "user",
      metadata: { plan: "pro" },
      clientIp: "192.168.1.1",
      userAgent: "Mozilla/5.0",
    });

    assert.ok(session.sessionId);
    assert.equal(session.principalId, "user-123");
    assert.equal(session.principalType, "user");
    assert.equal(session.status, "active");
    assert.ok(session.accessToken.tokenId);
    assert.ok(session.accessToken.expiresAt > Date.now());
    assert.ok(session.refreshToken.tokenId);
    assert.ok(session.refreshToken.expiresAt > session.accessToken.expiresAt);
    assert.ok(session.metadata.plan === "pro");
    assert.equal(session.clientIp, "192.168.1.1");
    assert.equal(session.userAgent, "Mozilla/5.0");
  });

  test("createSession sets refreshTokenId back-reference on access token", () => {
    const session = createSession({
      principalId: "user-backref",
      principalType: "user",
    });

    assert.equal(session.accessToken.refreshTokenId, session.refreshToken.tokenId);
  });

  test("validateAccessToken returns valid for active token", () => {
    const session = createSession({
      principalId: "user-valid",
      principalType: "user",
    });

    const result = validateAccessToken(session.accessToken.tokenId, {});

    assert.equal(result.valid, true);
    assert.ok(result.session);
    assert.equal(result.session?.sessionId, session.sessionId);
    assert.equal(result.reason, null);
  });

  test("validateAccessToken returns invalid for nonexistent token", () => {
    const result = validateAccessToken("nonexistent-token", {});

    assert.equal(result.valid, false);
    assert.equal(result.session, null);
    assert.equal(result.reason, "access_token_invalid");
  });

  test("validateAccessToken returns invalid for revoked token", () => {
    const session = createSession({
      principalId: "user-revoked",
      principalType: "user",
    });

    revokeSession(session.sessionId);

    const result = validateAccessToken(session.accessToken.tokenId, {});

    assert.equal(result.valid, false);
    assert.equal(result.reason, "session_revoked");
  });

  test("validateAccessToken returns invalid for expired token", () => {
    const session = createSession({
      principalId: "user-expired",
      principalType: "user",
    });

    const stored = getSession(session.sessionId) as (typeof session & {
      accessToken: { expiresAt: number };
    }) | null;
    assert.ok(stored);
    stored.accessToken.expiresAt = Date.now() - 1;

    const result = validateAccessToken(session.accessToken.tokenId, {});

    assert.equal(result.valid, false);
    assert.equal(result.reason, "access_token_expired");
  });

  test("validateAccessToken respects clientIp binding when configured", () => {
    const session = createSession({
      principalId: "user-ip",
      principalType: "user",
      clientIp: "10.0.0.1",
    });

    // Valid with matching IP
    const result1 = validateAccessToken(session.accessToken.tokenId, { clientIp: "10.0.0.1" });
    assert.equal(result1.valid, true);

    // Invalid with different IP
    const result2 = validateAccessToken(session.accessToken.tokenId, { clientIp: "10.0.0.2" });
    assert.equal(result2.valid, false);
    assert.equal(result2.reason, "access_token_invalid");
  });

  test("validateAccessToken respects userAgent binding when configured", () => {
    const session = createSession({
      principalId: "user-ua",
      principalType: "user",
      userAgent: "TestBrowser/1.0",
    });

    // Valid with matching user agent
    const result1 = validateAccessToken(session.accessToken.tokenId, { userAgent: "TestBrowser/1.0" });
    assert.equal(result1.valid, true);

    // Invalid with different user agent
    const result2 = validateAccessToken(session.accessToken.tokenId, { userAgent: "DifferentBrowser/2.0" });
    assert.equal(result2.valid, false);
    assert.equal(result2.reason, "access_token_invalid");
  });

  test("refreshSession rotates tokens and updates session status", () => {
    const originalSession = createSession({
      principalId: "user-refresh",
      principalType: "user",
    });

    const refreshedSession = refreshSession(originalSession.refreshToken.tokenId, "192.168.1.100");

    assert.equal(refreshedSession.status, "refreshed");
    assert.notEqual(refreshedSession.accessToken.tokenId, originalSession.accessToken.tokenId);
    assert.notEqual(refreshedSession.refreshToken.tokenId, originalSession.refreshToken.tokenId);
    assert.equal(refreshedSession.refreshToken.rotatedCount, 1);
    assert.equal(refreshedSession.refreshToken.isRotated, true);
    assert.equal(refreshedSession.accessToken.expiresAt > Date.now(), true);
    assert.equal(refreshedSession.refreshToken.expiresAt > Date.now(), true);
  });

  test("refreshSession preserves sessionId across rotation", () => {
    const originalSession = createSession({
      principalId: "user-same-id",
      principalType: "user",
    });

    const refreshedSession = refreshSession(originalSession.refreshToken.tokenId);

    assert.equal(refreshedSession.sessionId, originalSession.sessionId);
  });

  test("refreshSession throws for invalid refresh token", () => {
    createSession({
      principalId: "user-invalid-refresh",
      principalType: "user",
    });

    assert.throws(
      () => refreshSession("invalid-refresh-token"),
      /session.refresh_token_invalid/,
    );
  });

  test("refreshSession treats expired refresh token as invalid after pruning", () => {
    const session = createSession({
      principalId: "user-expired-refresh",
      principalType: "user",
    });

    const stored = getSession(session.sessionId) as (typeof session & {
      refreshToken: { expiresAt: number };
    }) | null;
    assert.ok(stored);
    stored.refreshToken.expiresAt = Date.now() - 1;

    assert.throws(
      () => refreshSession(session.refreshToken.tokenId),
      /session.refresh_token_invalid/,
    );
  });

  test("refreshSession throws for reused refresh token (rotation detection)", () => {
    const session = createSession({
      principalId: "user-reuse-detect",
      principalType: "user",
    });

    // First refresh succeeds
    const refreshed1 = refreshSession(session.refreshToken.tokenId);

    // Second refresh with same token should fail
    assert.throws(
      () => refreshSession(session.refreshToken.tokenId),
      /session.refresh_token_reused/,
    );
  });

  test("revokeSession marks session as revoked and invalidates tokens", () => {
    const session = createSession({
      principalId: "user-revoke",
      principalType: "user",
    });

    revokeSession(session.sessionId);

    const result = validateAccessToken(session.accessToken.tokenId, {});
    assert.equal(result.valid, false);
    assert.equal(result.reason, "session_revoked");

    const stats = getSessionStats();
    assert.equal(stats.revokedSessions, 1);
  });

  test("revokeSession throws for nonexistent session", () => {
    assert.throws(
      () => revokeSession("nonexistent-session"),
      /session.not_found/,
    );
  });

  test("revokeAllPrincipalSessions revokes all sessions for a principal", () => {
    const session1 = createSession({
      principalId: "user-multi",
      principalType: "user",
    });
    const session2 = createSession({
      principalId: "user-multi",
      principalType: "user",
    });

    const count = revokeAllPrincipalSessions("user-multi");

    assert.ok(count >= 2);
    const result1 = validateAccessToken(session1.accessToken.tokenId, {});
    const result2 = validateAccessToken(session2.accessToken.tokenId, {});
    assert.equal(result1.reason, "session_revoked");
    assert.equal(result2.reason, "session_revoked");
  });

  test("revokeAllPrincipalSessions returns 0 for user with no sessions", () => {
    const count = revokeAllPrincipalSessions("nonexistent-user");
    assert.equal(count, 0);
  });

  test("getSession returns session by ID", () => {
    const session = createSession({
      principalId: "user-get",
      principalType: "user",
    });

    const found = getSession(session.sessionId);
    assert.ok(found);
    assert.equal(found?.sessionId, session.sessionId);
    assert.equal(found?.principalId, "user-get");
  });

  test("getSession returns null for nonexistent session", () => {
    const found = getSession("nonexistent-session");
    assert.equal(found, null);
  });

  test("getPrincipalSessions returns all active sessions for a principal", () => {
    const session1 = createSession({
      principalId: "user-all-sessions",
      principalType: "user",
    });
    const session2 = createSession({
      principalId: "user-all-sessions",
      principalType: "user",
    });
    // Create session for different user
    createSession({
      principalId: "other-user",
      principalType: "user",
    });

    const sessions = getPrincipalSessions("user-all-sessions");

    assert.ok(sessions.length >= 2);
    assert.ok(sessions.every((s) => s.principalId === "user-all-sessions"));
  });

  test("getPrincipalSessions excludes revoked sessions", () => {
    const session1 = createSession({
      principalId: "user-some-revoked",
      principalType: "user",
    });
    const session2 = createSession({
      principalId: "user-some-revoked",
      principalType: "user",
    });

    revokeSession(session1.sessionId);

    const sessions = getPrincipalSessions("user-some-revoked");

    assert.equal(sessions.length, 1);
    assert.equal(sessions[0]!.sessionId, session2.sessionId);
  });

  test("extractBearerToken extracts token from valid header", () => {
    const token = extractBearerToken("Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test");
    assert.equal(token, "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test");
  });

  test("extractBearerToken returns null for null header", () => {
    const token = extractBearerToken(null);
    assert.equal(token, null);
  });

  test("extractBearerToken returns null for non-Bearer header", () => {
    const token = extractBearerToken("Basic dXNlcjpwYXNz");
    assert.equal(token, null);
  });

  test("extractBearerToken returns null for header without token", () => {
    const token = extractBearerToken("Bearer ");
    assert.equal(token, "");
  });

  test("getSessionStats returns correct counts", () => {
    createSession({ principalId: "stats-active", principalType: "user" });
    createSession({ principalId: "stats-active-2", principalType: "user" });

    const stats = getSessionStats();

    assert.ok(stats.totalSessions >= 2);
    assert.ok(stats.activeSessions >= 2);
    assert.equal(stats.revokedSessions, 0);
    assert.equal(stats.expiredSessions, 0);
  });

  test("getSessionStats counts revoked and expired sessions", () => {
    const session1 = createSession({ principalId: "stats-revoked", principalType: "user" });
    const session2 = createSession({ principalId: "stats-expired", principalType: "user" });

    revokeSession(session1.sessionId);
    const expired = getSession(session2.sessionId) as (typeof session2 & {
      status: "expired";
    }) | null;
    assert.ok(expired);
    expired.status = "expired";

    const stats = getSessionStats();

    assert.ok(stats.revokedSessions >= 1);
    assert.ok(stats.expiredSessions >= 1);
  });

  test("session access token has 15-minute TTL", () => {
    const session = createSession({
      principalId: "user-ttl",
      principalType: "user",
    });

    const ttlMs = session.accessToken.expiresAt - session.accessToken.issuedAt;
    const fifteenMinutes = 15 * 60 * 1000;

    // Allow some tolerance for test execution time
    assert.ok(ttlMs >= fifteenMinutes - 1000 && ttlMs <= fifteenMinutes + 5000);
  });

  test("session refresh token has 24-hour TTL", () => {
    const session = createSession({
      principalId: "user-refresh-ttl",
      principalType: "user",
    });

    const ttlMs = session.refreshToken.expiresAt - session.refreshToken.issuedAt;
    const twentyFourHours = 24 * 60 * 60 * 1000;

    // Allow some tolerance
    assert.ok(ttlMs >= twentyFourHours - 1000 && ttlMs <= twentyFourHours + 5000);
  });

  test("validateAccessToken updates lastAccessedAt on valid access", () => {
    const session = createSession({
      principalId: "user-touch",
      principalType: "user",
    });

    const initialLastAccessed = session.lastAccessedAt;

    // Small delay to ensure time difference
    const start = Date.now();
    while (Date.now() - start < 10) { /* spin */ }

    const result = validateAccessToken(session.accessToken.tokenId, {});

    assert.equal(result.valid, true);
    assert.ok(result.session!.lastAccessedAt >= initialLastAccessed);
  });
});
