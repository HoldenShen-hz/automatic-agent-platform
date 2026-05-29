import { QueryClient } from "@tanstack/react-query";
import { type PropsWithChildren, type ReactElement } from "react";
import { type RESTClient, type WSClient } from "@aa/shared-api-client";
import type { SystemStatusVM } from "@aa/shared-types";
import { type AuthStoreState } from "./stores/auth-store";
import { type SyncStoreState } from "./stores/sync-store";
import { type UiStoreState } from "./stores/ui-store";
import { type ThemeStoreState } from "./stores/theme-store";
export * from "./query-cache-persistence";
export type { AuthStoreState } from "./stores/auth-store";
export { createAuthStore } from "./stores/auth-store";
export type { UiStoreState } from "./stores/ui-store";
export { createUiStore } from "./stores/ui-store";
export type { RealtimeStoreState } from "./stores/realtime-store";
export { createRealtimeStore } from "./stores/realtime-store";
export type { SyncStoreState } from "./stores/sync-store";
export { createSyncStore } from "./stores/sync-store";
export { createNotificationStore } from "./stores/notification-store";
export type { NotificationStoreState, Notification, NotificationKind } from "./stores/notification-store";
export { createThemeStore } from "./stores/theme-store";
export type { ThemeStoreState, ThemeMode, ResolvedThemeName } from "./stores/theme-store";
export { CACHE_TIER_STALE_TIME, createQueryClient, createQueryClientFactory, createTieredQueryClientFactory, type QueryCacheTier, } from "./query-client";
export * from "./mutations/index";
export declare function UiRuntimeProvider({ children, client, queryClient, wsClient, wsUrl, wsToken, tokenManager, authContext, }: PropsWithChildren<{
    client?: RESTClient;
    queryClient?: QueryClient;
    wsClient?: WSClient;
    wsUrl?: string;
    wsToken?: string;
    tokenManager?: {
        getAccessToken?: () => string | null;
        getSession?: () => {
            accessToken: string;
        } | null;
    };
    authContext?: {
        userId?: string;
        tenantId?: string;
        permissions?: readonly string[];
        roles?: readonly string[];
    };
}>): ReactElement;
export declare function useRestClient(): RESTClient;
export declare function useWsClient(): WSClient;
export declare function useAuthStoreApi(): import("zustand").StoreApi<AuthStoreState>;
export declare function useUiStoreApi(): import("zustand").StoreApi<UiStoreState>;
export declare function useSyncStoreApi(): import("zustand").StoreApi<SyncStoreState>;
export declare function useThemeStoreApi(): import("zustand").StoreApi<ThemeStoreState>;
export declare function useAuthState<TSelected = AuthStoreState>(selector?: (state: AuthStoreState) => TSelected): TSelected;
export declare function useUiState<TSelected = UiStoreState>(selector?: (state: UiStoreState) => TSelected): TSelected;
export declare function useSyncState<TSelected = SyncStoreState>(selector?: (state: SyncStoreState) => TSelected): TSelected;
export declare function useThemeState<TSelected = ThemeStoreState>(selector?: (state: ThemeStoreState) => TSelected): TSelected;
export declare function useSystemStatus(): SystemStatusVM;
export declare function useDashboardSnapshotQuery(): import("@tanstack/react-query").UseQueryResult<import("@aa/shared-types").DashboardSnapshotDTO, Error>;
export declare function useTasksQuery(options?: {
    refetchInterval?: number | false;
}): import("@tanstack/react-query").UseQueryResult<readonly import("@aa/shared-types").TaskDTO[], Error>;
export declare function useWorkflowsQuery(): import("@tanstack/react-query").UseQueryResult<readonly import("@aa/shared-types").WorkflowDTO[], Error>;
export declare function useApprovalsQuery(): import("@tanstack/react-query").UseQueryResult<readonly import("@aa/shared-types").ApprovalDTO[], Error>;
export declare function useIncidentsQuery(options?: {
    readonly enabled?: boolean;
}): import("@tanstack/react-query").UseQueryResult<readonly import("@aa/shared-types").IncidentDTO[], Error>;
export declare function useWorkersQuery(options?: {
    readonly enabled?: boolean;
}): import("@tanstack/react-query").UseQueryResult<readonly import("@aa/shared-types").WorkerDTO[], Error>;
export declare function useQueuesQuery(options?: {
    readonly enabled?: boolean;
}): import("@tanstack/react-query").UseQueryResult<readonly import("@aa/shared-types").QueueDTO[], Error>;
export declare function useAgentsQuery(options?: {
    readonly enabled?: boolean;
}): import("@tanstack/react-query").UseQueryResult<readonly import("@aa/shared-types").AgentDTO[], Error>;
export declare function useMissionsQuery(): import("@tanstack/react-query").UseQueryResult<readonly import("@aa/shared-types").MissionDTO[], Error>;
export declare function useAnalyticsQuery(options?: {
    readonly enabled?: boolean;
}): import("@tanstack/react-query").UseQueryResult<readonly import("@aa/shared-types").AnalyticsMetricDTO[], Error>;
export declare function useCostReportsQuery(): import("@tanstack/react-query").UseQueryResult<readonly import("@aa/shared-types").CostReportDTO[], Error>;
export declare function useMarketplaceQuery(): import("@tanstack/react-query").UseQueryResult<readonly import("@aa/shared-types").MarketplacePackDTO[], Error>;
export declare function useExplanationsQuery(): import("@tanstack/react-query").UseQueryResult<readonly import("@aa/shared-types").ExplanationDTO[], Error>;
export declare function useRolesQuery(): import("@tanstack/react-query").UseQueryResult<readonly import("@aa/shared-types").RoleDTO[], Error>;
export declare function useFeatureFlagsQuery(): import("@tanstack/react-query").UseQueryResult<readonly import("@aa/shared-types").FeatureFlagDTO[], Error>;
export declare function useModelsQuery(): import("@tanstack/react-query").UseQueryResult<readonly import("@aa/shared-types").ModelConfigDTO[], Error>;
export declare function useDomainConfigsQuery(): import("@tanstack/react-query").UseQueryResult<readonly import("@aa/shared-types").DomainConfigDTO[], Error>;
export declare function useTenantsQuery(): import("@tanstack/react-query").UseQueryResult<readonly import("@aa/shared-types").TenantDTO[], Error>;
export declare function useWebhooksQuery(): import("@tanstack/react-query").UseQueryResult<readonly import("@aa/shared-types").WebhookDTO[], Error>;
export declare function usePreferencesQuery(): import("@tanstack/react-query").UseQueryResult<import("@aa/shared-types").UserPreferenceDTO, Error>;
