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
import { AuthService, TokenManager } from "@aa/shared-auth";
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
import { createTasksQuery, createWorkflowsQuery, createWorkflowRunStepsQuery } from "./queries/task-queries";
import { createQueryClientFactory } from "./query-client";
import { createAuthStore, type AuthStoreState } from "./stores/auth-store";
import { createRealtimeStore } from "./stores/realtime-store";
import { createSyncStore, type SyncStoreState } from "./stores/sync-store";
import { createUiStore, type UiStoreState } from "./stores/ui-store";
import { createNotificationStore, type NotificationStoreState } from "./stores/notification-store";
import { createThemeStore, type ThemeStoreState } from "./stores/theme-store";

export type { AuthStoreState } from "./stores/auth-store";
export { createAuthStore } from "./stores/auth-store";
export type { UiStoreState } from "./stores/ui-store";
export { createUiStore } from "./stores/ui-store";
export type { RealtimeStoreState } from "./stores/realtime-store";
export { createRealtimeStore } from "./stores/realtime-store";
export type { SyncStoreState } from "./stores/sync-store";
export { createSyncStore } from "./stores/sync-store";
export type { NotificationStoreState, Notification, NotificationKind } from "./stores/notification-store";
export { createNotificationStore } from "./stores/notification-store";
export type { ThemeStoreState, ThemeMode, ColorScheme } from "./stores/theme-store";
export { createThemeStore } from "./stores/theme-store";
export { createQueryClientFactory } from "./query-client";

interface UiRuntimeAuthContext {
  readonly userId: string;
  readonly tenantId: string;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
}

const ApiClientContext = createContext<RESTClient | null>(null);
const WsClientContext = createContext<WSClient | null>(null);
const AuthStoreContext = createContext<ReturnType<typeof createAuthStore> | null>(null);
const UiStoreContext = createContext<ReturnType<typeof createUiStore> | null>(null);
const RealtimeStoreContext = createContext<ReturnType<typeof createRealtimeStore> | null>(null);
const SyncStoreContext = createContext<ReturnType<typeof createSyncStore> | null>(null);
const NotificationStoreContext = createContext<ReturnType<typeof createNotificationStore> | null>(null);
const ThemeStoreContext = createContext<ReturnType<typeof createThemeStore> | null>(null);
const AuthServiceContext = createContext<AuthService | null>(null);
const SyncCoordinatorContext = createContext<SyncCoordinator | null>(null);
const fallbackAuthStore = createAuthStore();
const fallbackUiStore = createUiStore();
const fallbackRealtimeStore = createRealtimeStore();
const fallbackSyncStore = createSyncStore();
const fallbackNotificationStore = createNotificationStore();
const fallbackThemeStore = createThemeStore();

