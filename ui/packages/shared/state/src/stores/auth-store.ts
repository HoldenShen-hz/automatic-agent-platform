import { createStore } from "zustand/vanilla";
import { withPersistDevtoolsDraft } from "./middleware";

export interface AuthSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number;
  readonly userId: string;
  readonly tenantId: string;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
}

export interface AuthStoreState extends AuthSession {
  readonly authenticated: boolean;
  readonly locale: string;
  login(session: AuthSession): void;
  logout(): void;
  updateTokens(accessToken: string, refreshToken: string, expiresAt?: number): void;
  setAuthenticated(authenticated: boolean): void;
  setLocale(locale: string): void;
}

const DEFAULT_AUTH_STATE = {
  authenticated: false,
  accessToken: "",
  refreshToken: "",
  expiresAt: 0,
  userId: "",
  tenantId: "",
  roles: [],
  permissions: [],
  locale: "zh-CN",
} satisfies Omit<AuthStoreState, "login" | "logout" | "updateTokens" | "setAuthenticated" | "setLocale">;

export function createAuthStore() {
  return createStore<AuthStoreState>()(
    withPersistDevtoolsDraft(
      "aa-auth-store",
      (set) => ({
        ...DEFAULT_AUTH_STATE,
        login(session) {
          set((draft) => {
            draft.authenticated = true;
            draft.accessToken = session.accessToken;
            draft.refreshToken = session.refreshToken;
            draft.expiresAt = session.expiresAt;
            draft.userId = session.userId;
            draft.tenantId = session.tenantId;
            draft.roles = [...session.roles];
            draft.permissions = [...session.permissions];
          });
        },
        logout() {
          set((draft) => {
            Object.assign(draft, DEFAULT_AUTH_STATE);
          });
        },
        updateTokens(accessToken, refreshToken, expiresAt) {
          set((draft) => {
            draft.accessToken = accessToken;
            draft.refreshToken = refreshToken;
            if (expiresAt != null) {
              draft.expiresAt = expiresAt;
            }
          });
        },
        setAuthenticated(authenticated) {
          set((draft) => {
            draft.authenticated = authenticated;
          });
        },
        setLocale(locale) {
          set((draft) => {
            draft.locale = locale;
          });
        },
      }),
    ),
  );
}
