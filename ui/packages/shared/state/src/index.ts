import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createContext, createElement, useContext, useEffect, useMemo, type PropsWithChildren, type ReactElement } from "react";
import { createStore } from "zustand/vanilla";
import {
  DefaultRESTClient,
  InMemoryWSClient,
  WSEventRouter,
  fetchAgents,
  fetchAnalytics,
  fetchApprovals,
  fetchCosts,
  fetchDashboardSnapshot,
  fetchDomainConfigs,
  fetchExplanations,
  fetchFeatureFlags,
  fetchIncidents,
  fetchMarketplace,
  fetchModels,
  fetchPreferences,
  fetchQueues,
  fetchRoles,
  fetchTasks,
  fetchTenants,
  fetchWebhooks,
  fetchWorkflows,
  fetchWorkers,
  type RESTClient,
  type WSClient,
} from "@aa/shared-api-client";
import type { SystemStatusVM } from "@aa/shared-types";

export interface AuthStoreState {
  readonly authenticated: boolean;
  readonly locale: string;
  setAuthenticated(authenticated: boolean): void;
  setLocale(locale: string): void;
}

export interface UiStoreState {
  readonly activeRoute: string;
  readonly activeFeature: string;
  setActiveRoute(route: string): void;
  setActiveFeature(featureId: string): void;
}

export interface RealtimeStoreState {
  readonly wsStatus: string;
  readonly panicActivated: boolean;
  readonly offlineQueueSize: number;
  readonly syncStatus: "idle" | "queued" | "syncing";
  setWsStatus(status: string): void;
  triggerPanic(): void;
  setOfflineQueueSize(size: number): void;
  setSyncStatus(status: "idle" | "queued" | "syncing"): void;
}

export function createAuthStore() {
  return createStore<AuthStoreState>((set) => ({
    authenticated: false,
    locale: "zh-CN",
    setAuthenticated(authenticated) {
      set({ authenticated });
    },
    setLocale(locale) {
      set({ locale });
    },
  }));
}

export function createUiStore() {
  return createStore<UiStoreState>((set) => ({
    activeRoute: "/",
    activeFeature: "dashboard",
    setActiveRoute(activeRoute) {
      set({ activeRoute });
    },
    setActiveFeature(activeFeature) {
      set({ activeFeature });
    },
  }));
}

export function createRealtimeStore() {
  return createStore<RealtimeStoreState>((set) => ({
    wsStatus: "disconnected",
    panicActivated: false,
    offlineQueueSize: 0,
    syncStatus: "idle",
    setWsStatus(wsStatus) {
      set({ wsStatus });
    },
    triggerPanic() {
      set({ panicActivated: true });
    },
    setOfflineQueueSize(offlineQueueSize) {
      set({ offlineQueueSize });
    },
    setSyncStatus(syncStatus) {
      set({ syncStatus });
    },
  }));
}

export function createQueryClientFactory() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
      },
    },
  });
}

const ApiClientContext = createContext<RESTClient | null>(null);
const WsClientContext = createContext<WSClient | null>(null);
const RealtimeStoreContext = createContext<ReturnType<typeof createRealtimeStore> | null>(null);

export function UiRuntimeProvider(
  { children, client, queryClient, wsClient }: PropsWithChildren<{ client?: RESTClient; queryClient?: QueryClient; wsClient?: WSClient }>,
): ReactElement {
  const resolvedClient = client ?? new DefaultRESTClient();
  const resolvedQueryClient = queryClient ?? createQueryClientFactory();
  const resolvedWsClient = wsClient ?? new InMemoryWSClient();
  const realtimeStore = useMemo(() => createRealtimeStore(), []);
  useEffect(() => {
    const router = new WSEventRouter(
      resolvedWsClient,
      resolvedQueryClient,
      () => realtimeStore.getState().triggerPanic(),
    );
    const disposeStatus = resolvedWsClient.onStatusChange((status) => {
      realtimeStore.getState().setWsStatus(status);
    });

    router.connect("ws://local/ui", "demo-token");
    router.subscribe("global");
    router.subscribe("dashboard");
    router.subscribe("approvals");
    router.subscribe("incidents");
    router.subscribe("agents");
    resolvedWsClient.publish({ channel: "dashboard", type: "dashboard.metric_updated", payload: { source: "bootstrap" } });
    resolvedWsClient.useSseFallback();
    realtimeStore.getState().setOfflineQueueSize(2);
    realtimeStore.getState().setSyncStatus("queued");

    return () => {
      disposeStatus();
      router.disconnect();
    };
  }, [realtimeStore, resolvedQueryClient, resolvedWsClient]);
  return createElement(
    ApiClientContext.Provider,
    { value: resolvedClient },
    createElement(
      WsClientContext.Provider,
      { value: resolvedWsClient },
      createElement(
        RealtimeStoreContext.Provider,
        { value: realtimeStore },
        createElement(QueryClientProvider, { client: resolvedQueryClient }, children),
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

export function useSystemStatus(): SystemStatusVM {
  const realtimeStore = useContext(RealtimeStoreContext);
  const snapshot = realtimeStore?.getState();
  return {
    wsStatus: snapshot?.wsStatus ?? "disconnected",
    offlineQueueSize: snapshot?.offlineQueueSize ?? 0,
    syncStatus: snapshot?.syncStatus ?? "idle",
    panicActivated: snapshot?.panicActivated ?? false,
  };
}

export function useDashboardSnapshotQuery() {
  const client = useRestClient();
  return useQuery({
    queryKey: ["dashboard", "snapshot"],
    queryFn: () => fetchDashboardSnapshot(client),
  });
}

export function useTasksQuery() {
  const client = useRestClient();
  return useQuery({
    queryKey: ["tasks"],
    queryFn: () => fetchTasks(client),
  });
}

export function useWorkflowsQuery() {
  const client = useRestClient();
  return useQuery({
    queryKey: ["workflows"],
    queryFn: () => fetchWorkflows(client),
  });
}

export function useApprovalsQuery() {
  const client = useRestClient();
  return useQuery({
    queryKey: ["approvals"],
    queryFn: () => fetchApprovals(client),
  });
}

export function useIncidentsQuery() {
  const client = useRestClient();
  return useQuery({
    queryKey: ["incidents"],
    queryFn: () => fetchIncidents(client),
  });
}

export function useWorkersQuery() {
  const client = useRestClient();
  return useQuery({
    queryKey: ["workers"],
    queryFn: () => fetchWorkers(client),
  });
}

export function useQueuesQuery() {
  const client = useRestClient();
  return useQuery({
    queryKey: ["queues"],
    queryFn: () => fetchQueues(client),
  });
}

export function useAgentsQuery() {
  const client = useRestClient();
  return useQuery({
    queryKey: ["agents"],
    queryFn: () => fetchAgents(client),
  });
}

export function useAnalyticsQuery() {
  const client = useRestClient();
  return useQuery({
    queryKey: ["analytics"],
    queryFn: () => fetchAnalytics(client),
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
