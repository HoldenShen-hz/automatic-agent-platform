import { createStore } from "zustand/vanilla";
import { withPersistDevtoolsDraft } from "./middleware";
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
    };
}
function resetAuthDraft(draft) {
    Object.assign(draft, createDefaultAuthState());
}
export function createAuthStore() {
    const store = createStore()(withPersistDevtoolsDraft(AUTH_STORE_PERSIST_KEY, (set) => ({
        ...createDefaultAuthState(),
        beginAuthentication() {
            set((draft) => {
                draft.authStatus = "authenticating";
                draft.authenticated = false;
            });
        },
        login(session) {
            set((draft) => {
                const roleLookup = Object.fromEntries(session.roles.map((role) => [role, true]));
                const permissionLookup = Object.fromEntries(session.permissions.map((permission) => [permission, true]));
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
                resetAuthDraft(draft);
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
    }), {
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
        migrate: (persistedState) => {
            const persisted = persistedState;
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
    }));
    attachCrossTabAuthSync(store);
    return store;
}
function attachCrossTabAuthSync(store) {
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
            const parsed = JSON.parse(event.newValue);
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
        }
        catch {
            store.getState().logout();
        }
    });
}
