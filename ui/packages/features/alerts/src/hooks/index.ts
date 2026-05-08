import { useIncidentsQuery } from "@aa/shared-state";
import type { IncidentDTO } from "@aa/shared-types";

export interface AlertsVm {
  readonly items: readonly { title: string; description: string }[];
  readonly incidents: readonly IncidentDTO[];
}

export function mapAlertsToVm(incidents: readonly IncidentDTO[]): AlertsVm {
  return {
    incidents,
    items: incidents.map((incident) => ({
      title: `${incident.severity} · ${incident.title}`,
      description: `${incident.summary} · ${incident.createdAt}`,
    })),
  };
}

export function useAlertsVm(): AlertsVm {
  return mapAlertsToVm(useIncidentsQuery().data ?? []);
}
