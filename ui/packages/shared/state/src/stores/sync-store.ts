import { createStore } from "zustand/vanilla";
import { withPersistDevtoolsDraft } from "./middleware";

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
  return createStore<SyncStoreState>()(
    withPersistDevtoolsDraft(
      "aa-sync-store",
      (set) => ({
        online: typeof navigator !== "undefined" ? navigator.onLine : true,
        pendingMutations: 0,
        lastFlushedAt: null,
        syncStatus: "idle",
        conflicts: [],
        setOnline(online) {
          set((draft) => {
            draft.online = online;
            draft.syncStatus = online ? "idle" : "offline";
          });
        },
        setPendingMutations(pendingMutations) {
          set((draft) => {
            draft.pendingMutations = pendingMutations;
          });
        },
        markFlushed(lastFlushedAt) {
          set((draft) => {
            draft.pendingMutations = 0;
            draft.lastFlushedAt = lastFlushedAt;
            draft.syncStatus = "idle";
          });
        },
        setSyncStatus(syncStatus) {
          set((draft) => {
            draft.syncStatus = syncStatus;
          });
        },
        addConflict(conflict) {
          set((draft) => {
            draft.conflicts = [...draft.conflicts, conflict];
          });
        },
        resolveConflict(conflictId, _resolution) {
          set((draft) => {
            draft.conflicts = draft.conflicts.filter((conflict) => conflict.id !== conflictId);
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
