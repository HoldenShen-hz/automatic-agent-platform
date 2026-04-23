import { fetchAnalytics, fetchDashboardSnapshot, type RESTClient } from "@aa/shared-api-client";
import type { SystemStatusVM } from "@aa/shared-types";
import { createReadonlyQuery } from "./helpers";

export const dashboardQueryKeys = {
  snapshot: ["dashboard", "snapshot"] as const,
  analytics: ["analytics"] as const,
};

export function createDashboardSnapshotQuery(client: RESTClient) {
  return createReadonlyQuery(dashboardQueryKeys.snapshot, () => fetchDashboardSnapshot(client));
}

export function createAnalyticsQuery(client: RESTClient) {
  return createReadonlyQuery(dashboardQueryKeys.analytics, () => fetchAnalytics(client));
}

export function createSystemStatusVm(input?: Partial<SystemStatusVM>): SystemStatusVM {
  return {
    wsStatus: input?.wsStatus ?? "disconnected",
    offlineQueueSize: input?.offlineQueueSize ?? 0,
    syncStatus: input?.syncStatus ?? "idle",
    panicActivated: input?.panicActivated ?? false,
  };
}
