import type { WorkflowRunStepDTO } from "@aa/shared-types";
export interface TakeoverSnapshot {
    readonly taskId: string;
    readonly owner: string;
    readonly status: string;
    readonly steps: readonly WorkflowRunStepDTO[];
    readonly capturedAt: string;
}
export interface TakeoverHistoryEntry {
    readonly taskId: string;
    readonly owner: string;
    readonly action: string;
    readonly recordedAt: string;
}
export interface TakeoverVm {
    readonly items: readonly {
        title: string;
        description: string;
    }[];
    readonly loading: boolean;
    readonly mutating: boolean;
    readonly errorMessage: string | null;
    readonly currentSnapshot: TakeoverSnapshot | null;
    readonly ownershipHistory: readonly TakeoverHistoryEntry[];
    readonly canTakeover: boolean;
    readonly canAnnotate: boolean;
    readonly canResume: boolean;
    claimOwnership(taskId: string, owner: string): Promise<void>;
    takeoverCurrentTask(owner: string): Promise<void>;
    annotateCurrentSnapshot(note: string, owner: string): Promise<void>;
    resumeAutomaticExecution(owner: string): Promise<void>;
    refresh(): Promise<void>;
}
export declare function useTakeoverVm(): TakeoverVm;
