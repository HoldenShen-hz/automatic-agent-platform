import { createStore } from "zustand/vanilla";
import { withPersistDevtoolsDraft } from "./middleware";
export function createRealtimeStore() {
    return createStore()(withPersistDevtoolsDraft("aa-realtime-store", (set) => ({
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
        clearPanic() {
            set((draft) => {
                draft.panicActivated = false;
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
    }), {
        version: 2,
        partialize: (state) => ({
            wsStatus: state.wsStatus,
            panicActivated: false,
            offlineQueueSize: state.offlineQueueSize,
            syncStatus: state.syncStatus,
            activeSubscriptions: state.activeSubscriptions,
            subscriptionLookup: state.subscriptionLookup,
            pendingApprovalCount: state.pendingApprovalCount,
            activeIncidents: state.activeIncidents,
            activeIncidentLookup: state.activeIncidentLookup,
            incidentCount: state.incidentCount,
            criticalIncidentCount: state.criticalIncidentCount,
        }),
    }));
}
