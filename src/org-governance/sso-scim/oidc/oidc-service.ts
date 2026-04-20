/**
 * OIDC Identity Provider Service
 *
 * Implements OpenID Connect authorization code flow for enterprise IdP integration.
 * Supports token exchange, user info retrieval, and session management.
 *
 * Architecture: §48 SSO/SCIM - P0 OIDC Integration
 * @see docs_zh/architecture/00-platform-architecture.md §48
 */

import { newId, nowIso } from "../../../platform/contracts/types/ids.js";
import type { OidcProviderConfig } from "./index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface OidcTokenResponse {
  readonly accessToken: string;
  readonly idToken: string;
  readonly refreshToken?: string;
  readonly expiresIn: number;
  readonly tokenType: string;
  readonly expiresAt: string;
}

export interface OidcUserInfo {
  readonly sub: string;
  readonly email?: string;
  readonly name?: string;
  readonly givenName?: string;
  readonly familyName?: string;
  readonly preferredUsername?: string;
  readonly groups?: readonly string[];
  readonly updatedAt?: string;
}

export interface OidcSession {
  readonly sessionId: string;
  readonly userId: string;
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly idToken: string;
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly lastActivityAt: string;
  readonly providerId: string;
}

export interface OidcStateStore {
  saveState(state: string, nonce: string, redirectUri: string): void;
  getState(state: string): { nonce: string; redirectUri: string } | null;
  deleteState(state: string): void;
}

export interface OidcServiceConfig {
  readonly sessionTtlMs: number;
  readonly refreshThresholdMs: number;
  readonly maxSessionAgeMs: number;
}

const DEFAULT_CONFIG: OidcServiceConfig = {
  sessionTtlMs: 3600000, // 1 hour
  refreshThresholdMs: 300000, // 5 minutes
  maxSessionAgeMs: 86400000, // 24 hours
};

// ─────────────────────────────────────────────────────────────────────────────
// In-Memory State Store (for development; use Redis in production)
// ─────────────────────────────────────────────────────────────────────────────

export class InMemoryOidcStateStore implements OidcStateStore {
  private readonly store = new Map<string, { nonce: string; redirectUri: string; expiresAt: number }>();

  public saveState(state: string, nonce: string, redirectUri: string): void {
    this.store.set(state, {
      nonce,
      redirectUri,
      expiresAt: Date.now() + 600000, // 10 minutes
    });
  }

