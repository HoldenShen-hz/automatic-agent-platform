import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createContext, createElement, useContext, useEffect, useMemo, type PropsWithChildren, type ReactElement } from "react";
import { useStore } from "zustand";
import {
  DefaultRESTClient,
  InMemoryWSClient,
  WSEventRouter,
  fetchDomainConfigs,
  fetchExplanations,
  fetchFeatureFlags,
  fetchCosts,
  fetchMarketplace,
  fetchModels,
  fetchPreferences,
  fetchRoles,
  fetchTenants,
  fetchWebhooks,
  type RESTClient,
  type WSClient,
} from "@aa/shared-api-client";
import type { SystemStatusVM } from "@aa/shared-types";
import { AuthService } from "@aa/shared-auth";
import { SyncCoordinator, type OfflineMutation } from "@aa/shared-sync";
import { createApprovalsQuery } from "./queries/approval-queries";
import {
  createAnalyticsQuery,
  createDashboardSnapshotQuery,
  createSystemStatusVm,
} from "./queries/dashboard-queries";
import {
  createAgentsQuery,
  createIncidentsQuery,
  createQueuesQuery,
  createWorkersQuery,
} from "./queries/mission-control-queries";
import { createTasksQuery, createWorkflowsQuery } from "./queries/task-queries";
import { createQueryClientFactory } from "./query-client";
import { createAuthStore, type AuthStoreState } from "./stores/auth-store";
import { createRealtimeStore } from "./stores/realtime-store";
import { createSyncStore, type SyncStoreState } from "./stores/sync-store";
import { createUiStore, type UiStoreState } from "./stores/ui-store";
import { createNotificationStore, type NotificationStoreState, type Notification, type NotificationKind } from "./stores/notification-store";
import { createThemeStore, type ThemeStoreState, type ThemeMode, type ResolvedThemeName } from "./stores/theme-store";
export * from "./query-cache-persistence";

export type { AuthStoreState } from "./stores/auth-store";
export { createAuthStore } from "./stores/auth-store";
export type { UiStoreState } from "./stores/ui-store";
export { createUiStore } from "./stores/ui-store";
export type { RealtimeStoreState } from "./stores/realtime-store";
export { createRealtimeStore } from "./stores/realtime-store";
export type { SyncStoreState } from "./stores/sync-store";
export { createSyncStore } from "./stores/sync-store";
export { createNotificationStore, createThemeStore } from "./stores/index";
export type { NotificationStoreState, Notification, NotificationKind } from "./stores/notification-store";
export type { ThemeStoreState, ThemeMode, ResolvedThemeName } from "./stores/theme-store";
export {
  CACHE_TIER_STALE_TIME,
  createQueryClientFactory,
  createTieredQueryClientFactory,
  type QueryCacheTier,
} from "./query-client";
export * from "./mutations/index";

const ApiClientContext = createContext<RESTClient | null>(null);
const WsClientContext = createContext<WSClient | null>(null);
const AuthStoreContext = createContext<ReturnType<typeof createAuthStore> | null>(null);
const UiStoreContext = createContext<ReturnType<typeof createUiStore> | null>(null);
const RealtimeStoreContext = createContext<ReturnType<typeof createRealtimeStore> | null>(null);
const SyncStoreContext = createContext<ReturnType<typeof createSyncStore> | null>(null);
const ThemeStoreContext = createContext<ReturnType<typeof createThemeStore> | null>(null);
const AuthServiceContext = createContext<AuthService | null>(null);
const SyncCoordinatorContext = createContext<SyncCoordinator | null>(null);
const fallbackAuthStore = createAuthStore();
const fallbackUiStore = createUiStore();
const fallbackRealtimeStore = createRealtimeStore();
const fallbackSyncStore = createSyncStore();
const fallbackThemeStore = createThemeStore();
const identity = <T,>(state: T): T => state;

