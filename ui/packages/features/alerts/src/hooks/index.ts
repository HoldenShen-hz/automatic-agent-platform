import { useState, useCallback } from "react";
import { useAuthState, useIncidentsQuery } from "@aa/shared-state";
import type { IncidentDTO } from "@aa/shared-types";

export type IncidentSeverity = "critical" | "high" | "medium" | "low";

export interface AlertFilter {
  readonly severity: IncidentSeverity | "all";
  readonly timeRange: "1h" | "24h" | "7d" | "all";
}

export interface AlertsVm {
  readonly items: readonly { title: string; description: string; severity: IncidentSeverity; id: string }[];
  readonly incidents: readonly IncidentDTO[];
  readonly filter: AlertFilter;
  readonly setFilter: (filter: Partial<AlertFilter>) => void;
  readonly dismissAlert: (id: string) => void;
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
  const sorted = sortBySeverity(visibleIncidents);
  const filtered = filterIncidents(sorted, filter);

  return {
    incidents: filtered,
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
  const { data: incidents = [] } = useIncidentsQuery();
  const scopedIncidents = auth.permissions.includes(ALERTS_REQUIRED_PERMISSION) ? incidents : [];
  return mapAlertsToVm(scopedIncidents);
}
