import type { IncidentDTO } from "@aa/shared-types";
export interface IncidentsVm {
    readonly items: readonly {
        title: string;
        description: string;
    }[];
}
export declare function mapIncidentsToVm(incidents: readonly IncidentDTO[]): IncidentsVm;
export declare function useIncidentsVm(): IncidentsVm;
