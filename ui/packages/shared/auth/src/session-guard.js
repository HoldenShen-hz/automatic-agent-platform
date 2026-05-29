import { TokenManager } from "./token-manager";
import { createFeatureGuardContext, createRouteGuardChain } from "@aa/shared-domain";
export class SessionGuard {
    tokenManager;
    constructor(tokenManager = new TokenManager()) {
        this.tokenManager = tokenManager;
    }
    requireAuthenticated() {
        const session = this.tokenManager.getSession();
        if (session == null || this.tokenManager.isExpired()) {
            throw new Error("auth.session_required");
        }
        return session;
    }
    isAuthenticated(now = Date.now()) {
        return this.tokenManager.hasActiveSession(now);
    }
    getTimeoutWarning(now = Date.now(), warningWindowMs = 5 * 60_000) {
        const session = this.tokenManager.getSession();
        if (session == null || this.tokenManager.isExpired(now)) {
            return null;
        }
        const remainingMs = session.expiresAt - now;
        if (remainingMs > warningWindowMs) {
            return null;
        }
        return {
            expiresAt: session.expiresAt,
            remainingMs,
            shouldRefresh: this.tokenManager.shouldRefresh(now),
        };
    }
    requireRouteAccess(permission, options = {}) {
        this.requireAuthenticated();
        return createRouteGuardChain(permission, options.featureFlag, options).evaluate(createFeatureGuardContext({
            permissions: ["authenticated", permission],
            roles: options.requiredRoles ?? ["operator"],
            domainId: options.allowedDomains?.[0] ?? "platform",
            featureFlags: options.featureFlag == null ? {} : { [options.featureFlag]: true },
            featureVisibility: options.featureId == null ? {} : { [options.featureId]: true },
            mode: options.requireEnterpriseMode === true ? "enterprise" : "solo",
        }));
    }
}
