import type { WorkerDTO } from "@aa/shared-types";
export interface WorkersVm {
    readonly metrics: readonly {
        label: string;
        value: string | number;
    }[];
}
export declare function mapWorkersToVm(workers: readonly WorkerDTO[]): WorkersVm;
export declare function useWorkersVm(): WorkersVm;
