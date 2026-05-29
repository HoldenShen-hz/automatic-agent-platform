export class TokenManager {
    options;
    session = null;
    inFlightRefresh = null;
    constructor(options = {}) {
        this.options = options;
    }
    setSession(session) {
        this.session = {
            ...session,
            roles: session.roles == null ? undefined : [...session.roles],
            permissions: session.permissions == null ? undefined : [...session.permissions],
        };
    }
    getSession() {
        return this.session;
    }
    isExpired(now = Date.now()) {
        return this.session == null || this.session.expiresAt <= now;
    }
    hasActiveSession(now = Date.now()) {
        return !this.isExpired(now);
    }
    getAccessToken() {
        return this.session?.accessToken ?? null;
    }
    getToken() {
        return this.getAccessToken();
    }
    shouldRefresh(now = Date.now()) {
        if (this.session == null) {
            return false;
        }
        return this.session.expiresAt - now <= (this.options.refreshWindowMs ?? 60_000);
    }
    async getAccessTokenWithRefresh(now = Date.now()) {
        if (this.session == null) {
            return null;
        }
        if (!this.shouldRefresh(now)) {
            return this.session.accessToken;
        }
        if (this.options.refreshFn == null) {
            if (this.isExpired(now)) {
                await this.handleUnauthorized();
                return null;
            }
            return this.session.accessToken;
        }
        if (this.inFlightRefresh != null) {
            return await this.inFlightRefresh;
        }
        const previousSession = this.session;
        this.inFlightRefresh = this.options.refreshFn(previousSession.refreshToken)
            .then((result) => {
            const refreshedSession = {
                accessToken: result.accessToken,
                refreshToken: result.refreshToken ?? previousSession.refreshToken,
                expiresAt: result.expiresAt ?? Date.now() + (result.expiresIn ?? 3600) * 1000,
            };
            this.session = refreshedSession;
            return refreshedSession.accessToken;
        })
            .catch(async () => {
            if (this.isExpired(now)) {
                await this.handleUnauthorized();
                return null;
            }
            return this.session?.accessToken ?? null;
        })
            .finally(() => {
            this.inFlightRefresh = null;
        });
        return await this.inFlightRefresh;
    }
    async handleUnauthorized() {
        this.clear();
        await this.options.onUnauthorized?.();
    }
    clear() {
        this.session = null;
    }
}
