import type { IncidentDTO } from "@aa/shared-types";
export interface AlertHistoryEntry {
    readonly title: string;
    readonly description: string;
}
export interface AlertListItem {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly detailRows: readonly {
        key: string;
        value: string;
    }[];
}
export interface AlertsVm {
    readonly items: readonly AlertListItem[];
    readonly incidents: readonly IncidentDTO[];
    readonly filters: {
        readonly severity: string;
        readonly domain: string;
        readonly timeRange: string;
    };
    readonly history: readonly AlertHistoryEntry[];
    readonly streamStatus: "idle" | "live";
    readonly pendingOperations: number;
    setFilters(next: Partial<AlertsVm["filters"]>): void;
    readonly onAcknowledge: (id: string) => Promise<void>;
    readonly onDismiss: (id: string) => Promise<void>;
    readonly onEscalate: (id: string) => Promise<void>;
    readonly onSnooze: (id: string) => Promise<void>;
    readonly acknowledgeAlert: (id: string) => Promise<void>;
    readonly dismissAlert: (id: string) => Promise<void>;
}
export declare function buildAlertsVm(incidents: readonly IncidentDTO[], filters: AlertsVm["filters"], history: readonly AlertHistoryEntry[], streamStatus: AlertsVm["streamStatus"], pendingOperations: number, actions: Pick<AlertsVm, "onAcknowledge" | "onDismiss" | "onEscalate" | "onSnooze" | "setFilters">): AlertsVm;
export declare const mapAlertsToVm: typeof buildAlertsVm;
export declare function useAlertsVm(): AlertsVm;
