import { createStore } from "zustand/vanilla";
import { withPersistDevtoolsDraft } from "./middleware";

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
  readonly syncStatus: "idle" | "queued" | "syncing";
  readonly conflicts: readonly SyncConflict[];
  setPendingMutations(count: number): void;
  markFlushed(flushedAt: string): void;
  setStrategy(strategy: "server_wins" | "local_wins"): void;
  addConflict(conflict: SyncConflict): void;
  resolveConflict(conflictId: string, resolution: "local" | "server" | "merge"): void;
  retrySync(): void;
}

export function createSyncStore() {
  return createStore<SyncStoreState>()(
    withPersistDevtoolsDraft(
      "aa-sync-store",
      (set) => ({
        pendingMutations: 0,
        lastFlushedAt: null,
        strategy: "server_wins",
        syncStatus: "idle",
        conflicts: [],
        setPendingMutations(pendingMutations) {
          set((draft) => {
            draft.pendingMutations = pendingMutations;
            draft.syncStatus = pendingMutations > 0 ? "queued" : draft.syncStatus;
          });
        },
        markFlushed(lastFlushedAt) {
          set((draft) => {
            draft.pendingMutations = 0;
            draft.lastFlushedAt = lastFlushedAt;
            draft.syncStatus = "idle";
          });
        },
        setStrategy(strategy) {
          set((draft) => {
            draft.strategy = strategy;
          });
        },
        addConflict(conflict) {
          set((draft) => {
            draft.conflicts = [...draft.conflicts, conflict];
            draft.syncStatus = "queued";
          });
        },
        resolveConflict(conflictId, resolution) {
          set((draft) => {
            draft.conflicts = draft.conflicts.filter((conflict) => conflict.id !== conflictId);
            if (resolution === "local") {
              draft.strategy = "local_wins";
            }
            if (resolution === "server") {
              draft.strategy = "server_wins";
            }
          });
        },
        retrySync() {
          set((draft) => {
            draft.syncStatus = "syncing";
          });
        },
      }),
    ),
  );
}
