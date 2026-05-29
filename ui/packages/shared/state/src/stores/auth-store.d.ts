import type { AuthIdentity, AuthSession as SharedAuthSession } from "@aa/shared-auth";
export interface AuthSession extends SharedAuthSession, Pick<AuthIdentity, "userId" | "tenantId" | "roles" | "permissions"> {
    readonly displayName?: string;
}
export type AuthStatus = "unauthenticated" | "authenticating" | "authenticated" | "refreshing" | "expired";
export interface AuthStoreState extends AuthSession {
    readonly authenticated: boolean;
    readonly authStatus: AuthStatus;
    readonly locale: string;
    readonly displayName: string;
    readonly roleLookup: Readonly<Record<string, true>>;
    readonly permissionLookup: Readonly<Record<string, true>>;
    beginAuthentication(): void;
    login(session: AuthSession): void;
    logout(): void;
    beginRefresh(): void;
    expireSession(): void;
    switchTenant(tenantId: string): void;
    updateTokens(accessToken: string, refreshToken: string, expiresAt?: number): void;
    setAuthenticated(authenticated: boolean): void;
    setLocale(locale: string): void;
    setDisplayName(displayName: string): void;
}
export declare function createAuthStore(): import("zustand").StoreApi<AuthStoreState>;
