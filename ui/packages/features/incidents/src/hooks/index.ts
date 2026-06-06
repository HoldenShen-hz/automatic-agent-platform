import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { updateIncident } from "@aa/shared-api-client";
import { missionControlQueryKeys, useAuthState, useIncidentsQuery, useRestClient } from "@aa/shared-state";
import type { IncidentDTO } from "@aa/shared-types";

export interface IncidentsVm {
  readonly loading: boolean;
  readonly items: readonly { id: string; title: string; description: string; detailRows: readonly { key: string; value: string }[] }[];
  acknowledgeIncident(incidentId: string): Promise<void>;
  startMitigation(incidentId: string): Promise<void>;
  resolveIncident(incidentId: string): Promise<void>;
}

const INCIDENT_STATUS_PRIORITY: Record<string, number> = {
  open: 0,
  acknowledged: 1,
  triaged: 2,
  mitigating: 3,
  reviewed: 4,
  resolved: 5,
  closed: 6,
};

function sortIncidentsForOps(incidents: readonly IncidentDTO[]): readonly IncidentDTO[] {
  return [...incidents].sort((left, right) => {
    const priorityDelta = (INCIDENT_STATUS_PRIORITY[left.status ?? "open"] ?? 99)
      - (INCIDENT_STATUS_PRIORITY[right.status ?? "open"] ?? 99);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }
    return Date.parse(right.createdAt) - Date.parse(left.createdAt);
  });
}

export function mapIncidentsToVm(incidents: readonly IncidentDTO[]): IncidentsVm {
  const sortedIncidents = sortIncidentsForOps(incidents);
  return {
    loading: false,
    items: sortedIncidents.map((incident) => ({
      id: incident.id,
      title: `${incident.severity} · ${incident.title}`,
      description: incident.summary,
      detailRows: [
        { key: "ID", value: incident.id },
        { key: "Status", value: incident.status ?? "open" },
        { key: "Owner", value: incident.owner ?? "unassigned" },
        { key: "Created", value: incident.createdAt },
      ],
    })),
    async acknowledgeIncident() {},
    async startMitigation() {},
    async resolveIncident() {},
  };
}

export function useIncidentsVm(): IncidentsVm {
  const client = useRestClient();
  const queryClient = useQueryClient();
  const auth = useAuthState();
  const incidentsQuery = useIncidentsQuery();
  const incidents = incidentsQuery.data ?? [];
  const owner = auth.displayName || auth.userId || "web-operator";

  const refreshIncidents = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: missionControlQueryKeys.incidents });
  }, [queryClient]);

  const acknowledgeIncident = useCallback(async (incidentId: string) => {
    await updateIncident(client, incidentId, { status: "acknowledged", owner });
    await refreshIncidents();
  }, [client, owner, refreshIncidents]);

  const startMitigation = useCallback(async (incidentId: string) => {
    await updateIncident(client, incidentId, { status: "mitigating" });
    await refreshIncidents();
  }, [client, refreshIncidents]);

  const resolveIncident = useCallback(async (incidentId: string) => {
    await updateIncident(client, incidentId, { status: "resolved" });
    await refreshIncidents();
  }, [client, refreshIncidents]);

  return useMemo(() => ({
    ...mapIncidentsToVm(incidents),
    loading: incidentsQuery.isLoading,
    acknowledgeIncident,
    startMitigation,
    resolveIncident,
  }), [acknowledgeIncident, incidents, incidentsQuery.isLoading, resolveIncident, startMitigation]);
}
