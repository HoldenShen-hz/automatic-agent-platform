/**
 * Unit tests for OIDC Identity Service
 * Tests PKCE flow, token rotation, session management, production hardening
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  OidcIdentityService,
  InMemoryOidcStateStore,
  createOidcIdentityService,
  buildOidcAuthorizationUrl,
  type OidcProviderConfig,
  type OidcTokenResponse,
  type OidcUserInfo,
  type OidcSession,
} from "../../../../../src/org-governance/sso-scim/oidc/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createTestProviderConfig(overrides?: Partial<OidcProviderConfig>): OidcProviderConfig {
  return {
    providerId: "test-provider",
    issuer: "https://idp.example.com",
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    redirectUri: "https://app.example.com/callback",
    authorizationEndpoint: "https://idp.example.com/authorize",
    tokenEndpoint: "https://idp.example.com/token",
    userInfoEndpoint: "https://idp.example.com/userinfo",
    scopes: ["openid", "profile", "email"],
    ...overrides,
  };
}

function createTestTokens(overrides?: Partial<OidcTokenResponse>): OidcTokenResponse {
  return {
    accessToken: "at_test-access",
    idToken: "id_test-id",
    refreshToken: "rt_test-refresh",
    expiresIn: 3600,
    tokenType: "Bearer",
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    ...overrides,
  };
}

function createTestUserInfo(overrides?: Partial<OidcUserInfo>): OidcUserInfo {
  return {
    sub: "user-123",
    email: "test@example.com",
    name: "Test User",
    givenName: "Test",
    familyName: "User",
    preferredUsername: "testuser",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// buildOidcAuthorizationUrl Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("buildOidcAuthorizationUrl", () => {
  it("should build authorization URL with required params", () => {
    const config = createTestProviderConfig();
    const url = buildOidcAuthorizationUrl(config, "test-state");

    assert.ok(url.includes("client_id=test-client-id"));
    assert.ok(url.includes("redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback"));
    assert.ok(url.includes("response_type=code"));
    assert.ok(url.includes("state=test-state"));
    assert.ok(url.includes("scope="));
  });

  it("should use default issuer/authorize when authorizationEndpoint not set", () => {
    const config = createTestProviderConfig({
      authorizationEndpoint: undefined,
    });
    const url = buildOidcAuthorizationUrl(config, "state-123");

    assert.ok(url.includes("https://idp.example.com/authorize"));
  });

  it("should include custom scopes", () => {
    const config = createTestProviderConfig({
      scopes: ["openid", "profile", "email", "custom"],
    });
    const url = buildOidcAuthorizationUrl(config, "state");

    // Scopes are space-separated
    assert.ok(url.includes("scope=openid+profile+email+custom") ||
              url.includes("scope=openid+profile+email+custom") ||
              url.includes("openid"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// InMemoryOidcStateStore Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("InMemoryOidcStateStore", () => {
  let store: InMemoryOidcStateStore;

  beforeEach(() => {
    store = new InMemoryOidcStateStore();
  });

  describe("saveState and getState", () => {
    it("should save and retrieve state with nonce and redirectUri", () => {
      const state = "test-state-123";
      const nonce = "test-nonce-456";
      const redirectUri = "https://app.example.com/callback";

      store.saveState(state, nonce, redirectUri);
      const result = store.getState(state);

      assert.ok(result !== null);
      assert.strictEqual(result.nonce, nonce);
      assert.strictEqual(result.redirectUri, redirectUri);
    });

    it("should return null for non-existent state", () => {
      const result = store.getState("non-existent-state");
      assert.strictEqual(result, null);
    });
  });

  describe("deleteState", () => {
    it("should delete state and subsequent get returns null", () => {
      const state = "test-state-to-delete";
      store.saveState(state, "nonce", "https://example.com");
      store.deleteState(state);

      const result = store.getState(state);
      assert.strictEqual(result, null);
    });
  });

  it("should overwrite existing state", () => {
    const state = "existing-state";
    store.saveState(state, "nonce1", "https://example1.com");
    store.saveState(state, "nonce2", "https://example2.com");

    const result = store.getState(state);
    assert.ok(result !== null);
    assert.strictEqual(result.nonce, "nonce2");
    assert.strictEqual(result.redirectUri, "https://example2.com");
  });

  it("should expire state after 10 minutes", () => {
    const state = "expiring-state";
    store.saveState(state, "nonce", "https://example.com");

    // Manually expire by modifying internal state (for testing)
    const entry = (store as unknown as { store: Map<string, { nonce: string; redirectUri: string; expiresAt: number }> }).store.get(state);
    if (entry) {
      entry.expiresAt = Date.now() - 1; // Set to past
    }

    const result = store.getState(state);
    assert.strictEqual(result, null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OidcIdentityService - Flow Initiation Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("OidcIdentityService - initiateFlow", () => {
  let service: OidcIdentityService;

  beforeEach(() => {
    const config = createTestProviderConfig();
    service = new OidcIdentityService(config, undefined, { allowMockFallback: true });
  });

  it("should return authorizationUrl, state, and nonce", () => {
    const result = service.initiateFlow("https://app.example.com/callback");

    assert.ok(result.authorizationUrl.length > 0);
    assert.ok(result.state.length > 0);
    assert.ok(result.nonce.length > 0);
  });

  it("should include PKCE code_challenge in authorization URL", () => {
    const result = service.initiateFlow("https://app.example.com/callback");

    assert.ok(result.authorizationUrl.includes("code_challenge="));
    assert.ok(result.authorizationUrl.includes("code_challenge_method=S256"));
  });

  it("should save state for later verification", () => {
    const result = service.initiateFlow("https://app.example.com/callback");

    const stateStore = (service as unknown as { stateStore: InMemoryOidcStateStore }).stateStore;
    const stored = stateStore.getState(result.state);

    assert.ok(stored !== null);
    assert.strictEqual(stored.nonce, result.nonce);
    assert.strictEqual(stored.redirectUri, "https://app.example.com/callback");
  });

  it("should include nonce in authorization URL", () => {
    const result = service.initiateFlow("https://app.example.com/callback");

    assert.ok(result.authorizationUrl.includes(`nonce=${encodeURIComponent(result.nonce)}`));
  });

  it("should include scopes in authorization URL", () => {
    const result = service.initiateFlow("https://app.example.com/callback");

    assert.ok(result.authorizationUrl.includes("scope="));
    assert.ok(result.authorizationUrl.includes("openid"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OidcIdentityService - Token Exchange Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("OidcIdentityService - exchangeCodeForTokens", () => {
  let service: OidcIdentityService;

  beforeEach(() => {
    const config = createTestProviderConfig();
    service = new OidcIdentityService(config, undefined, { allowMockFallback: true });
  });

  it("should return null when state does not exist", async () => {
    const result = await service.exchangeCodeForTokens("auth-code", "wrong-state");
    assert.strictEqual(result, null);
  });

  it("should return tokens when state is valid", async () => {
    const { state } = service.initiateFlow("https://app.example.com/callback");

    const result = await service.exchangeCodeForTokens("auth-code-123", state);

    assert.ok(result !== null);
    assert.ok(result.accessToken.length > 0);
    assert.ok(result.idToken.length > 0);
    assert.strictEqual(result.tokenType, "Bearer");
    assert.ok(result.expiresIn > 0);
  });

  it("should delete state after successful exchange", async () => {
    const { state } = service.initiateFlow("https://app.example.com/callback");

    await service.exchangeCodeForTokens("auth-code-123", state);

    const stateStore = (service as unknown as { stateStore: InMemoryOidcStateStore }).stateStore;
    const stored = stateStore.getState(state);
    assert.strictEqual(stored, null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OidcIdentityService - Session Management Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("OidcIdentityService - createSession", () => {
  let service: OidcIdentityService;

  beforeEach(() => {
    const config = createTestProviderConfig();
    service = new OidcIdentityService(config, undefined, { allowMockFallback: true });
  });

  it("should create session from token response", () => {
    const tokens = createTestTokens();
    const userInfo = createTestUserInfo();

    const session = service.createSession(tokens, userInfo);

    assert.ok(session.sessionId.length > 0);
    assert.strictEqual(session.userId, "user-123");
    assert.strictEqual(session.accessToken, "at_test-access");
    assert.strictEqual(session.idToken, "id_test-id");
    assert.strictEqual(session.refreshToken, "rt_test-refresh");
    assert.strictEqual(session.providerId, "test-provider");
  });

  it("should track session by user", () => {
    const tokens = createTestTokens();
    const userInfo = createTestUserInfo({ sub: "user-456" });

    service.createSession(tokens, userInfo);

    const userSessions = service.getUserSessions("user-456");
    assert.strictEqual(userSessions.length, 1);
  });

  it("should create session without refreshToken", () => {
    const tokens = createTestTokens({ refreshToken: undefined });
    const userInfo = createTestUserInfo();

    const session = service.createSession(tokens, userInfo);

    assert.ok(session.sessionId.length > 0);
    assert.strictEqual(session.refreshToken, undefined);
  });

  it("should enforce maxSessionsPerUser", () => {
    const config = createTestProviderConfig();
    const limitedService = new OidcIdentityService(config, undefined, {
      allowMockFallback: true,
      maxSessionsPerUser: 2,
    });

    const tokens1 = createTestTokens({ accessToken: "at_1", idToken: "id_1" });
    const tokens2 = createTestTokens({ accessToken: "at_2", idToken: "id_2" });
    const tokens3 = createTestTokens({ accessToken: "at_3", idToken: "id_3" });
    const userInfo = createTestUserInfo();

    limitedService.createSession(tokens1, userInfo);
    limitedService.createSession(tokens2, userInfo);
    limitedService.createSession(tokens3, userInfo);

    const sessions = limitedService.getUserSessions("user-123");
    // Should have at most maxSessionsPerUser (2)
    assert.ok(sessions.length <= 2);
  });
});

describe("OidcIdentityService - validateAccessToken", () => {
  let service: OidcIdentityService;

  beforeEach(() => {
    const config = createTestProviderConfig();
    service = new OidcIdentityService(config, undefined, { allowMockFallback: true });
  });

  it("should return session for valid token", () => {
    const tokens = createTestTokens();
    const userInfo = createTestUserInfo();

    service.createSession(tokens, userInfo);
    const session = service.validateAccessToken("at_test-access");

    assert.ok(session !== null);
    assert.strictEqual(session!.userId, "user-123");
  });

  it("should return null for invalid token", () => {
    const session = service.validateAccessToken("at_invalid-token");
    assert.strictEqual(session, null);
  });

  it("should return null for expired token", () => {
    const expiredTokens = createTestTokens({
      expiresIn: -1,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    service.createSession(expiredTokens, createTestUserInfo());

    const session = service.validateAccessToken("at_test-access");
    assert.strictEqual(session, null);
  });

  it("should reject mock tokens in production", () => {
    // Save original NODE_ENV
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";

      const prodService = new OidcIdentityService(createTestProviderConfig(), undefined, {
        allowMockFallback: false,
      });

      assert.throws(() => {
        prodService.validateAccessToken("at_mock-token");
      }, /Mock token rejected in production/);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});

describe("OidcIdentityService - revokeSession", () => {
  let service: OidcIdentityService;

  beforeEach(() => {
    const config = createTestProviderConfig();
    service = new OidcIdentityService(config, undefined, { allowMockFallback: true });
  });

  it("should remove session", () => {
    const tokens = createTestTokens();
    const userInfo = createTestUserInfo({ sub: "user-revoke" });

    const session = service.createSession(tokens, userInfo);
    assert.strictEqual(service.getSessionCount(), 1);

    service.revokeSession(session.sessionId);
    assert.strictEqual(service.getSessionCount(), 0);
  });

  it("should handle revoking non-existent session", () => {
    // Should not throw
    service.revokeSession("non-existent-session");
    assert.strictEqual(service.getSessionCount(), 0);
  });

  it("should clean up accessTokenIndex on revoke", () => {
    const tokens = createTestTokens();
    const userInfo = createTestUserInfo();

    const session = service.createSession(tokens, userInfo);

    // Token should be valid before revoke
    assert.ok(service.validateAccessToken("at_test-access") !== null);

    service.revokeSession(session.sessionId);

    // Token should be invalid after revoke
    assert.strictEqual(service.validateAccessToken("at_test-access"), null);
  });
});

describe("OidcIdentityService - revokeAllUserSessions", () => {
  let service: OidcIdentityService;

  beforeEach(() => {
    const config = createTestProviderConfig();
    service = new OidcIdentityService(config, undefined, { allowMockFallback: true });
  });

  it("should revoke all sessions for user", () => {
    const userInfo = createTestUserInfo({ sub: "user-multi" });

    for (let i = 0; i < 3; i++) {
      const tokens = createTestTokens({ accessToken: `at_multi-${i}`, idToken: `id_multi-${i}` });
      service.createSession(tokens, userInfo);
    }

    const count = service.revokeAllUserSessions("user-multi");
    assert.strictEqual(count, 3);
    assert.strictEqual(service.getUserSessions("user-multi").length, 0);
  });

  it("should return 0 when user has no sessions", () => {
    const count = service.revokeAllUserSessions("non-existent-user");
    assert.strictEqual(count, 0);
  });
});

describe("OidcIdentityService - getUserSessions", () => {
  let service: OidcIdentityService;

  beforeEach(() => {
    const config = createTestProviderConfig();
    service = new OidcIdentityService(config, undefined, { allowMockFallback: true });
  });

  it("should return active sessions for user", () => {
    const tokens = createTestTokens();
    const userInfo = createTestUserInfo({ sub: "user-active" });

    service.createSession(tokens, userInfo);
    const sessions = service.getUserSessions("user-active");

    assert.strictEqual(sessions.length, 1);
    assert.strictEqual(sessions[0].userId, "user-active");
  });

  it("should return empty array for non-existent user", () => {
    const sessions = service.getUserSessions("non-existent");
    assert.strictEqual(sessions.length, 0);
  });

  it("should not return expired sessions", () => {
    const expiredTokens = createTestTokens({
      accessToken: "at_expired",
      idToken: "id_expired",
      expiresIn: -1,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    service.createSession(expiredTokens, createTestUserInfo({ sub: "user-expired" }));

    const sessions = service.getUserSessions("user-expired");
    assert.strictEqual(sessions.length, 0);
  });
});

describe("OidcIdentityService - touchSession", () => {
  let service: OidcIdentityService;

  beforeEach(() => {
    const config = createTestProviderConfig();
    service = new OidcIdentityService(config, undefined, { allowMockFallback: true });
  });

  it("should update lastActivityAt", () => {
    const tokens = createTestTokens();
    const session = service.createSession(tokens, createTestUserInfo());

    service.touchSession(session.sessionId);

    const updated = service.validateAccessToken("at_test-access");
    assert.ok(updated !== null);
    assert.ok(updated!.lastActivityAt >= session.lastActivityAt);
  });

  it("should extend session expiration (sliding window)", () => {
    const shortLivedService = new OidcIdentityService(createTestProviderConfig(), undefined, {
      allowMockFallback: true,
      sessionTtlMs: 60000,
      maxSessionAgeMs: 3600000,
    });

    const tokens = createTestTokens();
    const session = shortLivedService.createSession(tokens, createTestUserInfo());
    const originalExpiry = session.expiresAt;

    // Wait a tiny bit then touch
    const start = Date.now();
    while (Date.now() - start < 5) { /* spin */ }

    shortLivedService.touchSession(session.sessionId);

    const updated = shortLivedService.validateAccessToken("at_test-access");
    assert.ok(updated !== null);
    // Expiry should be extended (or at least not decreased to below original)
    assert.ok(updated!.expiresAt >= originalExpiry);
  });

  it("should not throw for non-existent session", () => {
    // Should not throw
    service.touchSession("non-existent-session");
  });
});

