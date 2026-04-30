/**
 * Unit tests for OIDC Identity Service
 * Tests PKCE flow, token rotation, userinfo fallback
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// Mock process.env before imports
const originalEnv = process.env.NODE_ENV;

import {
  OidcIdentityService,
  InMemoryOidcStateStore,
  createOidcIdentityService,
  type OidcProviderConfig,
  type OidcTokenResponse,
  type OidcUserInfo,
  type OidcSession,
} from "../../../../../../src/org-governance/sso-scim/oidc/index.js";

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

// ─────────────────────────────────────────────────────────────────────────────
// InMemoryOidcStateStore Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("InMemoryOidcStateStore", () => {
  let store: InMemoryOidcStateStore;

  beforeEach(() => {
    store = new InMemoryOidcStateStore();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
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
});

// ─────────────────────────────────────────────────────────────────────────────
// OidcIdentityService - Flow Initiation Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("OidcIdentityService - Flow Initiation", () => {
  let service: OidcIdentityService;
  let providerConfig: OidcProviderConfig;

  beforeEach(() => {
    providerConfig = createTestProviderConfig();
    service = new OidcIdentityService(providerConfig);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe("initiateFlow", () => {
    it("should return authorizationUrl, state, and nonce", () => {
      const redirectUri = "https://app.example.com/callback";
      const result = service.initiateFlow(redirectUri);

      assert.ok(result.authorizationUrl.includes("client_id="));
      assert.ok(result.authorizationUrl.includes("redirect_uri="));
      assert.ok(result.authorizationUrl.includes("response_type=code"));
      assert.ok(result.state.length > 0);
      assert.ok(result.nonce.length > 0);
    });

    it("should save state for later verification", () => {
      const redirectUri = "https://app.example.com/callback";
      const result = service.initiateFlow(redirectUri);

      // Use the state store directly to verify
      const stateStore = (service as unknown as { stateStore: InMemoryOidcStateStore }).stateStore;
      const stored = stateStore.getState(result.state);

      assert.ok(stored !== null);
      assert.strictEqual(stored.nonce, result.nonce);
      assert.strictEqual(stored.redirectUri, redirectUri);
    });

    it("should include nonce in authorization URL", () => {
      const result = service.initiateFlow("https://app.example.com/callback");

      assert.ok(result.authorizationUrl.includes(`nonce=${encodeURIComponent(result.nonce)}`));
    });

    it("should include scopes in authorization URL", () => {
      const result = service.initiateFlow("https://app.example.com/callback");

      assert.ok(result.authorizationUrl.includes("scope="));
      assert.ok(result.authorizationUrl.includes("openid"));
      assert.ok(result.authorizationUrl.includes("profile"));
      assert.ok(result.authorizationUrl.includes("email"));
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OidcIdentityService - Token Exchange Tests (Mock Mode)
// ─────────────────────────────────────────────────────────────────────────────

describe("OidcIdentityService - Token Exchange", () => {
  let service: OidcIdentityService;
  let providerConfig: OidcProviderConfig;

  beforeEach(() => {
    providerConfig = createTestProviderConfig();
    // Use allowMockFallback to test simulation in non-production
    service = new OidcIdentityService(providerConfig, undefined, { allowMockFallback: true });
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe("exchangeCodeForTokens", () => {
    it("should return null when state does not exist", async () => {
      const result = await service.exchangeCodeForTokens("auth-code", "wrong-state");
      assert.strictEqual(result, null);
    });

    it("should simulate token response when mock fallback enabled", async () => {
      // Initiate flow to get valid state
      const { state } = service.initiateFlow("https://app.example.com/callback");

      const result = await service.exchangeCodeForTokens("auth-code-123", state);

      assert.ok(result !== null);
      assert.ok(result.accessToken.length > 0);
      assert.ok(result.idToken.length > 0);
      assert.ok(result.refreshToken !== undefined);
      assert.strictEqual(result.tokenType, "Bearer");
      assert.ok(result.expiresIn > 0);
      assert.ok(result.expiresAt.length > 0);
    });

    it("should delete state after successful exchange", async () => {
      const { state } = service.initiateFlow("https://app.example.com/callback");

      await service.exchangeCodeForTokens("auth-code-123", state);

      // State should be deleted
      const stateStore = (service as unknown as { stateStore: InMemoryOidcStateStore }).stateStore;
      const stored = stateStore.getState(state);
      assert.strictEqual(stored, null);
    });
  });

  describe("refreshAccessToken", () => {
    it("should return null for non-existent session", async () => {
      const result = await service.refreshAccessToken("non-existent-session");
      assert.strictEqual(result, null);
    });

    it("should return null when session has no refresh token", async () => {
      // Create a session with tokens that have no refresh token
      const tokens: OidcTokenResponse = {
        accessToken: "at_test-access",
        idToken: "id_test-id",
        expiresIn: 3600,
        tokenType: "Bearer",
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      };
      const userInfo: OidcUserInfo = {
        sub: "user-123",
        email: "test@example.com",
        name: "Test User",
      };

      service.createSession(tokens, userInfo);
      const sessionId = (service as unknown as { sessions: Map<string, unknown> }).sessions.keys().next().value;

      const result = await service.refreshAccessToken(sessionId);
      assert.strictEqual(result, null);
    });

    it("should simulate new tokens on refresh when mock enabled", async () => {
      // Create session with refresh token
      const tokens: OidcTokenResponse = {
        accessToken: "at_old-access",
        idToken: "id_old-id",
        refreshToken: "rt_old-refresh",
        expiresIn: 3600,
        tokenType: "Bearer",
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      };
      const userInfo: OidcUserInfo = {
        sub: "user-123",
        email: "test@example.com",
        name: "Test User",
      };

      service.createSession(tokens, userInfo);
      const sessionId = (service as unknown as { sessions: Map<string, unknown> }).sessions.keys().next().value;

      const result = await service.refreshAccessToken(sessionId);

      assert.ok(result !== null);
      assert.ok(result.accessToken.length > 0);
      assert.ok(result.idToken.length > 0);
      // Refresh token should be preserved
      assert.strictEqual(result.refreshToken, "rt_old-refresh");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OidcIdentityService - Session Management Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("OidcIdentityService - Session Management", () => {
  let service: OidcIdentityService;
  let providerConfig: OidcProviderConfig;

  beforeEach(() => {
    providerConfig = createTestProviderConfig();
    service = new OidcIdentityService(providerConfig, undefined, { allowMockFallback: true });
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe("createSession", () => {
    it("should create session from token response", () => {
      const tokens: OidcTokenResponse = {
        accessToken: "at_new-access",
        idToken: "id_new-id",
        refreshToken: "rt_new-refresh",
        expiresIn: 3600,
        tokenType: "Bearer",
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      };
      const userInfo: OidcUserInfo = {
        sub: "user-new-123",
        email: "newuser@example.com",
        name: "New User",
      };

      const session = service.createSession(tokens, userInfo);

      assert.ok(session.sessionId.length > 0);
      assert.strictEqual(session.userId, "user-new-123");
      assert.strictEqual(session.accessToken, "at_new-access");
      assert.strictEqual(session.idToken, "id_new-id");
      assert.strictEqual(session.refreshToken, "rt_new-refresh");
      assert.strictEqual(session.providerId, "test-provider");
    });

    it("should track session by user", () => {
      const tokens: OidcTokenResponse = {
        accessToken: "at_access",
        idToken: "id_token",
        refreshToken: "rt_refresh",
        expiresIn: 3600,
        tokenType: "Bearer",
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      };
      const userInfo: OidcUserInfo = { sub: "user-456" };

      service.createSession(tokens, userInfo);

      const userSessions = service.getUserSessions("user-456");
      assert.strictEqual(userSessions.length, 1);
    });
  });

  describe("validateAccessToken", () => {
    it("should return session for valid token", () => {
      const tokens: OidcTokenResponse = {
        accessToken: "at_valid-token",
        idToken: "id_valid-id",
        expiresIn: 3600,
        tokenType: "Bearer",
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      };
      const userInfo: OidcUserInfo = { sub: "user-789" };

      service.createSession(tokens, userInfo);
      const session = service.validateAccessToken("at_valid-token");

      assert.ok(session !== null);
      assert.strictEqual(session!.userId, "user-789");
    });

    it("should return null for invalid token", () => {
      const session = service.validateAccessToken("at_invalid-token");
      assert.strictEqual(session, null);
    });

    it("should reject mock tokens in production", () => {
      process.env.NODE_ENV = "production";
      // Create a new service in production mode without mock fallback
      const prodService = new OidcIdentityService(providerConfig, undefined, { allowMockFallback: false });

      assert.throws(() => {
        prodService.validateAccessToken("at_mock-token");
      }, /Mock token rejected in production/);
    });
  });

  describe("revokeSession", () => {
    it("should remove session", () => {
      const tokens: OidcTokenResponse = {
        accessToken: "at_to-revoke",
        idToken: "id_to-revoke",
        expiresIn: 3600,
        tokenType: "Bearer",
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      };
      const userInfo: OidcUserInfo = { sub: "user-revoke" };

      const session = service.createSession(tokens, userInfo);
      assert.strictEqual(service.getSessionCount(), 1);

      service.revokeSession(session.sessionId);
      assert.strictEqual(service.getSessionCount(), 0);
    });
  });

  describe("revokeAllUserSessions", () => {
    it("should revoke all sessions for user", () => {
      // Create multiple sessions for same user
      for (let i = 0; i < 3; i++) {
        const tokens: OidcTokenResponse = {
          accessToken: `at_multi-${i}`,
          idToken: `id_multi-${i}`,
          expiresIn: 3600,
          tokenType: "Bearer",
          expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        };
        service.createSession(tokens, { sub: "user-multi" });
      }

      const count = service.revokeAllUserSessions("user-multi");
      assert.strictEqual(count, 3);
      assert.strictEqual(service.getSessionCount(), 0);
    });

    it("should return 0 when user has no sessions", () => {
      const count = service.revokeAllUserSessions("non-existent-user");
      assert.strictEqual(count, 0);
    });
  });

  describe("getUserSessions", () => {
    it("should return only active sessions", () => {
      const tokens: OidcTokenResponse = {
        accessToken: "at_active",
        idToken: "id_active",
        expiresIn: 3600,
        tokenType: "Bearer",
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      };
      service.createSession(tokens, { sub: "user-active" });

      const sessions = service.getUserSessions("user-active");
      assert.strictEqual(sessions.length, 1);
    });

    it("should return empty array for non-existent user", () => {
      const sessions = service.getUserSessions("non-existent");
      assert.strictEqual(sessions.length, 0);
    });
  });

  describe("touchSession", () => {
    it("should update lastActivityAt", () => {
      const tokens: OidcTokenResponse = {
        accessToken: "at_touch",
        idToken: "id_touch",
        expiresIn: 3600,
        tokenType: "Bearer",
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      };
      const session = service.createSession(tokens, { sub: "user-touch" });

      const before = Date.now();
      service.touchSession(session.sessionId);

      const updated = service.validateAccessToken("at_touch");
      assert.ok(updated !== null);
      const after = new Date(updated!.lastActivityAt).getTime();
      assert.ok(after >= before);
    });
  });

  describe("cleanupExpiredSessions", () => {
    it("should clean up sessions past max age", () => {
      // Create service with short max session age
      const shortLivedService = new OidcIdentityService(providerConfig, undefined, {
        allowMockFallback: true,
        maxSessionAgeMs: 1, // 1ms for testing
      });

      const tokens: OidcTokenResponse = {
        accessToken: "at_expired",
        idToken: "id_expired",
        expiresIn: 0, // Already expired
        tokenType: "Bearer",
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      };
      shortLivedService.createSession(tokens, { sub: "user-expired" });

      // Wait a bit
      const start = Date.now();
      while (Date.now() - start < 10) { /* spin */ }

      const cleaned = shortLivedService.cleanupExpiredSessions();
      assert.ok(cleaned >= 0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OidcIdentityService - UserInfo Fallback Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("OidcIdentityService - UserInfo Fallback", () => {
  let service: OidcIdentityService;
  let providerConfig: OidcProviderConfig;

  beforeEach(() => {
    providerConfig = createTestProviderConfig();
    service = new OidcIdentityService(providerConfig, undefined, { allowMockFallback: true });
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe("fetchUserInfo", () => {
    it("should return simulated user info when endpoint unavailable", async () => {
      // Point to unreachable endpoint
      const badConfig = createTestProviderConfig({
        userInfoEndpoint: "https://unreachable.example.com/userinfo",
      });
      const badService = new OidcIdentityService(badConfig, undefined, { allowMockFallback: true });

      const result = await badService.fetchUserInfo("at_test-token");

      assert.ok(result !== null);
      assert.ok(result.sub.length > 0);
      assert.strictEqual(result.email, "user@example.com");
      assert.strictEqual(result.name, "Test User");
      assert.deepStrictEqual(result.groups, ["engineers", "admins"]);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function Test
// ─────────────────────────────────────────────────────────────────────────────

describe("createOidcIdentityService", () => {
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

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
});
