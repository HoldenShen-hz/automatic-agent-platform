/**
 * OIDC Identity Provider Service
 *
 * Implements OpenID Connect authorization code flow for enterprise IdP integration.
 * Supports token exchange, user info retrieval, and session management.
 *
 * Architecture: §48 SSO/SCIM - P0 OIDC Integration
 * @see docs_zh/architecture/00-platform-architecture.md §48
 */

import { timingSafeEqual } from "node:crypto";
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

export function toOidcSession(record: SessionRecord): OidcSession {
  const result: OidcSession = {
    sessionId: record.sessionId,
    userId: record.userId,
    accessToken: record.accessToken,
    idToken: record.idToken,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
    lastActivityAt: record.lastActivityAt,
    providerId: record.providerId,
  };
  if (record.refreshToken !== undefined) {
    (result as { refreshToken?: string }).refreshToken = record.refreshToken;
  }
  return result;
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
  /** §48: Disable mock fallback in production */
  readonly allowMockFallback: boolean;
  /** Maximum concurrent sessions per user to prevent unbounded session growth */
  readonly maxSessionsPerUser: number;
}

const DEFAULT_CONFIG: OidcServiceConfig = {
  sessionTtlMs: 3600000, // 1 hour
  refreshThresholdMs: 300000, // 5 minutes
  maxSessionAgeMs: 86400000, // 24 hours
  allowMockFallback: false, // §48: Disabled in production
  maxSessionsPerUser: 5, // §48: Prevent unbounded session growth per user
};

/**
 * §48: Check if the current environment is production.
 * Uses NODE_ENV environment variable.
 */
function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * §48: Validates that a token is not a mock token in production.
 * Mock tokens are identified by prefixes: "at_", "id_", "rt_".
 *
 * @param token - Token to validate
 * @throws Error if token appears to be mock and environment is production
 */
