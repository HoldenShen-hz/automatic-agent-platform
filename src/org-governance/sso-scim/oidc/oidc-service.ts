/**
 * OIDC Identity Provider Service
 *
 * Implements OpenID Connect authorization code flow for enterprise IdP integration.
 * Supports token exchange, user info retrieval, and session management.
 *
 * Architecture: §48 SSO/SCIM - P0 OIDC Integration
 * @see docs_zh/architecture/00-platform-architecture.md §48
 */

import { createHash, randomBytes } from "node:crypto";
import { newId, nowIso } from "../../../platform/contracts/types/ids.js";
import type { OidcProviderConfig } from "./index.js";

// ─────────────────────────────────────────────────────────────────────────────
// PKCE Support (RFC 7636)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a cryptographically random PKCE code verifier.
 * @returns Base64url-encoded random string (43-128 chars per RFC 7636)
 */
function generateCodeVerifier(): string {
  // 43 chars per RFC 7636 - URL-safe base64 without padding
  return randomBytes(32)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Derives the S256 PKCE code challenge from a verifier.
 * @param verifier - Raw code verifier
 * @returns Base64url-encoded SHA256 hash
 */
function deriveCodeChallenge(verifier: string): string {
  const hash = createHash("sha256")
    .update(verifier)
    .digest();
  return hash
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

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
  saveState(state: string, nonce: string, redirectUri: string, codeVerifier: string): void;
  getState(state: string): { nonce: string; redirectUri: string; codeVerifier: string } | null;
  deleteState(state: string): void;
}

export interface OidcServiceConfig {
  readonly sessionTtlMs: number;
  readonly refreshThresholdMs: number;
  readonly maxSessionAgeMs: number;
  /** §48: Disable mock fallback in production */
  readonly allowMockFallback: boolean;
}

const DEFAULT_CONFIG: OidcServiceConfig = {
  sessionTtlMs: 3600000, // 1 hour
  refreshThresholdMs: 300000, // 5 minutes
  maxSessionAgeMs: 86400000, // 24 hours
  allowMockFallback: false, // §48: Disabled in production
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
  private readonly store = new Map<string, { nonce: string; redirectUri: string; codeVerifier: string; expiresAt: number }>();

  public saveState(state: string, nonce: string, redirectUri: string, codeVerifier: string): void {
    this.store.set(state, {
      nonce,
      redirectUri,
      codeVerifier,
      expiresAt: Date.now() + 600000, // 10 minutes
    });
  }

  public getState(state: string): { nonce: string; redirectUri: string; codeVerifier: string } | null {
    const entry = this.store.get(state);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(state);
      return null;
    }
    return { nonce: entry.nonce, redirectUri: entry.redirectUri, codeVerifier: entry.codeVerifier };
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
  /** §48 Token Rotation: identifies the refresh token family for reuse detection */
  refreshTokenFamily?: string;
}

export class OidcIdentityService {
  private readonly config: OidcServiceConfig;
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly userSessions = new Map<string, Set<string>>();
  private readonly stateStore: OidcStateStore;
  /** §48 Token Rotation: tracks which refresh token families are still valid */
  private readonly refreshTokenFamilies = new Map<string, string>(); // familyId -> currentValidToken

  constructor(
    private readonly providerConfig: OidcProviderConfig,
    stateStore?: OidcStateStore,
    config?: Partial<OidcServiceConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stateStore = stateStore ?? new InMemoryOidcStateStore();
  }

  /**
   * Initiates OIDC authorization code flow with PKCE (RFC 7636).
   *
   * @param redirectUri - URI to redirect back after auth
   * @returns Authorization URL, state, nonce, and code verifier (for verification)
   */
  public initiateFlow(redirectUri: string): { authorizationUrl: string; state: string; nonce: string; codeVerifier: string } {
    const state = newId("oidc_state");
    const nonce = newId("oidc_nonce");
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = deriveCodeChallenge(codeVerifier);

    this.stateStore.saveState(state, nonce, redirectUri, codeVerifier);

    const authorizationUrl = this.buildAuthorizationUrl(state, nonce, codeChallenge);

    return { authorizationUrl, state, nonce, codeVerifier };
  }

  /**
   * Exchanges authorization code for tokens with PKCE verification.
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

    return this.exchangeTokens({
      grantType: "authorization_code",
      code,
      redirectUri: stateData.redirectUri,
      nonce: stateData.nonce,
      codeVerifier: stateData.codeVerifier,
    });
  }

  /**
   * Fetches user info from the IdP.
   *
   * @param accessToken - Valid access token
   * @returns User info
   * @throws Error if fetch fails and allowMockFallback is false
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
        // §48 Production Hardening: userinfo failure should propagate as error
        // instead of silently falling back to mock admin user
        if (!this.config.allowMockFallback) {
          throw new Error(
            `oidc.userinfo_fetch_failed:${response.status} ` +
            `§48 Production Hardening: UserInfo endpoint returned ${response.status}. ` +
            `Mock fallback is disabled. Configure valid OIDC provider credentials or enable allowMockFallback for testing.`,
          );
        }
        return null;
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
      // §48: If mock fallback is disabled, propagate error
      if (!this.config.allowMockFallback) {
        throw err;
      }
      return null;
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

    for (const session of this.sessions.values()) {
      if (session.accessToken === accessToken) {
        if (Date.now() > new Date(session.expiresAt).getTime()) {
          this.revokeSession(session.sessionId);
          return null;
        }
        return toOidcSession(session);
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

    // §48 Token Rotation: create a new family for this refresh token lineage
    const refreshTokenFamily = tokens.refreshToken ? newId("rt_family") : undefined;
    if (tokens.refreshToken) {
      this.refreshTokenFamilies.set(refreshTokenFamily!, tokens.refreshToken);
    }

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
      refreshTokenFamily,
    };

    this.sessions.set(sessionId, record);

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

    // §48 Token Rotation: detect reuse attack - if token already rotated, this is a replay
    const family = session.refreshTokenFamily;
    if (family) {
      const currentValidToken = this.refreshTokenFamilies.get(family);
      if (currentValidToken !== session.refreshToken) {
        // Token reuse detected - possible attack, revoke entire session
        this.revokeSession(sessionId);
        return null;
      }
    }

    const newTokens = await this.exchangeTokens({
      grantType: "refresh_token",
      refreshToken: session.refreshToken,
    }) ?? this.simulateRefreshResponse(session.refreshToken);

    // §48 Token Rotation: invalidate old refresh token and register new one
    if (newTokens.refreshToken) {
      // Invalidate the old token
      if (family) {
        this.refreshTokenFamilies.delete(family);
      }
      // Register new refresh token in the family
      const newFamily = family ?? newId("rt_family");
      this.refreshTokenFamilies.set(newFamily, newTokens.refreshToken);
      session.refreshTokenFamily = newFamily;
    }

    // Update session with new tokens
    session.accessToken = newTokens.accessToken;
    session.idToken = newTokens.idToken;
    session.refreshToken = newTokens.refreshToken;
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
        activeSessions.push(toOidcSession(session));
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
    const now = Date.now();

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > new Date(session.expiresAt).getTime()) {
        this.revokeSession(sessionId);
        cleaned++;
      }
    }

    return cleaned;
  }

  // ─── Private Methods ─────────────────────────────────────────────────────

  private buildAuthorizationUrl(state: string, nonce: string, codeChallenge: string): string {
    const scopes = encodeURIComponent(this.providerConfig.scopes.join(" "));
    const authorizationEndpoint = this.providerConfig.authorizationEndpoint ?? `${this.providerConfig.issuer}/authorize`;
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

      const newRefreshToken = input.grantType === "refresh_token"
        ? `rt_${newId("refresh")}` // §48 Token Rotation: always issue new refresh token on refresh grant
        : (typeof payload.refresh_token === "string" ? payload.refresh_token : undefined);

      return {
        accessToken,
        idToken,
        ...(newRefreshToken ? { refreshToken: newRefreshToken } : {}),
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
      refreshToken: `rt_${newId("refresh")}`, // §48 Token Rotation: issue new refresh token
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
