import { createStore } from "zustand/vanilla";

/**
 * RealtimeStore state per §5.1.1 - complete realtime state including subscriptions and incidents.
 */
export type WSStatusType = "disconnected" | "connecting" | "connected" | "reconnecting" | "sse-fallback";

export interface RealtimeStoreState {
  readonly wsStatus: WSStatusType;
  readonly panicActivated: boolean;
  readonly offlineQueueSize: number;
  readonly syncStatus: "idle" | "queued" | "syncing";
  /** Active WebSocket subscriptions per §5.3.4 */
  readonly activeSubscriptions: readonly string[];
  /** Pending approval count for realtime updates */
  readonly pendingApprovalCount: number;
  /** Active incidents for monitoring */
  readonly activeIncidents: readonly string[];
  setWsStatus(status: WSStatusType): void;
  triggerPanic(): void;
  setOfflineQueueSize(size: number): void;
  setSyncStatus(status: "idle" | "queued" | "syncing"): void;
  /** Subscribe to a realtime channel per §5.3.4 */
  subscribe(channel: string): void;
  /** Unsubscribe from a realtime channel */
  unsubscribe(channel: string): void;
  setPendingApprovalCount(count: number): void;
  addActiveIncident(incidentId: string): void;
  removeActiveIncident(incidentId: string): void;
}

export function createRealtimeStore() {
  return createStore<RealtimeStoreState>((set) => ({
    wsStatus: "disconnected",
    panicActivated: false,
    offlineQueueSize: 0,
    syncStatus: "idle",
    activeSubscriptions: [],
    pendingApprovalCount: 0,
    activeIncidents: [],
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
    subscribe(channel) {
      set((state) => ({
        activeSubscriptions: [...state.activeSubscriptions, channel],
      }));
    },
    unsubscribe(channel) {
      set((state) => ({
        activeSubscriptions: state.activeSubscriptions.filter((c) => c !== channel),
      }));
    },
    setPendingApprovalCount(pendingApprovalCount) {
      set({ pendingApprovalCount });
    },
    addActiveIncident(incidentId) {
      set((state) => ({
        activeIncidents: [...state.activeIncidents, incidentId],
      }));
    },
    removeActiveIncident(incidentId) {
      set((state) => ({
        activeIncidents: state.activeIncidents.filter((id) => id !== incidentId),
      }));
    },
  }));
}