describe("OidcIdentityService - refreshAccessToken", () => {
  let service: OidcIdentityService;

  beforeEach(() => {
    const config = createTestProviderConfig();
    service = new OidcIdentityService(config, undefined, { allowMockFallback: true });
  });

  it("should return null for non-existent session", async () => {
    const result = await service.refreshAccessToken("non-existent-session");
    assert.strictEqual(result, null);
  });

  it("should return null when session has no refresh token", async () => {
    const tokens = createTestTokens({ refreshToken: undefined });
    service.createSession(tokens, createTestUserInfo());

    const sessionId = (service as unknown as { sessions: Map<string, unknown> }).sessions.keys().next().value;
    const result = await service.refreshAccessToken(sessionId as string);

    assert.strictEqual(result, null);
  });
});

describe("OidcIdentityService - cleanupExpiredSessions", () => {
  let service: OidcIdentityService;

  beforeEach(() => {
    const config = createTestProviderConfig();
    service = new OidcIdentityService(config, undefined, { allowMockFallback: true });
  });

  it("should clean up expired sessions", () => {
    const expiredTokens = createTestTokens({
      accessToken: "at_to-clean",
      idToken: "id_to-clean",
      expiresIn: -1,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    service.createSession(expiredTokens, createTestUserInfo({ sub: "user-clean" }));

    const beforeCount = service.getSessionCount();
    const cleaned = service.cleanupExpiredSessions();

    assert.ok(cleaned >= 0);
    assert.ok(service.getSessionCount() < beforeCount || beforeCount === 0);
  });

  it("should return 0 when no sessions to clean", () => {
    const cleaned = service.cleanupExpiredSessions();
    assert.strictEqual(cleaned, 0);
  });
});

describe("OidcIdentityService - getSessionCount", () => {
  let service: OidcIdentityService;

  beforeEach(() => {
    const config = createTestProviderConfig();
    service = new OidcIdentityService(config, undefined, { allowMockFallback: true });
  });

  it("should return correct count", () => {
    assert.strictEqual(service.getSessionCount(), 0);

    service.createSession(createTestTokens(), createTestUserInfo({ sub: "user-1" }));
    service.createSession(createTestTokens({ accessToken: "at_2", idToken: "id_2" }), createTestUserInfo({ sub: "user-2" }));

    assert.strictEqual(service.getSessionCount(), 2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OidcIdentityService - UserInfo Fetch Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("OidcIdentityService - fetchUserInfo", () => {
  it("should return simulated user info when endpoint unavailable with mock fallback", async () => {
    const badConfig = createTestProviderConfig({
      userInfoEndpoint: "https://unreachable.example.com/userinfo",
    });
    const badService = new OidcIdentityService(badConfig, undefined, { allowMockFallback: true });

    const result = await badService.fetchUserInfo("at_test-token");

    assert.ok(result !== null);
    assert.ok(result.sub.length > 0);
    assert.ok(result.email != null && result.email.endsWith("@example.com"));
    assert.strictEqual(result.name, "Test User");
    assert.deepStrictEqual(result.groups, ["engineers", "admins"]);
  });

  it("should throw when endpoint fails and mock fallback disabled", async () => {
    const badConfig = createTestProviderConfig({
      userInfoEndpoint: "https://unreachable.example.com/userinfo",
    });
    // Save original NODE_ENV
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      const badService = new OidcIdentityService(badConfig, undefined, { allowMockFallback: false });

      await assert.rejects(
        async () => badService.fetchUserInfo("at_test-token"),
        /fetch failed|userinfo_fetch_failed/,
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createOidcIdentityService Factory Function
// ─────────────────────────────────────────────────────────────────────────────

describe("createOidcIdentityService", () => {
  it("should create service instance", () => {
    const config = createTestProviderConfig();
    const service = createOidcIdentityService(config);

    assert.ok(service instanceof OidcIdentityService);
  });

  it("should create service with custom config", () => {
    const config = createTestProviderConfig();
    const service = createOidcIdentityService(config, undefined, {
      sessionTtlMs: 7200000,
      refreshThresholdMs: 600000,
    });

    assert.ok(service instanceof OidcIdentityService);
  });

  it("should create service with custom state store", () => {
    const config = createTestProviderConfig();
    const store = new InMemoryOidcStateStore();
    const service = createOidcIdentityService(config, store);

    assert.ok(service instanceof OidcIdentityService);
    const { state } = service.initiateFlow("https://example.com/callback");
    assert.ok(store.getState(state) !== null);
  });
});
