import type { QueueDTO } from "@aa/shared-types";
export interface QueuesVm {
    readonly metrics: readonly {
        label: string;
        value: string | number;
    }[];
}
export declare function mapQueuesToVm(queues: readonly QueueDTO[]): QueuesVm;
export declare function useQueuesVm(): QueuesVm;
