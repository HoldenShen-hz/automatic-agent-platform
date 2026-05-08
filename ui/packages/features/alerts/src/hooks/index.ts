import { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { acknowledgeIncident, resolveIncident, startIncidentMitigation } from "@aa/shared-api-client";
import { useAuthState, useIncidentsQuery, useRestClient, useWsClient } from "@aa/shared-state";
import type { IncidentDTO } from "@aa/shared-types";
import type { WSEventEnvelope } from "@aa/shared-api-client";

export type IncidentSeverity = "critical" | "high" | "medium" | "low";

export interface AlertFilter {
  readonly severity: IncidentSeverity | "all";
  readonly domainId: string | "all";
  readonly timeRange: "1h" | "24h" | "7d" | "all";
}

export interface AlertsVm {
  readonly items: readonly { title: string; description: string; severity: IncidentSeverity; id: string }[];
  readonly incidents: readonly IncidentDTO[];
  readonly availableDomains: readonly string[];
  readonly filter: AlertFilter;
  readonly setFilter: (filter: Partial<AlertFilter>) => void;
  readonly dismissAlert: (id: string) => void;
  readonly acknowledgeAlert: (id: string) => Promise<void>;
  readonly startMitigation: (id: string) => Promise<void>;
  readonly resolveAlert: (id: string) => Promise<void>;
}

const SEVERITY_PRIORITY: Record<IncidentSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};
const ALERTS_REQUIRED_PERMISSION = "platform_sre";

function sortBySeverity(incidents: readonly IncidentDTO[]): IncidentDTO[] {
  return [...incidents].sort((a, b) => {
    const priorityA = SEVERITY_PRIORITY[a.severity as IncidentSeverity] ?? 4;
    const priorityB = SEVERITY_PRIORITY[b.severity as IncidentSeverity] ?? 4;
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function filterIncidents(incidents: readonly IncidentDTO[], filter: AlertFilter): IncidentDTO[] {
  return incidents.filter((incident) => {
    if (filter.severity !== "all" && incident.severity !== filter.severity) {
      return false;
    }
    if (filter.domainId !== "all" && incident.domainId !== filter.domainId) {
      return false;
    }
    if (filter.timeRange !== "all") {
      const now = Date.now();
      const incidentTime = new Date(incident.createdAt).getTime();
      const hourMs = 3600000;
      if (filter.timeRange === "1h" && now - incidentTime > hourMs) return false;
      if (filter.timeRange === "24h" && now - incidentTime > 24 * hourMs) return false;
      if (filter.timeRange === "7d" && now - incidentTime > 7 * 24 * hourMs) return false;
    }
    return true;
  });
}

export function mapAlertsToVm(incidents: readonly IncidentDTO[]): AlertsVm {
  const [filter, setFilterState] = useState<AlertFilter>({
    severity: "all",
    domainId: "all",
    timeRange: "all",
  });
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const setFilter = useCallback((partial: Partial<AlertFilter>) => {
    setFilterState((prev) => ({ ...prev, ...partial }));
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setDismissedIds((prev) => new Set(Array.from(prev).concat(id)));
  }, []);

  const visibleIncidents = incidents.filter((i) => !dismissedIds.has(i.id));
  const availableDomains = Array.from(
    new Set(visibleIncidents.map((incident) => incident.domainId).filter((value): value is string => Boolean(value))),
  ).sort();
  const sorted = sortBySeverity(visibleIncidents);
  const filtered = filterIncidents(sorted, filter);

  return {
    incidents: filtered,
    availableDomains,
    items: filtered.map((incident) => ({
      id: incident.id,
      title: `${incident.severity} · ${incident.title}`,
      description: `${incident.summary} · ${incident.createdAt}`,
      severity: incident.severity as IncidentSeverity,
    })),
    filter,
    setFilter,
    dismissAlert,
  };
}

export function useAlertsVm(): AlertsVm {
  const auth = useAuthState();
  const client = useRestClient();
  const { data: incidents = [] } = useIncidentsQuery();
  const wsClient = useWsClient();
  const queryClient = useQueryClient();

  // §R14-27: Subscribe to WebSocket events for real-time incident updates
  useEffect(() => {
    const unsubscribe = wsClient.subscribe("incidents", (event: WSEventEnvelope) => {
      if (event.type === "incident.created" || event.type === "incident.updated") {
        // Invalidate the incidents query to trigger a re-fetch with fresh data
        void queryClient.invalidateQueries({ queryKey: ["incidents"] });
      }
    });
    return unsubscribe;
  }, [wsClient, queryClient]);

  const scopedIncidents = auth.permissions.includes(ALERTS_REQUIRED_PERMISSION) ? incidents : [];
  const vm = mapAlertsToVm(scopedIncidents);

  const acknowledgeAlert = useCallback(async (id: string): Promise<void> => {
    await acknowledgeIncident(client, id, auth.userId);
    await queryClient.invalidateQueries({ queryKey: ["incidents"] });
  }, [auth.userId, client, queryClient]);

  const startMitigation = useCallback(async (id: string): Promise<void> => {
    await startIncidentMitigation(client, id);
    await queryClient.invalidateQueries({ queryKey: ["incidents"] });
  }, [client, queryClient]);

  const resolveAlert = useCallback(async (id: string): Promise<void> => {
    await resolveIncident(client, id);
    vm.dismissAlert(id);
    await queryClient.invalidateQueries({ queryKey: ["incidents"] });
  }, [client, queryClient, vm]);

  return {
    ...vm,
    acknowledgeAlert,
    startMitigation,
    resolveAlert,
  };
}
