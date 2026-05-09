import { useCallback, useState } from "react";
import { useIncidentsQuery } from "@aa/shared-state";
import type { IncidentDTO } from "@aa/shared-types";

export interface AlertsVm {
  readonly items: readonly { title: string; description: string }[];
  readonly incidents: readonly IncidentDTO[];
  readonly filters: {
    readonly severity: string;
    readonly domain: string;
    readonly timeRange: string;
  };
  readonly onDismiss: (id: string) => void;
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function mapAlertsToVm(
  incidents: readonly IncidentDTO[],
  filters: AlertsVm["filters"],
  onDismiss: (id: string) => void,
): AlertsVm {
  const filtered = incidents.filter((incident) => {
    if (filters.severity && filters.severity !== "all" && incident.severity !== filters.severity) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const orderA = SEVERITY_ORDER[a.severity] ?? 99;
    const orderB = SEVERITY_ORDER[b.severity] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return {
    incidents: sorted,
    items: sorted.map((incident) => ({
      title: `${incident.severity} · ${incident.title}`,
      description: `${incident.summary} · ${incident.createdAt}`,
    })),
    filters,
    onDismiss,
  };
}

export function useAlertsVm(): AlertsVm {
  const [filters, setFilters] = useState<AlertsVm["filters"]>({
    severity: "all",
    domain: "all",
    timeRange: "all",
  });
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());

  const onDismiss = useCallback((id: string) => {
    setDismissed((prev) => new Set([...prev, id]));
  }, []);

  return mapAlertsToVm(
    (useIncidentsQuery().data ?? []).filter((i) => !dismissed.has(i.id)),
    filters,
    onDismiss,
  );
}