  public getState(state: string): { nonce: string; redirectUri: string } | null {
    const entry = this.store.get(state);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(state);
      return null;
    }
    return { nonce: entry.nonce, redirectUri: entry.redirectUri };
  }

  public deleteState(state: string): void {
    this.store.delete(state);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OIDC Identity Provider Service
// ─────────────────────────────────────────────────────────────────────────────

interface SessionRecord {
  sessionId: string;
  userId: string;
  accessToken: string;
  refreshToken: string | undefined;
  idToken: string;
  expiresAt: string;
  createdAt: string;
  lastActivityAt: string;
  providerId: string;
}

export class OidcIdentityService {
  private readonly config: OidcServiceConfig;
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly userSessions = new Map<string, Set<string>>();
  private readonly stateStore: OidcStateStore;

  constructor(
    private readonly providerConfig: OidcProviderConfig,
    stateStore?: OidcStateStore,
    config?: Partial<OidcServiceConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stateStore = stateStore ?? new InMemoryOidcStateStore();
  }

  /**
   * Initiates OIDC authorization code flow.
   *
   * @param redirectUri - URI to redirect back after auth
   * @returns Authorization URL and state for verification
   */
  public initiateFlow(redirectUri: string): { authorizationUrl: string; state: string; nonce: string } {
    const state = newId("oidc_state");
    const nonce = newId("oidc_nonce");

    this.stateStore.saveState(state, nonce, redirectUri);

    const authorizationUrl = this.buildAuthorizationUrl(state, nonce);

    return { authorizationUrl, state, nonce };
  }

  /**
   * Exchanges authorization code for tokens.
   *
   * @param code - Authorization code
   * @param expectedState - State parameter for CSRF protection
   * @returns Token response or null if exchange fails
   */
  public async exchangeCodeForTokens(code: string, expectedState: string): Promise<OidcTokenResponse | null> {
    const stateData = this.stateStore.getState(expectedState);
    if (!stateData) {
      return null;
    }
    this.stateStore.deleteState(expectedState);

    // In production, this would make an HTTP request to the IdP token endpoint
    // For now, we simulate a successful token response
    const tokenResponse = this.simulateTokenResponse(code, stateData.nonce);

    return tokenResponse;
  }

  /**
   * Fetches user info from the IdP.
   *
   * @param accessToken - Valid access token
   * @returns User info or null if fetch fails
   */
  public async fetchUserInfo(accessToken: string): Promise<OidcUserInfo | null> {
    // In production, this would make an HTTP request to the IdP userinfo endpoint
    // For now, we simulate a successful userinfo response
    return this.simulateUserInfo(accessToken);
  }

  /**
   * Validates an access token and returns associated session.
   *
   * @param accessToken - Token to validate
   * @returns Session if valid, null otherwise
   */
  public validateAccessToken(accessToken: string): OidcSession | null {
    for (const session of this.sessions.values()) {
      if (session.accessToken === accessToken) {
        if (Date.now() > new Date(session.expiresAt).getTime()) {
          this.revokeSession(session.sessionId);
          return null;
        }
        return session;
      }
    }
    return null;
  }

  /**
   * Creates a new session from token response.
   *
   * @param tokens - Token response from IdP
   * @param userInfo - User info from IdP
   * @returns Created session
   */
  public createSession(tokens: OidcTokenResponse, userInfo: OidcUserInfo): OidcSession {
    const sessionId = newId("oidc_session");
    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();

    const record: SessionRecord = {
      sessionId,
      userId: userInfo.sub,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      idToken: tokens.idToken,
      expiresAt,
      createdAt: nowIso(),
      lastActivityAt: nowIso(),
      providerId: this.providerConfig.providerId,
    };

    this.sessions.set(sessionId, record);

    if (!this.userSessions.has(userInfo.sub)) {
      this.userSessions.set(userInfo.sub, new Set());
    }
    this.userSessions.get(userInfo.sub)!.add(sessionId);

    return record;
  }

  /**
   * Refreshes an expired access token using refresh token.
   *
   * @param sessionId - Session ID to refresh
   * @returns New tokens or null if refresh fails
   */
  public async refreshAccessToken(sessionId: string): Promise<OidcTokenResponse | null> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.refreshToken) {
      return null;
    }

    // In production, this would call the IdP token endpoint with grant_type=refresh_token
    const newTokens = this.simulateRefreshResponse(session.refreshToken);

    // Update session with new tokens
    session.accessToken = newTokens.accessToken;
    session.idToken = newTokens.idToken;
    session.expiresAt = newTokens.expiresAt;
    session.lastActivityAt = nowIso();

    return newTokens;
  }

  /**
   * Revokes a session.
   *
   * @param sessionId - Session ID to revoke
   */
  public revokeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.sessions.delete(sessionId);

    const userSessionSet = this.userSessions.get(session.userId);
    if (userSessionSet) {
      userSessionSet.delete(sessionId);
      if (userSessionSet.size === 0) {
        this.userSessions.delete(session.userId);
      }
    }
  }

  /**
   * Revokes all sessions for a user.
   *
   * @param userId - User ID
   * @returns Number of sessions revoked
   */
  public revokeAllUserSessions(userId: string): number {
    const sessionIds = this.userSessions.get(userId);
    if (!sessionIds) return 0;

    const count = sessionIds.size;
    for (const sessionId of sessionIds) {
      this.sessions.delete(sessionId);
    }
    this.userSessions.delete(userId);

    return count;
  }

  /**
   * Gets active sessions for a user.
   *
   * @param userId - User ID
   * @returns Array of active sessions
   */
  public getUserSessions(userId: string): OidcSession[] {
    const sessionIds = this.userSessions.get(userId);
    if (!sessionIds) return [];

    const activeSessions: OidcSession[] = [];

    for (const sessionId of sessionIds) {
      const session = this.sessions.get(sessionId);
      if (session && Date.now() <= new Date(session.expiresAt).getTime()) {
        activeSessions.push(session);
      }
    }

    return activeSessions;
  }

  /**
   * Updates last activity timestamp for a session.
   *
   * @param sessionId - Session ID
   */
  public touchSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivityAt = nowIso();
    }
  }

  /**
   * Gets the number of active sessions.
   */
  public getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Cleans up expired sessions.
   *
   * @returns Number of sessions cleaned up
   */
  public cleanupExpiredSessions(): number {
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (Date.now() > new Date(session.expiresAt).getTime() + this.config.maxSessionAgeMs) {
        this.revokeSession(sessionId);
        cleaned++;
      }
    }

    return cleaned;
  }

  // ─── Private Methods ─────────────────────────────────────────────────────

  private buildAuthorizationUrl(state: string, nonce: string): string {
    const scopes = encodeURIComponent(this.providerConfig.scopes.join(" "));
    return (
      `${this.providerConfig.issuer}/authorize` +
      `?client_id=${encodeURIComponent(this.providerConfig.clientId)}` +
      `&redirect_uri=${encodeURIComponent(this.providerConfig.redirectUri)}` +
      `&response_type=code` +
      `&scope=${scopes}` +
      `&state=${encodeURIComponent(state)}` +
      `&nonce=${encodeURIComponent(nonce)}`
    );
  }

  private simulateTokenResponse(code: string, nonce: string): OidcTokenResponse {
    const expiresIn = 3600;
    return {
      accessToken: `at_${newId("access")}`,
      idToken: `id_${newId("id")}`,
      refreshToken: `rt_${newId("refresh")}`,
      expiresIn,
      tokenType: "Bearer",
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }

  private simulateUserInfo(accessToken: string): OidcUserInfo {
    return {
      sub: newId("user"),
      email: "user@example.com",
      name: "Test User",
      givenName: "Test",
      familyName: "User",
      preferredUsername: "testuser",
      groups: ["engineers", "admins"],
    };
  }

  private simulateRefreshResponse(refreshToken: string): OidcTokenResponse {
    const expiresIn = 3600;
    return {
      accessToken: `at_${newId("access")}`,
      idToken: `id_${newId("id")}`,
      refreshToken,
      expiresIn,
      tokenType: "Bearer",
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────

export function createOidcIdentityService(
  providerConfig: OidcProviderConfig,
  stateStore?: OidcStateStore,
  config?: Partial<OidcServiceConfig>,
): OidcIdentityService {
  return new OidcIdentityService(providerConfig, stateStore, config);
}