export function UiRuntimeProvider(
  {
    children,
    client,
    queryClient,
    wsClient,
    wsUrl,
    wsToken,
    tokenManager,
    authContext,
  }: PropsWithChildren<{
    client?: RESTClient;
    queryClient?: QueryClient;
    wsClient?: WSClient;
    wsUrl?: string;
    wsToken?: string;
    tokenManager?: { getAccessToken?: () => string | null; getSession?: () => { accessToken: string } | null };
    authContext?: {
      userId?: string;
      tenantId?: string;
      permissions?: readonly string[];
      roles?: readonly string[];
    };
  }>,
): ReactElement {
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

    const bootstrapMutations: OfflineMutation[] = [
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

    const router = new WSEventRouter(
      resolvedWsClient,
      resolvedQueryClient,
      () => realtimeStore.getState().triggerPanic(),
    );
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
    } else {
      resolvedWsClient.useSseFallback();
      realtimeStore.getState().setOfflineQueueSize(syncCoordinator.pendingCount());
      realtimeStore.getState().setSyncStatus("queued");
    }

    return () => {
      disposeStatus();
      router.disconnect();
    };
  }, [authContext, authService, authStore, realtimeStore, resolvedQueryClient, resolvedWsClient, syncCoordinator, syncStore, tokenManager, uiStore, wsToken, wsUrl]);
  return createElement(
    ApiClientContext.Provider,
    { value: resolvedClient },
    createElement(
      WsClientContext.Provider,
      { value: resolvedWsClient },
      createElement(
        AuthServiceContext.Provider,
        { value: authService },
        createElement(
          SyncCoordinatorContext.Provider,
          { value: syncCoordinator },
          createElement(
            AuthStoreContext.Provider,
            { value: authStore },
            createElement(
              UiStoreContext.Provider,
              { value: uiStore },
              createElement(
                RealtimeStoreContext.Provider,
                { value: realtimeStore },
                createElement(
                  SyncStoreContext.Provider,
                  { value: syncStore },
                  createElement(
                    ThemeStoreContext.Provider,
                    { value: themeStore },
                    createElement(QueryClientProvider, { client: resolvedQueryClient }, children),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

export function useRestClient(): RESTClient {
  return useContext(ApiClientContext) ?? new DefaultRESTClient();
}

export function useWsClient(): WSClient {
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

export function useAuthState<TSelected = AuthStoreState>(
  selector: (state: AuthStoreState) => TSelected = identity as (state: AuthStoreState) => TSelected,
): TSelected {
  return useStore(useAuthStoreApi(), selector);
}

export function useUiState<TSelected = UiStoreState>(
  selector: (state: UiStoreState) => TSelected = identity as (state: UiStoreState) => TSelected,
): TSelected {
  return useStore(useUiStoreApi(), selector);
}

export function useSyncState<TSelected = SyncStoreState>(
  selector: (state: SyncStoreState) => TSelected = identity as (state: SyncStoreState) => TSelected,
): TSelected {
  return useStore(useSyncStoreApi(), selector);
}

export function useThemeState<TSelected = ThemeStoreState>(
  selector: (state: ThemeStoreState) => TSelected = identity as (state: ThemeStoreState) => TSelected,
): TSelected {
  return useStore(useThemeStoreApi(), selector);
}

export function useSystemStatus(): SystemStatusVM {
  const realtimeStore = useContext(RealtimeStoreContext) ?? fallbackRealtimeStore;
  const realtimeState = useStore(realtimeStore, (state) => state);
  return createSystemStatusVm(realtimeState);
}

export function useDashboardSnapshotQuery() {
  const client = useRestClient();
  return useQuery(createDashboardSnapshotQuery(client));
}

export function useTasksQuery() {
  const client = useRestClient();
  return useQuery(createTasksQuery(client));
}

export function useWorkflowsQuery() {
  const client = useRestClient();
  return useQuery(createWorkflowsQuery(client));
}

export function useApprovalsQuery() {
  const client = useRestClient();
  return useQuery(createApprovalsQuery(client));
}

export function useIncidentsQuery() {
  const client = useRestClient();
  return useQuery(createIncidentsQuery(client));
}

export function useWorkersQuery() {
  const client = useRestClient();
  return useQuery(createWorkersQuery(client));
}

export function useQueuesQuery() {
  const client = useRestClient();
  return useQuery(createQueuesQuery(client));
}

export function useAgentsQuery() {
  const client = useRestClient();
  return useQuery(createAgentsQuery(client));
}

export function useAnalyticsQuery() {
  const client = useRestClient();
  return useQuery(createAnalyticsQuery(client));
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
