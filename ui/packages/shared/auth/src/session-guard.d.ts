import { TokenManager } from "./token-manager";
import type { AuthSession } from "./types";
import { type RouteGuardChainOptions } from "@aa/shared-domain";
import type { RouteGuardResult } from "@aa/shared-types";
export interface SessionTimeoutWarning {
    readonly expiresAt: number;
    readonly remainingMs: number;
    readonly shouldRefresh: boolean;
}
export declare class SessionGuard {
    private readonly tokenManager;
    constructor(tokenManager?: TokenManager);
    requireAuthenticated(): AuthSession;
    isAuthenticated(now?: number): boolean;
    getTimeoutWarning(now?: number, warningWindowMs?: number): SessionTimeoutWarning | null;
    requireRouteAccess(permission: string, options?: RouteGuardChainOptions): RouteGuardResult;
}
