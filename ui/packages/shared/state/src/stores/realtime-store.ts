import { createStore } from "zustand/vanilla";

export interface RealtimeStoreState {
  readonly wsStatus: string;
  readonly panicActivated: boolean;
  readonly offlineQueueSize: number;
  readonly syncStatus: "idle" | "queued" | "syncing";
  setWsStatus(status: string): void;
  triggerPanic(): void;
  setOfflineQueueSize(size: number): void;
  setSyncStatus(status: "idle" | "queued" | "syncing"): void;
}

export function createRealtimeStore() {
  return createStore<RealtimeStoreState>((set) => ({
    wsStatus: "disconnected",
    panicActivated: false,
    offlineQueueSize: 0,
    syncStatus: "idle",
    setWsStatus(wsStatus) {
      set({ wsStatus });
    },
    triggerPanic() {
      set({ panicActivated: true });
    },
    setOfflineQueueSize(offlineQueueSize) {
      set({ offlineQueueSize });
    },
    setSyncStatus(syncStatus) {
      set({ syncStatus });
    },
  }));
}
