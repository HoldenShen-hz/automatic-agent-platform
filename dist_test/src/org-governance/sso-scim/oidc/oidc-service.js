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
export function toOidcSession(record) {
    const result = {
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
        result.refreshToken = record.refreshToken;
    }
    return result;
}
const DEFAULT_CONFIG = {
    sessionTtlMs: 3600000, // 1 hour
    refreshThresholdMs: 300000, // 5 minutes
    maxSessionAgeMs: 86400000, // 24 hours
};
// ─────────────────────────────────────────────────────────────────────────────
// In-Memory State Store (for development; use Redis in production)
// ─────────────────────────────────────────────────────────────────────────────
export class InMemoryOidcStateStore {
    store = new Map();
    saveState(state, nonce, redirectUri) {
        this.store.set(state, {
            nonce,
            redirectUri,
            expiresAt: Date.now() + 600000, // 10 minutes
        });
    }
    getState(state) {
        const entry = this.store.get(state);
        if (!entry)
            return null;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(state);
            return null;
        }
        return { nonce: entry.nonce, redirectUri: entry.redirectUri };
    }
    deleteState(state) {
        this.store.delete(state);
    }
}
export class OidcIdentityService {
    providerConfig;
    config;
    sessions = new Map();
    userSessions = new Map();
    stateStore;
    constructor(providerConfig, stateStore, config) {
        this.providerConfig = providerConfig;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.stateStore = stateStore ?? new InMemoryOidcStateStore();
    }
    /**
     * Initiates OIDC authorization code flow.
     *
     * @param redirectUri - URI to redirect back after auth
     * @returns Authorization URL and state for verification
     */
    initiateFlow(redirectUri) {
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
    async exchangeCodeForTokens(code, expectedState) {
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
    async fetchUserInfo(accessToken) {
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
    validateAccessToken(accessToken) {
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
    createSession(tokens, userInfo) {
        const sessionId = newId("oidc_session");
        const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();
        const record = {
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
        this.userSessions.get(userInfo.sub).add(sessionId);
        return toOidcSession(record);
    }
    /**
     * Refreshes an expired access token using refresh token.
     *
     * @param sessionId - Session ID to refresh
     * @returns New tokens or null if refresh fails
     */
    async refreshAccessToken(sessionId) {
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
    revokeSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
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
    revokeAllUserSessions(userId) {
        const sessionIds = this.userSessions.get(userId);
        if (!sessionIds)
            return 0;
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
    getUserSessions(userId) {
        const sessionIds = this.userSessions.get(userId);
        if (!sessionIds)
            return [];
        const activeSessions = [];
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
    touchSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastActivityAt = nowIso();
        }
    }
    /**
     * Gets the number of active sessions.
     */
    getSessionCount() {
        return this.sessions.size;
    }
    /**
     * Cleans up expired sessions.
     *
     * @returns Number of sessions cleaned up
     */
    cleanupExpiredSessions() {
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
    buildAuthorizationUrl(state, nonce) {
        const scopes = encodeURIComponent(this.providerConfig.scopes.join(" "));
        return (`${this.providerConfig.issuer}/authorize` +
            `?client_id=${encodeURIComponent(this.providerConfig.clientId)}` +
            `&redirect_uri=${encodeURIComponent(this.providerConfig.redirectUri)}` +
            `&response_type=code` +
            `&scope=${scopes}` +
            `&state=${encodeURIComponent(state)}` +
            `&nonce=${encodeURIComponent(nonce)}`);
    }
    simulateTokenResponse(code, nonce) {
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
    simulateUserInfo(accessToken) {
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
    simulateRefreshResponse(refreshToken) {
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
export function createOidcIdentityService(providerConfig, stateStore, config) {
    return new OidcIdentityService(providerConfig, stateStore, config);
}
//# sourceMappingURL=oidc-service.js.map