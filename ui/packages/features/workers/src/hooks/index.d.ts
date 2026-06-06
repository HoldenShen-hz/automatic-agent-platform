import type { WorkerDTO } from "@aa/shared-types";
export interface WorkersVm {
    readonly loading: boolean;
    readonly metrics: readonly {
        label: string;
        value: string | number;
    }[];
    readonly busyWorkerCount: number;
    refresh(): Promise<void>;
    drainBusyWorkers(): Promise<void>;
}
export declare function mapWorkersToVm(workers: readonly WorkerDTO[]): WorkersVm;
export declare function useWorkersVm(): WorkersVm;
