import { createStore } from "zustand/vanilla";
import { withPersistDevtoolsDraft } from "./middleware";
export function createSyncStore() {
    return createStore()(withPersistDevtoolsDraft("aa-sync-store", (set) => ({
        pendingMutations: 0,
        lastFlushedAt: null,
        strategy: "server_wins",
        syncStatus: "idle",
        online: true,
        conflicts: [],
        conflictLookup: {},
        lastError: null,
        setPendingMutations(pendingMutations) {
            set((draft) => {
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
            set((draft) => {
                draft.pendingMutations = 0;
                draft.lastFlushedAt = lastFlushedAt;
                draft.syncStatus = "idle";
                draft.lastError = null;
            });
        },
        setStrategy(strategy) {
            set((draft) => {
                draft.strategy = strategy;
            });
        },
        setOnline(online) {
            set((draft) => {
                draft.online = online;
                if (!online) {
                    draft.syncStatus = draft.pendingMutations > 0 ? "queued" : draft.syncStatus;
                }
            });
        },
        addConflict(conflict) {
            set((draft) => {
                draft.conflicts = [...draft.conflicts, conflict];
                draft.conflictLookup = {
                    ...draft.conflictLookup,
                    [conflict.id]: conflict,
                };
                draft.syncStatus = "queued";
            });
        },
        resolveConflict(conflictId, resolution) {
            set((draft) => {
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
            set((draft) => {
                draft.lastError = lastError;
                draft.syncStatus = "error";
            });
        },
        clearSyncError() {
            set((draft) => {
                draft.lastError = null;
                if (draft.syncStatus === "error") {
                    draft.syncStatus = draft.pendingMutations > 0 ? "queued" : "idle";
                }
            });
        },
        retrySync() {
            set((draft) => {
                draft.lastError = null;
                draft.syncStatus = "syncing";
            });
        },
    })));
}
