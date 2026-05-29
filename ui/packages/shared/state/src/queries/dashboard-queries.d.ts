import { type RESTClient } from "@aa/shared-api-client";
import type { SystemStatusVM } from "@aa/shared-types";
export declare const dashboardQueryKeys: {
    snapshot: readonly ["dashboard", "snapshot"];
    analytics: readonly ["analytics"];
};
export declare function createDashboardSnapshotQuery(client: RESTClient): {
    queryKey: readonly ["dashboard", "snapshot"];
    queryFn: import("@tanstack/query-core").QueryFunction<import("@aa/shared-types").DashboardSnapshotDTO, readonly ["dashboard", "snapshot"]>;
};
export declare function createAnalyticsQuery(client: RESTClient): {
    queryKey: readonly ["analytics"];
    queryFn: import("@tanstack/query-core").QueryFunction<readonly import("@aa/shared-types").AnalyticsMetricDTO[], readonly ["analytics"]>;
};
export declare function createSystemStatusVm(input?: Partial<SystemStatusVM>): SystemStatusVM;
