import type { AgentDTO, DashboardSnapshotDTO, IncidentDTO, QueueDTO, WorkerDTO } from "@aa/shared-types";
export interface StabilityVm {
    readonly metrics: readonly {
        label: string;
        value: string | number;
    }[];
    readonly rows: readonly {
        key: string;
        value: string;
    }[];
    readonly items: readonly {
        title: string;
        description: string;
    }[];
}
export declare function mapStabilityToVm(snapshot: DashboardSnapshotDTO | null, incidents: readonly IncidentDTO[], workers: readonly WorkerDTO[], queues: readonly QueueDTO[], agents: readonly AgentDTO[]): StabilityVm;
export declare function useStabilityVm(): StabilityVm;
