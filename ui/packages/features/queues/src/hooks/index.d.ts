import type { QueueDTO } from "@aa/shared-types";
export interface QueuesVm {
    readonly metrics: readonly {
        label: string;
        value: string | number;
    }[];
    readonly retryQueueDepth: number;
    refresh(): Promise<void>;
    cleanupRetryQueue(): Promise<void>;
}
export declare function mapQueuesToVm(queues: readonly QueueDTO[]): QueuesVm;
export declare function useQueuesVm(): QueuesVm;
