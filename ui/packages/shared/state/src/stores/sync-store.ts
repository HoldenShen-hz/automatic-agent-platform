import { createStore } from "zustand/vanilla";

/**
 * SyncStore state per §5.1.1 - complete sync state including online status and conflicts.
 */
export type SyncStatusValue = "idle" | "syncing" | "error" | "offline";
export type ConflictResolutionStrategy = "server_wins" | "local_wins" | "merge";

export interface SyncStoreState {
  readonly online: boolean;
  readonly pendingMutations: number;
  readonly lastFlushedAt: string | null;
  readonly syncStatus: SyncStatusValue;
  readonly conflicts: readonly ConflictInfo[];
  setOnline(online: boolean): void;
  setPendingMutations(count: number): void;
  markFlushed(flushedAt: string): void;
  setSyncStatus(status: SyncStatusValue): void;
  addConflict(conflict: ConflictInfo): void;
  resolveConflict(conflictId: string, resolution: ConflictResolutionStrategy): void;
  retrySync(): void;
}

export interface ConflictInfo {
  readonly id: string;
  readonly endpoint: string;
  readonly localValue: unknown;
  readonly serverValue: unknown;
  readonly occurredAt: string;
}

export function createSyncStore() {
  return createStore<SyncStoreState>((set) => ({
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    pendingMutations: 0,
    lastFlushedAt: null,
    syncStatus: "idle",
    conflicts: [],
    setOnline(online) {
      set({ online, syncStatus: online ? "idle" : "offline" });
    },
    setPendingMutations(pendingMutations) {
      set({ pendingMutations });
    },
    markFlushed(lastFlushedAt) {
      set({ pendingMutations: 0, lastFlushedAt, syncStatus: "idle" });
    },
    setSyncStatus(syncStatus) {
      set({ syncStatus });
    },
    addConflict(conflict) {
      set((state) => ({ conflicts: [...state.conflicts, conflict] }));
    },
    resolveConflict(conflictId, _resolution) {
      set((state) => ({
        conflicts: state.conflicts.filter((c) => c.id !== conflictId),
      }));
    },
    retrySync() {
      set({ syncStatus: "syncing" });
    },
  }));
}
