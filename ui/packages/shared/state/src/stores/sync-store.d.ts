export interface SyncConflict {
    readonly id: string;
    readonly endpoint: string;
    readonly localValue: unknown;
    readonly serverValue: unknown;
    readonly occurredAt: string;
}
export interface SyncStoreState {
    readonly pendingMutations: number;
    readonly lastFlushedAt: string | null;
    readonly strategy: "server_wins" | "local_wins";
    readonly syncStatus: "idle" | "queued" | "syncing" | "error";
    readonly online: boolean;
    readonly conflicts: readonly SyncConflict[];
    readonly conflictLookup: Readonly<Record<string, SyncConflict>>;
    readonly lastError: string | null;
    setPendingMutations(count: number): void;
    markFlushed(flushedAt: string): void;
    setStrategy(strategy: "server_wins" | "local_wins"): void;
    setOnline(online: boolean): void;
    addConflict(conflict: SyncConflict): void;
    resolveConflict(conflictId: string, resolution: "local" | "server" | "merge"): void;
    markSyncError(message: string): void;
    clearSyncError(): void;
    retrySync(): void;
}
export declare function createSyncStore(): import("zustand").StoreApi<SyncStoreState>;
