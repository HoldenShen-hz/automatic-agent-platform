import { useIncidentsQuery } from "@aa/shared-state";
import type { IncidentDTO } from "@aa/shared-types";

export interface IncidentsVm {
  readonly items: readonly { title: string; description: string }[];
}

export function mapIncidentsToVm(incidents: readonly IncidentDTO[]): IncidentsVm {
  return {
    items: incidents.map((incident) => ({
      title: `${incident.severity} · ${incident.title}`,
      description: incident.summary,
    })),
  };
}

export function useIncidentsVm(): IncidentsVm {
  return mapIncidentsToVm(useIncidentsQuery().data ?? []);
}
