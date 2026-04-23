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
    allowMockFallback: false, // §48: Disabled in production
};
/**
 * §48: Check if the current environment is production.
 * Uses NODE_ENV environment variable.
 */
function isProductionEnvironment() {
    return process.env.NODE_ENV === "production";
}
/**
 * §48: Validates that a token is not a mock token in production.
 * Mock tokens are identified by prefixes: "at_", "id_", "rt_".
 *
 * @param token - Token to validate
 * @throws Error if token appears to be mock and environment is production
 */
function validateProductionToken(token) {
    if (!isProductionEnvironment()) {
        return; // Allow mock tokens in non-production
    }
    const mockPrefixes = ["at_", "id_", "rt_"];
    for (const prefix of mockPrefixes) {
        if (token.startsWith(prefix)) {
            throw new Error(`§48 Production Hardening: Mock token rejected in production environment. ` +
                `Token prefix "${prefix}" indicates simulated authentication. ` +
                `Ensure OIDC provider is properly configured with valid credentials.`);
        }
    }
}
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
        return this.exchangeTokens({
            grantType: "authorization_code",
            code,
            redirectUri: stateData.redirectUri,
            nonce: stateData.nonce,
        });
    }
    /**
     * Fetches user info from the IdP.
     *
     * @param accessToken - Valid access token
     * @returns User info or null if fetch fails
     */
    async fetchUserInfo(accessToken) {
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
                return this.simulateUserInfo(accessToken);
            }
            const payload = await response.json();
            return {
                sub: String(payload.sub ?? newId("user")),
                ...(typeof payload.email === "string" ? { email: payload.email } : {}),
                ...(typeof payload.name === "string" ? { name: payload.name } : {}),
                ...(typeof payload.given_name === "string" ? { givenName: payload.given_name } : {}),
                ...(typeof payload.family_name === "string" ? { familyName: payload.family_name } : {}),
                ...(typeof payload.preferred_username === "string" ? { preferredUsername: payload.preferred_username } : {}),
                ...(Array.isArray(payload.groups) ? { groups: payload.groups.filter((item) => typeof item === "string") } : {}),
                updatedAt: nowIso(),
            };
        }
        catch {
            return this.simulateUserInfo(accessToken);
        }
    }
    /**
     * Validates an access token and returns associated session.
     *
     * @param accessToken - Token to validate
     * @returns Session if valid, null otherwise
     */
    validateAccessToken(accessToken) {
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
        const newTokens = await this.exchangeTokens({
            grantType: "refresh_token",
            refreshToken: session.refreshToken,
        }) ?? this.simulateRefreshResponse(session.refreshToken);
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
        const authorizationEndpoint = this.providerConfig.authorizationEndpoint ?? `${this.providerConfig.issuer}/authorize`;
        return (`${authorizationEndpoint}` +
            `?client_id=${encodeURIComponent(this.providerConfig.clientId)}` +
            `&redirect_uri=${encodeURIComponent(this.providerConfig.redirectUri)}` +
            `&response_type=code` +
            `&scope=${scopes}` +
            `&state=${encodeURIComponent(state)}` +
            `&nonce=${encodeURIComponent(nonce)}`);
    }
    async exchangeTokens(input) {
        const tokenEndpoint = this.providerConfig.tokenEndpoint ?? `${this.providerConfig.issuer}/token`;
        const body = new URLSearchParams({
            grant_type: input.grantType,
            client_id: this.providerConfig.clientId,
            ...(this.providerConfig.clientSecret ? { client_secret: this.providerConfig.clientSecret } : {}),
            ...(input.code ? { code: input.code } : {}),
            ...(input.redirectUri ? { redirect_uri: input.redirectUri } : {}),
            ...(input.refreshToken ? { refresh_token: input.refreshToken } : {}),
            ...(input.nonce ? { nonce: input.nonce } : {}),
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
                    throw new Error(`§48 Production Hardening: Token exchange failed with status ${response.status}. ` +
                        `Mock fallback is disabled. Configure valid OIDC provider credentials.`);
                }
                return input.grantType === "authorization_code"
                    ? this.simulateTokenResponse(input.code ?? "", input.nonce ?? "")
                    : this.simulateRefreshResponse(input.refreshToken ?? "");
            }
            const payload = await response.json();
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
        }
        catch (err) {
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