function validateProductionToken(token: string): void {
  if (!isProductionEnvironment()) {
    return; // Allow mock tokens in non-production
  }

  const mockPrefixes = ["at_", "id_", "rt_"];
  for (const prefix of mockPrefixes) {
    if (token.startsWith(prefix)) {
      throw new Error(
        `§48 Production Hardening: Mock token rejected in production environment. ` +
        `Token prefix "${prefix}" indicates simulated authentication. ` +
        `Ensure OIDC provider is properly configured with valid credentials.`,
      );
    }
  }
}

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
  // SECURITY FIX: Add secondary index from accessToken to sessionId for O(1) lookup
  private readonly accessTokenIndex = new Map<string, string>();
  private readonly userSessions = new Map<string, Set<string>>();
  private readonly stateStore: OidcStateStore;
  // §48 P0: PKCE code verifier store for OAuth 2.0 PKCE flow
  private readonly pkceVerifierStore = new Map<string, string>();

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

    // §48 P0: Retrieve PKCE code verifier for token exchange
    // PKCE verifier is stored when authorization URL is built
    const codeVerifier = this.pkceVerifierStore.get(expectedState);
    this.pkceVerifierStore.delete(expectedState);

    return this.exchangeTokens({
      grantType: "authorization_code",
      code,
      redirectUri: stateData.redirectUri,
      nonce: stateData.nonce,
      codeVerifier,
    });
  }

  /**
   * Fetches user info from the IdP.
   *
   * @param accessToken - Valid access token
   * @returns User info or null if fetch fails
   */
  public async fetchUserInfo(accessToken: string): Promise<OidcUserInfo | null> {
    const userInfoEndpoint = this.providerConfig.userInfoEndpoint ?? `${this.providerConfig.issuer}/userinfo`;
    try {
      const response = await fetch(userInfoEndpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });
      if (!response.ok) {
        // SECURITY FIX: Do not fall back to mock user info when allowMockFallback is disabled.
        // In production, this prevents an attacker from using a valid access token to get
        // a mock admin user instead of failing.
        if (!this.config.allowMockFallback) {
          throw new Error(`oidc.userinfo_fetch_failed:${response.status}`);
        }
        return this.simulateUserInfo(accessToken);
      }
      const payload = await response.json() as Record<string, unknown>;
      return {
        sub: String(payload.sub ?? newId("user")),
        ...(typeof payload.email === "string" ? { email: payload.email } : {}),
        ...(typeof payload.name === "string" ? { name: payload.name } : {}),
        ...(typeof payload.given_name === "string" ? { givenName: payload.given_name } : {}),
        ...(typeof payload.family_name === "string" ? { familyName: payload.family_name } : {}),
        ...(typeof payload.preferred_username === "string" ? { preferredUsername: payload.preferred_username } : {}),
        ...(Array.isArray(payload.groups) ? { groups: payload.groups.filter((item): item is string => typeof item === "string") } : {}),
        updatedAt: nowIso(),
      };
    } catch (err) {
      // SECURITY FIX: Do not fall back to mock user info when allowMockFallback is disabled.
      if (!this.config.allowMockFallback) {
        throw err;
      }
      return this.simulateUserInfo(accessToken);
    }
  }

  /**
   * Validates an access token and returns associated session.
   *
   * @param accessToken - Token to validate
   * @returns Session if valid, null otherwise
   */
  public validateAccessToken(accessToken: string): OidcSession | null {
    // §48: Check for mock tokens in production
    if (isProductionEnvironment()) {
      validateProductionToken(accessToken);
    }

    // SECURITY FIX: Use O(1) index lookup instead of O(n) linear scan
    const sessionId = this.accessTokenIndex.get(accessToken);
    if (!sessionId) return null;
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Verify token matches using timing-safe comparison
    const accessTokenBuffer = Buffer.from(accessToken, "utf8");
    const sessionTokenBuffer = Buffer.from(session.accessToken, "utf8");
    if (sessionTokenBuffer.length !== accessTokenBuffer.length ||
        !timingSafeEqual(sessionTokenBuffer, accessTokenBuffer)) {
      return null;
    }
    if (Date.now() > new Date(session.expiresAt).getTime()) {
      this.revokeSession(session.sessionId);
      return null;
    }
    return toOidcSession(session);
  }

  /**
   * Creates a new session from token response.
   * SECURITY: Enforces maximum concurrent sessions per user to prevent unbounded growth.
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

    // SECURITY FIX: Enforce maximum concurrent sessions per user.
    // If user has too many sessions, revoke the oldest ones to make room.
    const userSessionIds = this.userSessions.get(userInfo.sub);
    if (userSessionIds) {
      while (userSessionIds.size >= this.config.maxSessionsPerUser) {
        // Find and revoke the oldest session
        let oldestSessionId: string | null = null;
        let oldestCreatedAt = Infinity;
        for (const sid of userSessionIds) {
          const session = this.sessions.get(sid);
          if (session) {
            const createdAt = new Date(session.createdAt).getTime();
            if (createdAt < oldestCreatedAt) {
              oldestCreatedAt = createdAt;
              oldestSessionId = sid;
            }
          }
        }
        if (oldestSessionId) {
          this.revokeSession(oldestSessionId);
          userSessionIds.delete(oldestSessionId);
        } else {
          break; // Should not happen but safety break
        }
      }
    }

    this.sessions.set(sessionId, record);
    // SECURITY FIX: Maintain accessToken -> sessionId index for O(1) token validation
    this.accessTokenIndex.set(tokens.accessToken, sessionId);

    if (!this.userSessions.has(userInfo.sub)) {
      this.userSessions.set(userInfo.sub, new Set());
    }
    this.userSessions.get(userInfo.sub)!.add(sessionId);

    return toOidcSession(record);
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

    // §48 P0: Token rotation - remember old refresh token to detect token replay (issue #1971)
    const oldRefreshToken = session.refreshToken;

    const newTokens = await this.exchangeTokens({
      grantType: "refresh_token",
      refreshToken: session.refreshToken,
    }) ?? this.simulateRefreshResponse(session.refreshToken);

    // §48 P0: Token rotation - invalidate old refresh token after successful refresh
    // Per RFC 6749 §5.2, old refresh token should be invalidated after use to prevent replay
    // Invalidate old refresh token from index
    this.refreshTokenIndex.delete(oldRefreshToken);

    // Update session with new tokens - including new refresh token for rotation
    session.accessToken = newTokens.accessToken;
    session.idToken = newTokens.idToken;
    session.refreshToken = newTokens.refreshToken ?? oldRefreshToken;
    session.expiresAt = newTokens.expiresAt;
    session.lastActivityAt = nowIso();

    // Update refresh token index with new refresh token
    if (session.refreshToken) {
      this.refreshTokenIndex.set(session.refreshToken, sessionId);
    }

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
    // SECURITY FIX: Clean up accessTokenIndex to prevent stale entries
    this.accessTokenIndex.delete(session.accessToken);

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
        activeSessions.push(toOidcSession(session));
      }
    }

    return activeSessions;
  }

  /**
   * Updates last activity timestamp for a session.
   * SECURITY: Implements sliding window expiration by extending expiresAt on activity.
   *
   * @param sessionId - Session ID
   */
  public touchSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivityAt = nowIso();
      // SECURITY FIX: Extend session expiration for sliding window expiry.
      // This prevents active sessions from expiring while in use.
      const currentExpiresAt = new Date(session.expiresAt).getTime();
      const maxExpiresAt = new Date(session.createdAt).getTime() + this.config.maxSessionAgeMs;
      const newExpiresAt = Math.min(currentExpiresAt + this.config.sessionTtlMs, maxExpiresAt);
      session.expiresAt = new Date(newExpiresAt).toISOString();
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
    const authorizationEndpoint = this.providerConfig.authorizationEndpoint ?? `${this.providerConfig.issuer}/authorize`;
    // §48 P0: Add PKCE support to prevent authorization code interception (issue #1969).
    // PKCE is required for public clients and recommended for all OIDC flows.
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    // Store code verifier for later token exchange using state as key
    this.pkceVerifierStore.set(state, codeVerifier);
    return (
      `${authorizationEndpoint}` +
      `?client_id=${encodeURIComponent(this.providerConfig.clientId)}` +
      `&redirect_uri=${encodeURIComponent(this.providerConfig.redirectUri)}` +
      `&response_type=code` +
      `&scope=${scopes}` +
      `&state=${encodeURIComponent(state)}` +
      `&nonce=${encodeURIComponent(nonce)}` +
      `&code_challenge=${encodeURIComponent(codeChallenge)}` +
      `&code_challenge_method=S256`
    );
  }

  /**
   * Generates PKCE code verifier for OAuth 2.0 PKCE flow.
   * §48 P0: PKCE prevents authorization code interception attacks.
   */
  private generateCodeVerifier(): string {
    const { randomBytes } = require("node:crypto");
    return randomBytes(32).toString("base64url");
  }

  /**
   * Generates PKCE code challenge from verifier using S256 method.
   * §48 P0: PKCE prevents authorization code interception attacks.
   */
  private generateCodeChallenge(verifier: string): string {
    const { createHash } = require("node:crypto");
    return createHash("sha256").update(verifier).digest("base64url");
  }

  private async exchangeTokens(input: {
    grantType: "authorization_code" | "refresh_token";
    code?: string;
    redirectUri?: string;
    refreshToken?: string;
    nonce?: string;
    codeVerifier?: string;
  }): Promise<OidcTokenResponse | null> {
    const tokenEndpoint = this.providerConfig.tokenEndpoint ?? `${this.providerConfig.issuer}/token`;
    const body = new URLSearchParams({
      grant_type: input.grantType,
      client_id: this.providerConfig.clientId,
      ...(this.providerConfig.clientSecret ? { client_secret: this.providerConfig.clientSecret } : {}),
      ...(input.code ? { code: input.code } : {}),
      ...(input.redirectUri ? { redirect_uri: input.redirectUri } : {}),
      ...(input.refreshToken ? { refresh_token: input.refreshToken } : {}),
      ...(input.nonce ? { nonce: input.nonce } : {}),
      // §48 P0: Include PKCE code_verifier for token exchange (required for authorization_code grant with PKCE)
      ...(input.codeVerifier ? { code_verifier: input.codeVerifier } : {}),
    });
    try {
      const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          accept: "application/json",
        },
        body: body.toString(),
      });
      if (!response.ok) {
        // §48 Production Hardening: Check if mock fallback is allowed
        if (!this.config.allowMockFallback) {
          throw new Error(
            `§48 Production Hardening: Token exchange failed with status ${response.status}. ` +
            `Mock fallback is disabled. Configure valid OIDC provider credentials.`,
          );
        }
        return input.grantType === "authorization_code"
          ? this.simulateTokenResponse(input.code ?? "", input.nonce ?? "")
          : this.simulateRefreshResponse(input.refreshToken ?? "");
      }
      const payload = await response.json() as Record<string, unknown>;
      const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : 3600;

      // §48: Validate tokens are not mock in production
      const accessToken = String(payload.access_token ?? "");
      const idToken = String(payload.id_token ?? "");
      validateProductionToken(accessToken);
      validateProductionToken(idToken);

      return {
        accessToken,
        idToken,
        ...(typeof payload.refresh_token === "string" ? { refreshToken: payload.refresh_token } : {}),
        expiresIn,
        tokenType: typeof payload.token_type === "string" ? payload.token_type : "Bearer",
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      };
    } catch (err) {
      // §48: If in production and mock fallback disabled, propagate error
      if (!this.config.allowMockFallback && isProductionEnvironment()) {
        throw err;
      }
      // In non-production, fall back to mock tokens
      return input.grantType === "authorization_code"
        ? this.simulateTokenResponse(input.code ?? "", input.nonce ?? "")
        : this.simulateRefreshResponse(input.refreshToken ?? "");
    }
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
