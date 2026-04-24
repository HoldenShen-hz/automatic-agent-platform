import { TokenManager } from "./token-manager";
import type { AuthSession } from "./types";
import { createFeatureGuardContext, createRouteGuardChain, type RouteGuardChainOptions } from "@aa/shared-domain";
import type { RouteGuardResult } from "@aa/shared-types";

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
