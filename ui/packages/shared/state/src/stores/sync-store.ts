import { createStore } from "zustand/vanilla";

export interface SyncStoreState {
  readonly pendingMutations: number;
  readonly lastFlushedAt: string | null;
  readonly strategy: "server_wins" | "local_wins";
  setPendingMutations(count: number): void;
  markFlushed(flushedAt: string): void;
  setStrategy(strategy: "server_wins" | "local_wins"): void;
}

export function createSyncStore() {
  return createStore<SyncStoreState>((set) => ({
    pendingMutations: 0,
    lastFlushedAt: null,
    strategy: "server_wins",
    setPendingMutations(pendingMutations) {
      set({ pendingMutations });
    },
    markFlushed(lastFlushedAt) {
      set({ pendingMutations: 0, lastFlushedAt });
    },
    setStrategy(strategy) {
      set({ strategy });
    },
  }));
}
