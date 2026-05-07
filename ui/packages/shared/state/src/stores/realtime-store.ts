import { createStore } from "zustand/vanilla";
import { withPersistDevtoolsDraft } from "./middleware";

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
            draft.activeIncidents = draft.activeIncidents.filter((id) => id !== incidentId);
          });
        },
      }),
    ),
  );
}
