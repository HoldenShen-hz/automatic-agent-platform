import { createStore } from "zustand/vanilla";
import { withPersistDevtoolsDraft } from "./middleware";

export interface RealtimeStoreState {
  readonly wsStatus: string;
  readonly panicActivated: boolean;
  readonly offlineQueueSize: number;
  readonly syncStatus: "idle" | "queued" | "syncing";
  readonly activeSubscriptions: readonly string[];
  readonly pendingApprovalCount: number;
  readonly activeIncidents: readonly string[];
  setWsStatus(status: string): void;
  triggerPanic(): void;
  setOfflineQueueSize(size: number): void;
  setSyncStatus(status: "idle" | "queued" | "syncing"): void;
  subscribe(channel: string): void;
  unsubscribe(channel: string): void;
  setPendingApprovalCount(count: number): void;
  addActiveIncident(incidentId: string): void;
  removeActiveIncident(incidentId: string): void;
}

export function createRealtimeStore() {
  return createStore<RealtimeStoreState>()(
    withPersistDevtoolsDraft(
      "aa-realtime-store",
      (set) => ({
        wsStatus: "disconnected",
        panicActivated: false,
        offlineQueueSize: 0,
        syncStatus: "idle",
        activeSubscriptions: [],
        pendingApprovalCount: 0,
        activeIncidents: [],
        setWsStatus(wsStatus) {
          set((draft) => {
            draft.wsStatus = wsStatus;
          });
        },
        triggerPanic() {
          set((draft) => {
            draft.panicActivated = true;
          });
        },
        setOfflineQueueSize(offlineQueueSize) {
          set((draft) => {
            draft.offlineQueueSize = offlineQueueSize;
          });
        },
        setSyncStatus(syncStatus) {
          set((draft) => {
            draft.syncStatus = syncStatus;
          });
        },
        subscribe(channel) {
          set((draft) => {
            if (!draft.activeSubscriptions.includes(channel)) {
              draft.activeSubscriptions = [...draft.activeSubscriptions, channel];
            }
          });
        },
        unsubscribe(channel) {
          set((draft) => {
            draft.activeSubscriptions = draft.activeSubscriptions.filter((entry) => entry !== channel);
          });
        },
        setPendingApprovalCount(pendingApprovalCount) {
          set((draft) => {
            draft.pendingApprovalCount = pendingApprovalCount;
          });
        },
        addActiveIncident(incidentId) {
          set((draft) => {
            if (!draft.activeIncidents.includes(incidentId)) {
              draft.activeIncidents = [...draft.activeIncidents, incidentId];
            }
          });
        },
        removeActiveIncident(incidentId) {
          set((draft) => {
            draft.activeIncidents = draft.activeIncidents.filter((entry) => entry !== incidentId);
          });
        },
      }),
    ),
  );
}
