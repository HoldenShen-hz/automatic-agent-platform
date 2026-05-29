import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createContext, createElement, useContext, useEffect, useMemo } from "react";
import { useStore } from "zustand";
import { DefaultRESTClient, InMemoryWSClient, WSEventRouter, fetchDomainConfigs, fetchExplanations, fetchFeatureFlags, fetchCosts, fetchMarketplace, fetchModels, fetchPreferences, fetchRoles, fetchTenants, fetchWebhooks, } from "@aa/shared-api-client";
import { AuthService } from "@aa/shared-auth";
import { SyncCoordinator } from "@aa/shared-sync";
import { createApprovalsQuery } from "./queries/approval-queries";
import { createAnalyticsQuery, createDashboardSnapshotQuery, createSystemStatusVm, } from "./queries/dashboard-queries";
import { createAgentsQuery, createIncidentsQuery, createMissionsQuery, createQueuesQuery, createWorkersQuery, } from "./queries/mission-control-queries";
import { createTasksQuery, createWorkflowsQuery } from "./queries/task-queries";
import { createQueryClientFactory } from "./query-client";
import { createAuthStore } from "./stores/auth-store";
import { createRealtimeStore } from "./stores/realtime-store";
import { createSyncStore } from "./stores/sync-store";
import { createUiStore } from "./stores/ui-store";
import { createThemeStore } from "./stores/theme-store";
export * from "./query-cache-persistence";
export { createAuthStore } from "./stores/auth-store";
export { createUiStore } from "./stores/ui-store";
export { createRealtimeStore } from "./stores/realtime-store";
export { createSyncStore } from "./stores/sync-store";
export { createNotificationStore } from "./stores/notification-store";
export { createThemeStore } from "./stores/theme-store";
export { CACHE_TIER_STALE_TIME, createQueryClient, createQueryClientFactory, createTieredQueryClientFactory, } from "./query-client";
export * from "./mutations/index";
const ApiClientContext = createContext(null);
const WsClientContext = createContext(null);
const AuthStoreContext = createContext(null);
const UiStoreContext = createContext(null);
const RealtimeStoreContext = createContext(null);
const SyncStoreContext = createContext(null);
const ThemeStoreContext = createContext(null);
const AuthServiceContext = createContext(null);
const SyncCoordinatorContext = createContext(null);
const fallbackAuthStore = createAuthStore();
const fallbackUiStore = createUiStore();
const fallbackRealtimeStore = createRealtimeStore();
const fallbackSyncStore = createSyncStore();
const fallbackThemeStore = createThemeStore();
const identity = (state) => state;
export function UiRuntimeProvider({ children, client, queryClient, wsClient, wsUrl, wsToken, tokenManager, authContext, }) {
    const resolvedClient = client ?? new DefaultRESTClient();
    const resolvedQueryClient = queryClient ?? createQueryClientFactory();
    const resolvedWsClient = wsClient ?? new InMemoryWSClient();
    const authStore = useMemo(() => createAuthStore(), []);
    const uiStore = useMemo(() => createUiStore(), []);
    const realtimeStore = useMemo(() => createRealtimeStore(), []);
    const syncStore = useMemo(() => createSyncStore(), []);
    const themeStore = useMemo(() => createThemeStore(), []);
    const authService = useMemo(() => new AuthService(), []);
    const syncCoordinator = useMemo(() => new SyncCoordinator(), []);
    useEffect(() => {
        const params = typeof window === "undefined"
            ? new URLSearchParams("locale=zh-CN")
            : new URLSearchParams(window.location.search);
        const identity = authService.resolveIdentity(params);
        const accessToken = wsToken
            ?? tokenManager?.getAccessToken?.()
            ?? tokenManager?.getSession?.()?.accessToken
            ?? null;
        authStore.getState().setAuthenticated(authService.isAuthenticated() || accessToken != null);
        authStore.getState().setDisplayName(identity.displayName);
        authStore.getState().setLocale(identity.locale);
        if (typeof document !== "undefined") {
            document.documentElement.lang = identity.locale;
        }
        uiStore.getState().setActiveRoute("/mission-control/dashboard");
        uiStore.getState().setActiveFeature("dashboard");
        if (authContext?.tenantId != null) {
            authStore.getState().switchTenant(authContext.tenantId);
        }
        if (authContext?.userId != null) {
            authStore.getState().login({
                accessToken: accessToken ?? "",
                refreshToken: "",
                expiresAt: Date.now() + 60_000,
                userId: authContext.userId,
                tenantId: authContext.tenantId ?? "",
                roles: [...(authContext.roles ?? [])],
                permissions: [...(authContext.permissions ?? [])],
                displayName: identity.displayName,
            });
        }
        const bootstrapMutations = [
            {
                id: "bootstrap-dashboard-prefetch",
                endpoint: "/api/v1/dashboard/prefetch",
                method: "POST",
                body: { scope: "mission-control" },
                createdAt: "2026-04-23T00:00:00.000Z",
                tenantId: identity.tenantId,
                traceId: "trace-bootstrap-dashboard-prefetch",
                principal: {
                    principalId: identity.userId,
                    tenantId: identity.tenantId,
                    roles: ["operator"],
                },
                status: "pending",
            },
            {
                id: "bootstrap-approvals-prefetch",
                endpoint: "/api/v1/approvals/prefetch",
                method: "POST",
                body: { queue: "primary" },
                createdAt: "2026-04-23T00:00:01.000Z",
                tenantId: identity.tenantId,
                traceId: "trace-bootstrap-approvals-prefetch",
                principal: {
                    principalId: identity.userId,
                    tenantId: identity.tenantId,
                    roles: ["operator"],
                },
                status: "pending",
            },
        ];
        syncCoordinator.queueMutations(bootstrapMutations);
        syncStore.getState().setPendingMutations(syncCoordinator.pendingCount());
        const router = new WSEventRouter(resolvedWsClient, resolvedQueryClient, () => realtimeStore.getState().triggerPanic());
        const disposeStatus = resolvedWsClient.onStatusChange((status) => {
            realtimeStore.getState().setWsStatus(status);
        });
        if (wsUrl != null && accessToken != null && accessToken.length > 0) {
            router.connect(wsUrl, accessToken);
            router.subscribe("global");
            router.subscribe("dashboard");
            router.subscribe("approvals");
            router.subscribe("incidents");
            router.subscribe("agents");
        }
        else {
            resolvedWsClient.useSseFallback();
            realtimeStore.getState().setOfflineQueueSize(syncCoordinator.pendingCount());
            realtimeStore.getState().setSyncStatus("queued");
        }
        return () => {
            disposeStatus();
            router.disconnect();
        };
    }, [authContext, authService, authStore, realtimeStore, resolvedQueryClient, resolvedWsClient, syncCoordinator, syncStore, tokenManager, uiStore, wsToken, wsUrl]);
    return createElement(ApiClientContext.Provider, { value: resolvedClient }, createElement(WsClientContext.Provider, { value: resolvedWsClient }, createElement(AuthServiceContext.Provider, { value: authService }, createElement(SyncCoordinatorContext.Provider, { value: syncCoordinator }, createElement(AuthStoreContext.Provider, { value: authStore }, createElement(UiStoreContext.Provider, { value: uiStore }, createElement(RealtimeStoreContext.Provider, { value: realtimeStore }, createElement(SyncStoreContext.Provider, { value: syncStore }, createElement(ThemeStoreContext.Provider, { value: themeStore }, createElement(QueryClientProvider, { client: resolvedQueryClient }, children))))))))));
}
export function useRestClient() {
    return useContext(ApiClientContext) ?? new DefaultRESTClient();
}
export function useWsClient() {
    return useContext(WsClientContext) ?? new InMemoryWSClient();
}
export function useAuthStoreApi() {
    const store = useContext(AuthStoreContext) ?? fallbackAuthStore;
    return store;
}
export function useUiStoreApi() {
    const store = useContext(UiStoreContext) ?? fallbackUiStore;
    return store;
}
export function useSyncStoreApi() {
    const store = useContext(SyncStoreContext) ?? fallbackSyncStore;
    return store;
}
export function useThemeStoreApi() {
    const store = useContext(ThemeStoreContext) ?? fallbackThemeStore;
    return store;
}
export function useAuthState(selector = identity) {
    return useStore(useAuthStoreApi(), selector);
}
export function useUiState(selector = identity) {
    return useStore(useUiStoreApi(), selector);
}
export function useSyncState(selector = identity) {
    return useStore(useSyncStoreApi(), selector);
}
export function useThemeState(selector = identity) {
    return useStore(useThemeStoreApi(), selector);
}
export function useSystemStatus() {
    const realtimeStore = useContext(RealtimeStoreContext) ?? fallbackRealtimeStore;
    const realtimeState = useStore(realtimeStore, (state) => state);
    return createSystemStatusVm(realtimeState);
}
export function useDashboardSnapshotQuery() {
    const client = useRestClient();
    return useQuery(createDashboardSnapshotQuery(client));
}
export function useTasksQuery(options) {
    const client = useRestClient();
    return useQuery({
        ...createTasksQuery(client),
        ...(options == null ? {} : options),
    });
}
export function useWorkflowsQuery() {
    const client = useRestClient();
    return useQuery(createWorkflowsQuery(client));
}
export function useApprovalsQuery() {
    const client = useRestClient();
    return useQuery(createApprovalsQuery(client));
}
export function useIncidentsQuery(options) {
    const client = useRestClient();
    return useQuery({
        ...createIncidentsQuery(client),
        ...(options == null ? {} : options),
    });
}
export function useWorkersQuery(options) {
    const client = useRestClient();
    return useQuery({
        ...createWorkersQuery(client),
        ...(options == null ? {} : options),
    });
}
export function useQueuesQuery(options) {
    const client = useRestClient();
    return useQuery({
        ...createQueuesQuery(client),
        ...(options == null ? {} : options),
    });
}
export function useAgentsQuery(options) {
    const client = useRestClient();
    return useQuery({
        ...createAgentsQuery(client),
        ...(options == null ? {} : options),
    });
}
export function useMissionsQuery() {
    const client = useRestClient();
    return useQuery(createMissionsQuery(client));
}
export function useAnalyticsQuery(options) {
    const client = useRestClient();
    return useQuery({
        ...createAnalyticsQuery(client),
        ...(options == null ? {} : options),
    });
}
export function useCostReportsQuery() {
    const client = useRestClient();
    return useQuery({
        queryKey: ["costs"],
        queryFn: () => fetchCosts(client),
    });
}
export function useMarketplaceQuery() {
    const client = useRestClient();
    return useQuery({
        queryKey: ["marketplace"],
        queryFn: () => fetchMarketplace(client),
    });
}
export function useExplanationsQuery() {
    const client = useRestClient();
    return useQuery({
        queryKey: ["explanations"],
        queryFn: () => fetchExplanations(client),
    });
}
export function useRolesQuery() {
    const client = useRestClient();
    return useQuery({
        queryKey: ["roles"],
        queryFn: () => fetchRoles(client),
    });
}
export function useFeatureFlagsQuery() {
    const client = useRestClient();
    return useQuery({
        queryKey: ["feature-flags"],
        queryFn: () => fetchFeatureFlags(client),
    });
}
export function useModelsQuery() {
    const client = useRestClient();
    return useQuery({
        queryKey: ["models"],
        queryFn: () => fetchModels(client),
    });
}
export function useDomainConfigsQuery() {
    const client = useRestClient();
    return useQuery({
        queryKey: ["domain-configs"],
        queryFn: () => fetchDomainConfigs(client),
    });
}
export function useTenantsQuery() {
    const client = useRestClient();
    return useQuery({
        queryKey: ["tenants"],
        queryFn: () => fetchTenants(client),
    });
}
export function useWebhooksQuery() {
    const client = useRestClient();
    return useQuery({
        queryKey: ["webhooks"],
        queryFn: () => fetchWebhooks(client),
    });
}
export function usePreferencesQuery() {
    const client = useRestClient();
    return useQuery({
        queryKey: ["preferences"],
        queryFn: () => fetchPreferences(client),
    });
}
