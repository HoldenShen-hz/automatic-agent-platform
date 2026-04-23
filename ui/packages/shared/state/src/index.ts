import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createContext, createElement, useContext, type PropsWithChildren, type ReactElement } from "react";
import { createStore } from "zustand/vanilla";
import {
  DefaultRESTClient,
  fetchApprovals,
  fetchDashboardSnapshot,
  fetchPreferences,
  fetchTasks,
  type RESTClient,
} from "@aa/shared-api-client";

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
  setWsStatus(status: string): void;
  triggerPanic(): void;
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
    setWsStatus(wsStatus) {
      set({ wsStatus });
    },
    triggerPanic() {
      set({ panicActivated: true });
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

export function UiRuntimeProvider(
  { children, client, queryClient }: PropsWithChildren<{ client?: RESTClient; queryClient?: QueryClient }>,
): ReactElement {
  const resolvedClient = client ?? new DefaultRESTClient();
  const resolvedQueryClient = queryClient ?? createQueryClientFactory();
  return createElement(
    ApiClientContext.Provider,
    { value: resolvedClient },
    createElement(QueryClientProvider, { client: resolvedQueryClient }, children),
  );
}

export function useRestClient(): RESTClient {
  return useContext(ApiClientContext) ?? new DefaultRESTClient();
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

export function useApprovalsQuery() {
  const client = useRestClient();
  return useQuery({
    queryKey: ["approvals"],
    queryFn: () => fetchApprovals(client),
  });
}

export function usePreferencesQuery() {
  const client = useRestClient();
  return useQuery({
    queryKey: ["preferences"],
    queryFn: () => fetchPreferences(client),
  });
}
