import { createStore } from "zustand/vanilla";
import { withPersistDevtoolsDraft } from "./middleware";

type SyncStoreDraft = {
  -readonly [K in keyof SyncStoreState]:
    SyncStoreState[K] extends readonly (infer U)[] ? U[]
      : SyncStoreState[K];
};

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

export function createSyncStore() {
  return createStore<SyncStoreState>()(
    withPersistDevtoolsDraft(
      "aa-sync-store",
      (set) => ({
        pendingMutations: 0,
        lastFlushedAt: null,
        strategy: "server_wins",
        syncStatus: "idle",
        online: true,
        conflicts: [],
        conflictLookup: {},
        lastError: null,
        setPendingMutations(pendingMutations) {
          set((draft: SyncStoreDraft) => {
            draft.pendingMutations = pendingMutations;
            draft.syncStatus = pendingMutations > 0
              ? "queued"
              : draft.conflicts.length > 0
                ? "queued"
                : "idle";
            if (pendingMutations === 0) {
              draft.lastError = null;
            }
          });
        },
        markFlushed(lastFlushedAt) {
          set((draft: SyncStoreDraft) => {
            draft.pendingMutations = 0;
            draft.lastFlushedAt = lastFlushedAt;
            draft.syncStatus = "idle";
            draft.lastError = null;
          });
        },
        setStrategy(strategy) {
          set((draft: SyncStoreDraft) => {
            draft.strategy = strategy;
          });
        },
        setOnline(online) {
          set((draft: SyncStoreDraft) => {
            draft.online = online;
            if (!online) {
              draft.syncStatus = draft.pendingMutations > 0 ? "queued" : draft.syncStatus;
            }
          });
        },
        addConflict(conflict) {
          set((draft: SyncStoreDraft) => {
            draft.conflicts = [...draft.conflicts, conflict];
            draft.conflictLookup = {
              ...draft.conflictLookup,
              [conflict.id]: conflict,
            };
            draft.syncStatus = "queued";
          });
        },
        resolveConflict(conflictId, resolution) {
          set((draft: SyncStoreDraft) => {
            draft.conflicts = draft.conflicts.filter((conflict) => conflict.id !== conflictId);
            const nextLookup = { ...draft.conflictLookup };
            delete nextLookup[conflictId];
            draft.conflictLookup = nextLookup;
            if (draft.syncStatus !== "syncing") {
              draft.syncStatus = draft.pendingMutations > 0 || draft.conflicts.length > 0 ? "queued" : "idle";
            }
            draft.lastError = null;
            void resolution;
          });
        },
        markSyncError(lastError) {
          set((draft: SyncStoreDraft) => {
            draft.lastError = lastError;
            draft.syncStatus = "error";
          });
        },
        clearSyncError() {
          set((draft: SyncStoreDraft) => {
            draft.lastError = null;
            if (draft.syncStatus === "error") {
              draft.syncStatus = draft.pendingMutations > 0 ? "queued" : "idle";
            }
          });
        },
        retrySync() {
          set((draft: SyncStoreDraft) => {
            draft.lastError = null;
            draft.syncStatus = "syncing";
          });
        },
      }),
    ),
  );
}
