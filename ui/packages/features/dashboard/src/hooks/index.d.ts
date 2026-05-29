import type { AgentDTO, AnalyticsMetricDTO, DashboardSnapshotDTO, IncidentDTO, QueueDTO, WorkerDTO } from "@aa/shared-types";
export interface DashboardPanel {
    readonly id: string;
    readonly title: string;
    readonly value: string;
    readonly description: string;
}
export interface DashboardPanelGroup {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly panels: readonly DashboardPanel[];
}
export interface DashboardVm {
    readonly loading: boolean;
    readonly metrics: readonly {
        label: string;
        value: string | number;
    }[];
    readonly trendValues: readonly number[];
    readonly panelGroups: readonly DashboardPanelGroup[];
    readonly drilldownTrail: readonly string[];
    readonly operatorWorkflowChecks: readonly string[];
    readonly snapshot: DashboardSnapshotDTO | null;
}
export declare function mapDashboardSnapshotToVm(snapshot: DashboardSnapshotDTO | null, analytics?: readonly AnalyticsMetricDTO[], incidents?: readonly IncidentDTO[], workers?: readonly WorkerDTO[], queues?: readonly QueueDTO[], agents?: readonly AgentDTO[]): DashboardVm;
export declare function useDashboardVm(): DashboardVm;
