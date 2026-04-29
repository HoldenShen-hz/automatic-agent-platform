import { createStore } from "zustand/vanilla";

/**
 * AuthStore state per §5.1.1 - complete auth context including tokens and tenant info.
 */
export interface AuthStoreState {
  readonly authenticated: boolean;
  readonly locale: string;
  readonly userId: string | null;
  readonly tenantId: string | null;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly accessToken: string | null;
  readonly refreshToken: string | null;
  login(session: AuthSessionData): void;
  logout(): void;
  setLocale(locale: string): void;
  switchTenant(tenantId: string): void;
  /** Updates access and refresh tokens after token refresh */
  updateTokens(accessToken: string, refreshToken: string): void;
}

export interface AuthSessionData {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number;
  readonly userId: string;
  readonly tenantId: string;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
}

export function createAuthStore() {
  return createStore<AuthStoreState>((set) => ({
    authenticated: false,
    locale: "zh-CN",
    userId: null,
    tenantId: null,
    roles: [],
    permissions: [],
    accessToken: null,
    refreshToken: null,
    login(session) {
      set({
        authenticated: true,
        userId: session.userId,
        tenantId: session.tenantId,
        roles: session.roles,
        permissions: session.permissions,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      });
    },
    logout() {
      set({
        authenticated: false,
        userId: null,
        tenantId: null,
        roles: [],
        permissions: [],
        accessToken: null,
        refreshToken: null,
      });
    },
    setLocale(locale) {
      set({ locale });
    },
    switchTenant(tenantId) {
      set({ tenantId });
    },
    updateTokens(accessToken, refreshToken) {
      set({ accessToken, refreshToken });
    },
  }));
}
