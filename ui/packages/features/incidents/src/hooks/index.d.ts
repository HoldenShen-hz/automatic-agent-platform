import type { IncidentDTO } from "@aa/shared-types";
export interface IncidentsVm {
    readonly loading: boolean;
    readonly items: readonly {
        id: string;
        title: string;
        description: string;
        detailRows: readonly {
            key: string;
            value: string;
        }[];
    }[];
    acknowledgeIncident(incidentId: string): Promise<void>;
    startMitigation(incidentId: string): Promise<void>;
    resolveIncident(incidentId: string): Promise<void>;
}
export declare function mapIncidentsToVm(incidents: readonly IncidentDTO[]): IncidentsVm;
export declare function useIncidentsVm(): IncidentsVm;
