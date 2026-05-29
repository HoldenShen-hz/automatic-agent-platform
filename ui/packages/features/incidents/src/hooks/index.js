import { useIncidentsQuery } from "@aa/shared-state";
export function mapIncidentsToVm(incidents) {
    return {
        items: incidents.map((incident) => ({
            title: `${incident.severity} · ${incident.title}`,
            description: incident.summary,
        })),
    };
}
export function useIncidentsVm() {
    return mapIncidentsToVm(useIncidentsQuery().data ?? []);
}
