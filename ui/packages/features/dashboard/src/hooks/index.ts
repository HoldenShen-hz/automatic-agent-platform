import { useDashboardSnapshotQuery } from "@aa/shared-state";
import type { DashboardSnapshotDTO } from "@aa/shared-types";

export interface DashboardVm {
  readonly loading: boolean;
  readonly metrics: readonly { label: string; value: string | number }[];
  readonly snapshot: DashboardSnapshotDTO | null;
}

export function mapDashboardSnapshotToVm(snapshot: DashboardSnapshotDTO | null): DashboardVm {
  return {
    loading: snapshot == null,
    snapshot,
    metrics: snapshot == null ? [] : [
      { label: "Overall Health", value: snapshot.overallHealth },
      { label: "Queue Depth", value: snapshot.queueDepth },
      { label: "Active Executions", value: snapshot.activeExecutions },
      { label: "Approval Backlog", value: snapshot.approvalBacklog },
    ],
  };
}

export function useDashboardVm(): DashboardVm {
  const query = useDashboardSnapshotQuery();
  return mapDashboardSnapshotToVm(query.data ?? null);
}
