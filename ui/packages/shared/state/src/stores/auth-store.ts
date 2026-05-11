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

const DEFAULT_AUTH_STATE = {
  authenticated: false,
  authStatus: "unauthenticated",
  accessToken: "",
  refreshToken: "",
  expiresAt: 0,
  userId: "",
  tenantId: "",
  roles: [],
  permissions: [],
  locale: "zh-CN",
  displayName: "",
  roleLookup: {},
  permissionLookup: {},
} satisfies Omit<AuthStoreState, "beginAuthentication" | "login" | "logout" | "beginRefresh" | "expireSession" | "switchTenant" | "updateTokens" | "setAuthenticated" | "setLocale" | "setDisplayName">;

export function createAuthStore() {
  return createStore<AuthStoreState>()(
    withPersistDevtoolsDraft(
      "aa-auth-store",
      (set) => ({
        ...DEFAULT_AUTH_STATE,
        beginAuthentication() {
          set((draft) => {
            draft.authStatus = "authenticating";
            draft.authenticated = false;
          });
        },
        login(session) {
          set((draft) => {
            const roleLookup = Object.fromEntries(session.roles.map((role) => [role, true])) as Record<string, true>;
            const permissionLookup = Object.fromEntries(session.permissions.map((permission) => [permission, true])) as Record<string, true>;
            draft.authenticated = true;
            draft.authStatus = "authenticated";
            draft.accessToken = session.accessToken;
            draft.refreshToken = session.refreshToken;
            draft.expiresAt = session.expiresAt;
            draft.userId = session.userId;
            draft.tenantId = session.tenantId;
            draft.roles = [...session.roles];
            draft.permissions = [...session.permissions];
            draft.roleLookup = roleLookup;
            draft.permissionLookup = permissionLookup;
            draft.displayName = session.displayName ?? draft.displayName;
          });
        },
        logout() {
          set((draft) => {
            Object.assign(draft, DEFAULT_AUTH_STATE);
          });
        },
        beginRefresh() {
          set((draft) => {
            if (draft.accessToken.length > 0) {
              draft.authStatus = "refreshing";
            }
          });
        },
        expireSession() {
          set((draft) => {
            draft.authenticated = false;
            draft.authStatus = "expired";
          });
        },
        switchTenant(tenantId) {
          set((draft) => {
            draft.tenantId = tenantId;
          });
        },
        updateTokens(accessToken, refreshToken, expiresAt) {
          set((draft) => {
            draft.accessToken = accessToken;
            draft.refreshToken = refreshToken;
            if (expiresAt != null) {
              draft.expiresAt = expiresAt;
            }
            draft.authenticated = accessToken.length > 0;
            draft.authStatus = draft.authenticated ? "authenticated" : draft.authStatus;
          });
        },
        setAuthenticated(authenticated) {
          set((draft) => {
            draft.authenticated = authenticated;
            draft.authStatus = authenticated ? "authenticated" : "unauthenticated";
          });
        },
        setLocale(locale) {
          set((draft) => {
            draft.locale = locale;
          });
        },
        setDisplayName(displayName) {
          set((draft) => {
            draft.displayName = displayName;
          });
        },
      }),
    ),
  );
}
