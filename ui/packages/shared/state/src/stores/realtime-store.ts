import { createStore } from "zustand/vanilla";
import { withPersistDevtoolsDraft } from "./middleware";

export interface RealtimeStoreState {
  readonly wsStatus: string;
  readonly panicActivated: boolean;
  readonly offlineQueueSize: number;
  readonly syncStatus: "idle" | "queued" | "syncing";
  readonly activeSubscriptions: readonly string[];
  readonly subscriptionLookup: Readonly<Record<string, true>>;
  readonly pendingApprovalCount: number;
  readonly activeIncidents: readonly string[];
  readonly activeIncidentLookup: Readonly<Record<string, true>>;
  readonly incidentCount: number;
  readonly criticalIncidentCount: number;
  setWsStatus(status: string): void;
  triggerPanic(): void;
  setOfflineQueueSize(size: number): void;
  setSyncStatus(status: "idle" | "queued" | "syncing"): void;
  subscribe(channel: string): void;
  unsubscribe(channel: string): void;
  setPendingApprovalCount(count: number): void;
  setIncidentCounts(count: number, criticalCount?: number): void;
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
        subscriptionLookup: {},
        pendingApprovalCount: 0,
        activeIncidents: [],
        activeIncidentLookup: {},
        incidentCount: 0,
        criticalIncidentCount: 0,
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
            if (draft.subscriptionLookup[channel] !== true) {
              draft.activeSubscriptions = [...draft.activeSubscriptions, channel];
              draft.subscriptionLookup = {
                ...draft.subscriptionLookup,
                [channel]: true,
              };
            }
          });
        },
        unsubscribe(channel) {
          set((draft) => {
            draft.activeSubscriptions = draft.activeSubscriptions.filter((entry) => entry !== channel);
            const nextLookup = { ...draft.subscriptionLookup };
            delete nextLookup[channel];
            draft.subscriptionLookup = nextLookup;
          });
        },
        setPendingApprovalCount(pendingApprovalCount) {
          set((draft) => {
            draft.pendingApprovalCount = pendingApprovalCount;
          });
        },
        setIncidentCounts(incidentCount, criticalIncidentCount = 0) {
          set((draft) => {
            draft.incidentCount = incidentCount;
            draft.criticalIncidentCount = criticalIncidentCount;
          });
        },
        addActiveIncident(incidentId) {
          set((draft) => {
            if (draft.activeIncidentLookup[incidentId] !== true) {
              draft.activeIncidents = [...draft.activeIncidents, incidentId];
              draft.activeIncidentLookup = {
                ...draft.activeIncidentLookup,
                [incidentId]: true,
              };
            }
          });
        },
        removeActiveIncident(incidentId) {
          set((draft) => {
            draft.activeIncidents = draft.activeIncidents.filter((entry) => entry !== incidentId);
            const nextLookup = { ...draft.activeIncidentLookup };
            delete nextLookup[incidentId];
            draft.activeIncidentLookup = nextLookup;
          });
        },
      }),
    ),
  );
}
