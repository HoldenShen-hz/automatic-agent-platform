import type { AuthSession as SharedAuthSession } from "@aa/shared-auth";
import { createStore, type StoreApi } from "zustand/vanilla";
import { withPersistDevtoolsDraft } from "./middleware";

type AuthStoreDraft = {
  -readonly [K in keyof AuthStoreState]:
    AuthStoreState[K] extends readonly (infer U)[] ? U[]
      : AuthStoreState[K];
};

export interface AuthSession extends Omit<SharedAuthSession, "userId" | "tenantId" | "roles" | "permissions"> {
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

type PersistedAuthStoreState = Pick<
  AuthStoreState,
  | "authenticated"
  | "authStatus"
  | "accessToken"
  | "refreshToken"
  | "expiresAt"
  | "userId"
  | "tenantId"
  | "roles"
  | "permissions"
  | "locale"
  | "displayName"
  | "roleLookup"
  | "permissionLookup"
>;

type AuthStoreApi = ReturnType<ReturnType<typeof createStore<AuthStoreState>>>;

const AUTH_STORE_PERSIST_KEY = "aa-auth-store";
const AUTH_STORE_VERSION = 2;

function createDefaultAuthState() {
  return {
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
}

function resetAuthDraft(draft: AuthStoreDraft): void {
  Object.assign(draft, createDefaultAuthState());
}

export function createAuthStore(): AuthStoreApi {
  const store = createStore<AuthStoreState>()(
    withPersistDevtoolsDraft<AuthStoreState, PersistedAuthStoreState>(
      AUTH_STORE_PERSIST_KEY,
      (set) => ({
        ...createDefaultAuthState(),
        beginAuthentication() {
          set((draft: AuthStoreDraft) => {
            draft.authStatus = "authenticating";
            draft.authenticated = false;
          });
        },
        login(session) {
          set((draft: AuthStoreDraft) => {
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
            draft.locale = session.locale ?? draft.locale;
          });
        },
        logout() {
          set((draft: AuthStoreDraft) => {
            resetAuthDraft(draft);
          });
        },
        beginRefresh() {
          set((draft: AuthStoreDraft) => {
            if (draft.accessToken.length > 0) {
              draft.authStatus = "refreshing";
            }
          });
        },
        expireSession() {
          set((draft: AuthStoreDraft) => {
            draft.authenticated = false;
            draft.authStatus = "expired";
          });
        },
        switchTenant(tenantId) {
          set((draft: AuthStoreDraft) => {
            draft.tenantId = tenantId;
          });
        },
        updateTokens(accessToken, refreshToken, expiresAt) {
          set((draft: AuthStoreDraft) => {
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
          set((draft: AuthStoreDraft) => {
            draft.authenticated = authenticated;
            draft.authStatus = authenticated ? "authenticated" : "unauthenticated";
          });
        },
        setLocale(locale) {
          set((draft: AuthStoreDraft) => {
            draft.locale = locale;
          });
        },
        setDisplayName(displayName) {
          set((draft: AuthStoreDraft) => {
            draft.displayName = displayName;
          });
        },
      }),
      {
        version: AUTH_STORE_VERSION,
        partialize: (state) => ({
          authenticated: false,
          authStatus: "unauthenticated",
          accessToken: "",
          refreshToken: "",
          expiresAt: 0,
          userId: state.userId,
          tenantId: state.tenantId,
          roles: state.roles,
          permissions: state.permissions,
          locale: state.locale,
          displayName: state.displayName,
          roleLookup: state.roleLookup,
          permissionLookup: state.permissionLookup,
        }),
        migrate: (persistedState): PersistedAuthStoreState => {
          const persisted = persistedState as Partial<AuthStoreState> | undefined;
          return {
            ...createDefaultAuthState(),
            userId: persisted?.userId ?? "",
            tenantId: persisted?.tenantId ?? "",
            roles: [...(persisted?.roles ?? [])],
            permissions: [...(persisted?.permissions ?? [])],
            locale: persisted?.locale ?? "zh-CN",
            displayName: persisted?.displayName ?? "",
            roleLookup: persisted?.roleLookup ?? {},
            permissionLookup: persisted?.permissionLookup ?? {},
          };
        },
      },
    ),
  );
  attachCrossTabAuthSync(store);
  return store;
}

function attachCrossTabAuthSync(store: StoreApi<AuthStoreState>): void {
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
    return;
  }
  window.addEventListener("storage", (event) => {
    if (event.key !== AUTH_STORE_PERSIST_KEY) {
      return;
    }
    if (event.newValue == null) {
      store.getState().logout();
      return;
    }
    try {
      const parsed = JSON.parse(event.newValue) as { state?: Partial<AuthStoreState> };
      const nextState = parsed.state;
      if (nextState == null || (nextState.userId ?? "").length === 0) {
        store.getState().logout();
        return;
      }
      store.setState((current) => ({
        ...current,
        authenticated: false,
        authStatus: "unauthenticated",
        accessToken: "",
        refreshToken: "",
        expiresAt: 0,
        userId: nextState.userId ?? "",
        tenantId: nextState.tenantId ?? "",
        roles: [...(nextState.roles ?? [])],
        permissions: [...(nextState.permissions ?? [])],
        locale: nextState.locale ?? current.locale,
        displayName: nextState.displayName ?? current.displayName,
        roleLookup: nextState.roleLookup ?? current.roleLookup,
        permissionLookup: nextState.permissionLookup ?? current.permissionLookup,
      }));
    } catch {
      store.getState().logout();
    }
  });
}
