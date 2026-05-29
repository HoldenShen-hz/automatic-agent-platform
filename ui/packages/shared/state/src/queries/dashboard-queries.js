import { fetchAnalytics, fetchDashboardSnapshot } from "@aa/shared-api-client";
import { createReadonlyQuery } from "./helpers";
export const dashboardQueryKeys = {
    snapshot: ["dashboard", "snapshot"],
    analytics: ["analytics"],
};
export function createDashboardSnapshotQuery(client) {
    return createReadonlyQuery(dashboardQueryKeys.snapshot, () => fetchDashboardSnapshot(client));
}
export function createAnalyticsQuery(client) {
    return createReadonlyQuery(dashboardQueryKeys.analytics, () => fetchAnalytics(client));
}
export function createSystemStatusVm(input) {
    return {
        wsStatus: input?.wsStatus ?? "disconnected",
        offlineQueueSize: input?.offlineQueueSize ?? 0,
        syncStatus: input?.syncStatus ?? "idle",
        panicActivated: input?.panicActivated ?? false,
    };
}
