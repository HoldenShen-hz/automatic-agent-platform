import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { updateIncident } from "@aa/shared-api-client";
import { missionControlQueryKeys, useAuthState, useIncidentsQuery, useRestClient, useWsClient } from "@aa/shared-state";
import { translateMessage } from "@aa/shared-i18n";
import type { IncidentDTO } from "@aa/shared-types";

const ALERTS_REQUIRED_PERMISSION = "platform_sre";

export interface AlertHistoryEntry {
  readonly title: string;
  readonly description: string;
}

export interface AlertListItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly detailRows: readonly { key: string; value: string }[];
}

export interface AlertsVm {
  readonly items: readonly AlertListItem[];
  readonly incidents: readonly IncidentDTO[];
  readonly filters: {
    readonly severity: string;
    readonly domain: string;
    readonly timeRange: string;
  };
  readonly history: readonly AlertHistoryEntry[];
  readonly streamStatus: "idle" | "live";
  readonly pendingOperations: number;
  setFilters(next: Partial<AlertsVm["filters"]>): void;
  // R14-34: acknowledge/dismiss/escalate are the three core actions per §4.7
  readonly onAcknowledge: (id: string) => Promise<void>;
  readonly onDismiss: (id: string) => Promise<void>;
  readonly onEscalate: (id: string) => Promise<void>;
  // Additional actions for alert lifecycle management
  readonly onSnooze: (id: string) => Promise<void>;
  // Legacy aliases for backward compatibility with existing tests (R14-34)
  readonly acknowledgeAlert: (id: string) => Promise<void>;
  readonly dismissAlert: (id: string) => Promise<void>;
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

interface AlertStreamPayload {
  readonly incident?: IncidentDTO;
}

function mergeIncidents(existing: readonly IncidentDTO[], incoming: IncidentDTO): readonly IncidentDTO[] {
  const merged = new Map(existing.map((incident) => [incident.id, incident] as const));
  merged.set(incoming.id, selectFresherIncident(merged.get(incoming.id) ?? null, incoming));
  return [...merged.values()];
}

function selectFresherIncident(current: IncidentDTO | null, candidate: IncidentDTO): IncidentDTO {
  if (current == null) {
    return candidate;
  }
  const currentUpdatedAt = Date.parse(current.updatedAt ?? current.createdAt);
  const candidateUpdatedAt = Date.parse(candidate.updatedAt ?? candidate.createdAt);
  if (Number.isFinite(currentUpdatedAt) && Number.isFinite(candidateUpdatedAt) && candidateUpdatedAt < currentUpdatedAt) {
    return current;
  }
  return candidate;
}

function sortIncidents(incidents: readonly IncidentDTO[]): readonly IncidentDTO[] {
  return [...incidents].sort((a, b) => {
    const orderA = SEVERITY_ORDER[a.severity] ?? 99;
    const orderB = SEVERITY_ORDER[b.severity] ?? 99;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function buildHistoryEntry(action: string, incident: IncidentDTO): AlertHistoryEntry {
  return {
    title: `${action} · ${incident.title}`,
    description: `${incident.severity} · ${incident.createdAt}`,
  };
}

interface LiveIncidentEntry {
  readonly incident: IncidentDTO;
  readonly receivedAt: number;
}

const LIVE_INCIDENT_TTL_MS = 15 * 60 * 1000;
const ALERT_SNOOZE_MS = 30 * 60 * 1000;

export function buildAlertsVm(
  incidents: readonly IncidentDTO[],
  filters: AlertsVm["filters"],
  history: readonly AlertHistoryEntry[],
  streamStatus: AlertsVm["streamStatus"],
  pendingOperations: number,
  actions: Pick<AlertsVm, "onAcknowledge" | "onDismiss" | "onEscalate" | "onSnooze" | "setFilters">,
): AlertsVm {
  const filtered = incidents.filter((incident) => {
    if (filters.severity !== "all" && incident.severity !== filters.severity) {
      return false;
    }
    return true;
  });

  const sorted = sortIncidents(filtered);
  // R14-33: Incidents sorted by severity (critical→low) then by creation time (newest first)
  // R14-34: acknowledge/dismiss/escalate are the three core actions per §4.7
  return {
    incidents: sorted,
    items: sorted.map((incident) => ({
      id: incident.id,
      title: `${incident.severity} · ${incident.title}`,
      description: incident.summary,
      detailRows: [
        { key: translateMessage("ui.alerts.field.severity"), value: incident.severity },
        { key: "Status", value: incident.status ?? "open" },
        { key: translateMessage("ui.alerts.field.created"), value: incident.createdAt },
        { key: "Owner", value: incident.owner ?? "unassigned" },
        { key: translateMessage("ui.alerts.field.summary"), value: incident.summary },
      ],
    })),
    filters,
    history,
    streamStatus,
    pendingOperations,
    ...actions,
    // Legacy aliases for backward compatibility with existing tests (R14-34)
    acknowledgeAlert: actions.onAcknowledge,
    dismissAlert: actions.onDismiss,
  };
}

export const mapAlertsToVm = buildAlertsVm;

export function useAlertsVm(): AlertsVm {
  const auth = useAuthState();
  const client = useRestClient();
  const queryClient = useQueryClient();
  const wsClient = useWsClient();
  const [filters, setFiltersState] = useState<AlertsVm["filters"]>({
    severity: "all",
    domain: "all",
    timeRange: "all",
  });
  const [liveIncidents, setLiveIncidents] = useState<readonly LiveIncidentEntry[]>([]);
  const [history, setHistory] = useState<readonly AlertHistoryEntry[]>([]);
  const [streamStatus, setStreamStatus] = useState<AlertsVm["streamStatus"]>("idle");
  const [pendingOperations, setPendingOperations] = useState(0);
  const incidents = useIncidentsQuery().data ?? [];
  const scopedIncidents = (auth.permissions ?? []).includes(ALERTS_REQUIRED_PERMISSION) ? incidents : [];
  const operatorId = auth.displayName || auth.userId || "web-operator";

  useEffect(() => {
    const unsubscribe = wsClient.subscribe("incidents", (event) => {
      if (!event.type.startsWith("incident.")) {
        return;
      }
      const payload = event.payload as AlertStreamPayload;
      if (payload.incident == null) {
        return;
      }
      setStreamStatus("live");
      setLiveIncidents((current) => {
        const merged = mergeIncidents(current.map((entry) => entry.incident), payload.incident!);
        const receivedAt = Date.now();
        return merged.map((incident) => ({
          incident,
          receivedAt: incident.id === payload.incident!.id
            ? receivedAt
            : current.find((entry) => entry.incident.id === incident.id)?.receivedAt ?? receivedAt,
        }));
      });
      setHistory((current) => [buildHistoryEntry(translateMessage("ui.alerts.history.streamUpdate"), payload.incident!), ...current].slice(0, 8));
    });
    const unsubscribeStatus = wsClient.onStatusChange((nextStatus) => {
      setStreamStatus(nextStatus === "connected" ? "live" : "idle");
    });
    return () => {
      unsubscribe();
      unsubscribeStatus();
    };
  }, [wsClient]);

  useEffect(() => {
    const timer = setInterval(() => {
      const cutoff = Date.now() - LIVE_INCIDENT_TTL_MS;
      setLiveIncidents((current) => current.filter((entry) => entry.receivedAt >= cutoff));
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  const mergedIncidents = useMemo(() => {
    const merged = new Map<string, IncidentDTO>();
    for (const incident of scopedIncidents) {
      merged.set(incident.id, incident);
    }
    const cutoff = Date.now() - LIVE_INCIDENT_TTL_MS;
    for (const entry of liveIncidents) {
      if (entry.receivedAt >= cutoff) {
        merged.set(entry.incident.id, selectFresherIncident(merged.get(entry.incident.id) ?? null, entry.incident));
      }
    }
    const now = Date.now();
    return sortIncidents([...merged.values()]).filter((incident) => {
      if (incident.status === "closed") {
        return false;
      }
      if (incident.snoozedUntil == null) {
        return true;
      }
      const snoozeExpiry = Date.parse(incident.snoozedUntil);
      return !Number.isFinite(snoozeExpiry) || snoozeExpiry <= now;
    });
  }, [liveIncidents, scopedIncidents]);

  const dedupedIncidents = useMemo(() => {
    const byId = new Map<string, IncidentDTO>();
    for (const incident of mergedIncidents) {
      byId.set(incident.id, incident);
    }
    return sortIncidents([...byId.values()]);
  }, [mergedIncidents]);

  const appendHistory = useCallback((entry: AlertHistoryEntry) => {
    setHistory((current) => [entry, ...current].slice(0, 8));
  }, []);

  const findIncident = useCallback((id: string) => dedupedIncidents.find((incident) => incident.id === id) ?? null, [dedupedIncidents]);

  const withPending = useCallback(async (operation: () => Promise<void>) => {
    setPendingOperations((current) => current + 1);
    try {
      await operation();
    } finally {
      setPendingOperations((current) => Math.max(0, current - 1));
    }
  }, []);

  const refreshIncidents = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: missionControlQueryKeys.incidents });
    await queryClient.refetchQueries({ queryKey: missionControlQueryKeys.incidents, type: "active" });
  }, [queryClient]);

  const onAcknowledge = useCallback(async (id: string) => {
    const incident = findIncident(id);
    await withPending(async () => {
      await updateIncident(client, id, { status: "acknowledged", owner: operatorId });
      await refreshIncidents();
      if (incident != null) {
        appendHistory(buildHistoryEntry("Acknowledged", incident));
      }
    });
  }, [appendHistory, client, findIncident, operatorId, refreshIncidents, withPending]);

  const onDismiss = useCallback(async (id: string) => {
    const incident = findIncident(id);
    await withPending(async () => {
      await updateIncident(client, id, { status: "closed" });
      await refreshIncidents();
      if (incident != null) {
        appendHistory(buildHistoryEntry("Dismissed", incident));
      }
    });
  }, [appendHistory, client, findIncident, refreshIncidents, withPending]);

  const onSnooze = useCallback(async (id: string) => {
    const expiry = new Date(Date.now() + ALERT_SNOOZE_MS).toISOString();
    const incident = findIncident(id);
    await withPending(async () => {
      await updateIncident(client, id, { snoozedUntil: expiry });
      await refreshIncidents();
      if (incident != null) {
        appendHistory(buildHistoryEntry("Snoozed 30m", incident));
      }
    });
  }, [appendHistory, client, findIncident, refreshIncidents, withPending]);

  const onEscalate = useCallback(async (id: string) => {
    const incident = findIncident(id);
    await withPending(async () => {
      await updateIncident(client, id, { status: "mitigating" });
      await refreshIncidents();
      if (incident != null) {
        appendHistory(buildHistoryEntry("Entered mitigation", incident));
      }
    });
  }, [appendHistory, client, findIncident, refreshIncidents, withPending]);

  return useMemo(() => buildAlertsVm(
    dedupedIncidents,
    filters,
    history,
    streamStatus,
    pendingOperations,
    {
      setFilters(next) {
        setFiltersState((current) => ({ ...current, ...next }));
      },
      onAcknowledge,
      onDismiss,
      onEscalate,
      onSnooze,
    },
  ), [
    dedupedIncidents,
    filters,
    history,
    onAcknowledge,
    onDismiss,
    onEscalate,
    onSnooze,
    pendingOperations,
    streamStatus,
  ]);
}
