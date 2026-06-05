import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { updateIncident } from "@aa/shared-api-client";
import { missionControlQueryKeys, useAuthState, useIncidentsQuery, useRestClient } from "@aa/shared-state";
import type { IncidentDTO } from "@aa/shared-types";

export interface IncidentsVm {
  readonly items: readonly { id: string; title: string; description: string; detailRows: readonly { key: string; value: string }[] }[];
  acknowledgeIncident(incidentId: string): Promise<void>;
  startMitigation(incidentId: string): Promise<void>;
  resolveIncident(incidentId: string): Promise<void>;
}

export function mapIncidentsToVm(incidents: readonly IncidentDTO[]): IncidentsVm {
  return {
    items: incidents.map((incident) => ({
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
  const incidents = useIncidentsQuery().data ?? [];
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
    acknowledgeIncident,
    startMitigation,
    resolveIncident,
  }), [acknowledgeIncident, incidents, resolveIncident, startMitigation]);
}
