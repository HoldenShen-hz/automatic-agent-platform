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
    clearPanic(): void;
    setOfflineQueueSize(size: number): void;
    setSyncStatus(status: "idle" | "queued" | "syncing"): void;
    subscribe(channel: string): void;
    unsubscribe(channel: string): void;
    setPendingApprovalCount(count: number): void;
    setIncidentCounts(count: number, criticalCount?: number): void;
    addActiveIncident(incidentId: string): void;
    removeActiveIncident(incidentId: string): void;
}
export declare function createRealtimeStore(): import("zustand").StoreApi<RealtimeStoreState>;
