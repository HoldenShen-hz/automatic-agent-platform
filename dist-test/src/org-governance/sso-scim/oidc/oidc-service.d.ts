/**
 * OIDC Identity Provider Service
 *
 * Implements OpenID Connect authorization code flow for enterprise IdP integration.
 * Supports token exchange, user info retrieval, and session management.
 *
 * Architecture: §48 SSO/SCIM - P0 OIDC Integration
 * @see docs_zh/architecture/00-platform-architecture.md §48
 */
import type { OidcProviderConfig } from "./index.js";
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
export declare function toOidcSession(record: SessionRecord): OidcSession;
export interface OidcStateStore {
    saveState(state: string, nonce: string, redirectUri: string): void;
    getState(state: string): {
        nonce: string;
        redirectUri: string;
    } | null;
    deleteState(state: string): void;
}
export interface OidcServiceConfig {
    readonly sessionTtlMs: number;
    readonly refreshThresholdMs: number;
    readonly maxSessionAgeMs: number;
    /** §48: Disable mock fallback in production */
    readonly allowMockFallback: boolean;
}
export declare class InMemoryOidcStateStore implements OidcStateStore {
    private readonly store;
    saveState(state: string, nonce: string, redirectUri: string): void;
    getState(state: string): {
        nonce: string;
        redirectUri: string;
    } | null;
    deleteState(state: string): void;
}
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
export declare class OidcIdentityService {
    private readonly providerConfig;
    private readonly config;
    private readonly sessions;
    private readonly userSessions;
    private readonly stateStore;
    constructor(providerConfig: OidcProviderConfig, stateStore?: OidcStateStore, config?: Partial<OidcServiceConfig>);
    /**
     * Initiates OIDC authorization code flow.
     *
     * @param redirectUri - URI to redirect back after auth
     * @returns Authorization URL and state for verification
     */
    initiateFlow(redirectUri: string): {
        authorizationUrl: string;
        state: string;
        nonce: string;
    };
    /**
     * Exchanges authorization code for tokens.
     *
     * @param code - Authorization code
     * @param expectedState - State parameter for CSRF protection
     * @returns Token response or null if exchange fails
     */
    exchangeCodeForTokens(code: string, expectedState: string): Promise<OidcTokenResponse | null>;
    /**
     * Fetches user info from the IdP.
     *
     * @param accessToken - Valid access token
     * @returns User info or null if fetch fails
     */
    fetchUserInfo(accessToken: string): Promise<OidcUserInfo | null>;
    /**
     * Validates an access token and returns associated session.
     *
     * @param accessToken - Token to validate
     * @returns Session if valid, null otherwise
     */
    validateAccessToken(accessToken: string): OidcSession | null;
    /**
     * Creates a new session from token response.
     *
     * @param tokens - Token response from IdP
     * @param userInfo - User info from IdP
     * @returns Created session
     */
    createSession(tokens: OidcTokenResponse, userInfo: OidcUserInfo): OidcSession;
    /**
     * Refreshes an expired access token using refresh token.
     *
     * @param sessionId - Session ID to refresh
     * @returns New tokens or null if refresh fails
     */
    refreshAccessToken(sessionId: string): Promise<OidcTokenResponse | null>;
    /**
     * Revokes a session.
     *
     * @param sessionId - Session ID to revoke
     */
    revokeSession(sessionId: string): void;
    /**
     * Revokes all sessions for a user.
     *
     * @param userId - User ID
     * @returns Number of sessions revoked
     */
    revokeAllUserSessions(userId: string): number;
    /**
     * Gets active sessions for a user.
     *
     * @param userId - User ID
     * @returns Array of active sessions
     */
    getUserSessions(userId: string): OidcSession[];
    /**
     * Updates last activity timestamp for a session.
     *
     * @param sessionId - Session ID
     */
    touchSession(sessionId: string): void;
    /**
     * Gets the number of active sessions.
     */
    getSessionCount(): number;
    /**
     * Cleans up expired sessions.
     *
     * @returns Number of sessions cleaned up
     */
    cleanupExpiredSessions(): number;
    private buildAuthorizationUrl;
    private exchangeTokens;
    private simulateTokenResponse;
    private simulateUserInfo;
    private simulateRefreshResponse;
}
export declare function createOidcIdentityService(providerConfig: OidcProviderConfig, stateStore?: OidcStateStore, config?: Partial<OidcServiceConfig>): OidcIdentityService;
export {};
