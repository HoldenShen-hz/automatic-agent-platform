import { createStore } from "zustand/vanilla";
import { createJSONStorage } from "zustand/middleware";
import { withPersistDevtoolsDraft } from "./middleware";

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
  return createStore<AuthStoreState>()(
    withPersistDevtoolsDraft(
      "aa-auth-store",
      (set) => ({
        authenticated: false,
        locale: "zh-CN",
        userId: null,
        tenantId: null,
        roles: [],
        permissions: [],
        accessToken: null,
        refreshToken: null,
        login(session) {
          set((draft) => {
            draft.authenticated = true;
            draft.userId = session.userId;
            draft.tenantId = session.tenantId;
            draft.roles = [...session.roles];
            draft.permissions = [...session.permissions];
            draft.accessToken = session.accessToken;
            draft.refreshToken = session.refreshToken;
          });
        },
        logout() {
          set((draft) => {
            draft.authenticated = false;
            draft.userId = null;
            draft.tenantId = null;
            draft.roles = [];
            draft.permissions = [];
            draft.accessToken = null;
            draft.refreshToken = null;
          });
        },
        setLocale(locale) {
          set((draft) => {
            draft.locale = locale;
          });
        },
        switchTenant(tenantId) {
          set((draft) => {
            draft.tenantId = tenantId;
          });
        },
        updateTokens(accessToken, refreshToken) {
          set((draft) => {
            draft.accessToken = accessToken;
            draft.refreshToken = refreshToken;
          });
        },
      }),
      {
        storage: createJSONStorage(() => (typeof window === "undefined" ? {
          getItem: () => null,
          setItem: () => undefined,
          removeItem: () => undefined,
        } : window.sessionStorage)),
        partialize: (state) => ({
          authenticated: state.authenticated,
          locale: state.locale,
          userId: state.userId,
          tenantId: state.tenantId,
          roles: state.roles,
          permissions: state.permissions,
        }),
      },
    ),
  );
}
