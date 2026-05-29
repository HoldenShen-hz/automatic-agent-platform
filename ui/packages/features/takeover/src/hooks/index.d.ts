export interface TakeoverSnapshot {
    readonly taskId: string;
    readonly owner: string;
    readonly status: string;
    readonly steps: readonly unknown[];
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
    readonly currentSnapshot: TakeoverSnapshot | null;
    readonly ownershipHistory: readonly TakeoverHistoryEntry[];
    claimOwnership(taskId: string, owner: string): Promise<void>;
    transferOwnership(taskId: string, owner: string, reason: string): Promise<void>;
    restoreFromSnapshot(snapshot: TakeoverSnapshot): void;
    takeoverCurrentTask(owner: string): Promise<void>;
    annotateCurrentSnapshot(note: string, owner: string): void;
    resumeAutomaticExecution(owner: string): Promise<void>;
}
export declare function useTakeoverVm(): TakeoverVm;