export function UiRuntimeProvider(
  {
    children,
    client,
    queryClient,
    tokenManager,
    wsClient,
    wsUrl,
    authContext,
  }: PropsWithChildren<{
    client?: RESTClient;
    queryClient?: QueryClient;
    tokenManager?: TokenManager;
    wsClient?: WSClient;
    wsUrl?: string;
    authContext?: UiRuntimeAuthContext;
  }>,
): ReactElement {
  const resolvedClient = client ?? new DefaultRESTClient();
  const resolvedQueryClient = queryClient ?? createQueryClientFactory();
  const resolvedWsClient = wsClient ?? new InMemoryWSClient();
  const authStore = useMemo(() => createAuthStore(), []);
  const uiStore = useMemo(() => createUiStore(), []);
  const realtimeStore = useMemo(() => createRealtimeStore(), []);
  const syncStore = useMemo(() => createSyncStore(), []);
  const notificationStore = useMemo(() => createNotificationStore(), []);
  const themeStore = useMemo(() => createThemeStore(), []);
  const resolvedTokenManager = useMemo(() => tokenManager ?? new TokenManager(), [tokenManager]);
  const authService = useMemo(() => new AuthService(resolvedTokenManager), [resolvedTokenManager]);
  const syncCoordinator = useMemo(() => new SyncCoordinator(), []);

  useEffect(() => {
    let disposed = false;
    const router = new WSEventRouter(
      resolvedWsClient,
      resolvedQueryClient,
      () => realtimeStore.getState().triggerPanic(),
    );
    const disposeStatus = resolvedWsClient.onStatusChange((status) => {
      realtimeStore.getState().setWsStatus(status);
    });

    const bootstrap = async (): Promise<void> => {
      const params = new URLSearchParams(window.location.search);
      const identity = authService.resolveIdentity(params);
      if (params.has("code") && !authService.isAuthenticated()) {
        try {
          await authService.handleAuthorizationCallback(params);
        } catch {
          // Fail closed: do not synthesize demo credentials into the runtime.
        }
      }
      if (disposed) {
        return;
      }

      const session = authService.getSession();
      if (session !== null && authContext != null) {
        authStore.getState().login({
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresAt: session.expiresAt,
          userId: authContext.userId,
          tenantId: authContext.tenantId,
          roles: authContext.roles,
          permissions: authContext.permissions,
        });
      }
      authStore.getState().setLocale(identity.locale);
      uiStore.getState().setActiveRoute("/mission-control/dashboard");
      uiStore.getState().setActiveFeature("dashboard");

      const bootstrapMutations: OfflineMutation[] = [
        {
          id: "bootstrap-dashboard-prefetch",
          endpoint: "/api/v1/dashboard/prefetch",
          method: "POST",
          body: { scope: "mission-control" },
          createdAt: "2026-04-23T00:00:00.000Z",
          idempotencyKey: "bootstrap-dashboard-prefetch-key",
          retryCount: 0,
          status: "pending",
        },
        {
          id: "bootstrap-approvals-prefetch",
          endpoint: "/api/v1/approvals/prefetch",
          method: "POST",
          body: { queue: "primary" },
          createdAt: "2026-04-23T00:00:01.000Z",
          idempotencyKey: "bootstrap-approvals-prefetch-key",
          retryCount: 0,
          status: "pending",
        },
      ];
      syncCoordinator.queueMutations(bootstrapMutations);
      syncStore.getState().setPendingMutations(syncCoordinator.pendingCount());

      const wsToken = session?.accessToken ?? null;
      if (wsUrl != null && wsToken != null && wsToken.length > 0) {
        router.connect(wsUrl, wsToken);
        router.subscribe("global");
        router.subscribe("dashboard");
        router.subscribe("approvals");
        router.subscribe("incidents");
        router.subscribe("agents");
      }
      resolvedWsClient.publish({ channel: "dashboard", type: "dashboard.metric_updated", payload: { source: "bootstrap" } });
      resolvedWsClient.useSseFallback();
      realtimeStore.getState().setOfflineQueueSize(syncCoordinator.pendingCount());
      realtimeStore.getState().setSyncStatus("queued");
    };

    void bootstrap();

    return () => {
      disposed = true;
      disposeStatus();
      router.disconnect();
    };
  }, [authContext, authService, authStore, realtimeStore, resolvedQueryClient, resolvedWsClient, syncCoordinator, syncStore, uiStore, wsUrl]);
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
                    NotificationStoreContext.Provider,
                    { value: notificationStore },
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
    ),
  );
}

export function useRestClient(): RESTClient {
  return useContext(ApiClientContext) ?? new DefaultRESTClient();
}

export function useWsClient(): WSClient {
  return useContext(WsClientContext) ?? new InMemoryWSClient();
}

export function useAuthState(): AuthStoreState {
  const store = useContext(AuthStoreContext) ?? fallbackAuthStore;
  return useStore(store, (state) => state);
}

export function useUiState(): UiStoreState {
  const store = useContext(UiStoreContext) ?? fallbackUiStore;
  return useStore(store, (state) => state);
}

export function useSyncState(): SyncStoreState {
  const store = useContext(SyncStoreContext) ?? fallbackSyncStore;
  return useStore(store, (state) => state);
}

export function useNotificationState(): NotificationStoreState {
  const store = useContext(NotificationStoreContext) ?? fallbackNotificationStore;
  return useStore(store, (state) => state);
}

export function useThemeState(): ThemeStoreState {
  const store = useContext(ThemeStoreContext) ?? fallbackThemeStore;
  return useStore(store, (state) => state);
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

export function useWorkflowRunStepsQuery(workflowRunId: string) {
  const client = useRestClient();
  return useQuery(createWorkflowRunStepsQuery(client, workflowRunId));
}
