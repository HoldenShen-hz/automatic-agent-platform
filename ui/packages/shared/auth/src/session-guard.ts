import { TokenManager } from "./token-manager";
import type { AuthSession } from "./types";
import { createFeatureGuardContext, createRouteGuardChain, type RouteGuardChainOptions } from "@aa/shared-domain";
import type { RouteGuardResult } from "@aa/shared-types";

export interface SessionTimeoutWarning {
  readonly expiresAt: number;
  readonly remainingMs: number;
  readonly shouldRefresh: boolean;
}

export class SessionGuard {
  public constructor(private readonly tokenManager: TokenManager = new TokenManager()) {}

  public requireAuthenticated(): AuthSession {
    const session = this.tokenManager.getSession();
    if (session == null || this.tokenManager.isExpired()) {
      throw new Error("auth.session_required");
    }
    return session;
  }

  public isAuthenticated(now = Date.now()): boolean {
    return this.tokenManager.hasActiveSession(now);
  }

  public getTimeoutWarning(now = Date.now(), warningWindowMs = 5 * 60_000): SessionTimeoutWarning | null {
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

  public requireRouteAccess(
    permission: string,
    options: RouteGuardChainOptions = {},
  ): RouteGuardResult {
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
