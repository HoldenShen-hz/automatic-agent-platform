import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthState, useIncidentsQuery, useMutation, useRestClient, useWsClient } from "@aa/shared-state";
const ALERTS_REQUIRED_PERMISSION = "platform_sre";
const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
function mergeIncidents(existing, incoming) {
    const merged = new Map(existing.map((incident) => [incident.id, incident]));
    merged.set(incoming.id, incoming);
    return [...merged.values()];
}
function sortIncidents(incidents) {
    return [...incidents].sort((a, b) => {
        const orderA = SEVERITY_ORDER[a.severity] ?? 99;
        const orderB = SEVERITY_ORDER[b.severity] ?? 99;
        if (orderA !== orderB) {
            return orderA - orderB;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}
function buildHistoryEntry(action, incident) {
    return {
        title: `${action} · ${incident.title}`,
        description: `${incident.severity} · ${incident.createdAt}`,
    };
}
const LIVE_INCIDENT_TTL_MS = 15 * 60 * 1000;
export function buildAlertsVm(incidents, filters, history, streamStatus, pendingOperations, actions) {
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
                { key: "Severity", value: incident.severity },
                { key: "Created", value: incident.createdAt },
                { key: "Summary", value: incident.summary },
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
export function useAlertsVm() {
    const auth = useAuthState();
    const client = useRestClient();
    const wsClient = useWsClient();
    const [filters, setFiltersState] = useState({
        severity: "all",
        domain: "all",
        timeRange: "all",
    });
    const [liveIncidents, setLiveIncidents] = useState([]);
    const [dismissed, setDismissed] = useState(new Set());
    const [snoozedUntil, setSnoozedUntil] = useState(new Map());
    const [history, setHistory] = useState([]);
    const [streamStatus, setStreamStatus] = useState("idle");
    const [pendingOperations, setPendingOperations] = useState(0);
    const incidents = useIncidentsQuery().data ?? [];
    const scopedIncidents = auth.permissions.includes(ALERTS_REQUIRED_PERMISSION) ? incidents : [];
    const { mutateAsync: acknowledgeMutateAsync } = useMutation({
        client,
        method: "POST",
        path: ({ id }) => `/alerts/${id}/acknowledge`,
    });
    const { mutateAsync: dismissMutateAsync } = useMutation({
        client,
        method: "POST",
        path: ({ id }) => `/alerts/${id}/dismiss`,
    });
    const { mutateAsync: snoozeMutateAsync } = useMutation({
        client,
        method: "POST",
        path: ({ id }) => `/alerts/${id}/snooze`,
    });
    const { mutateAsync: escalateMutateAsync } = useMutation({
        client,
        method: "POST",
        path: ({ id }) => `/alerts/${id}/escalate`,
    });
    useEffect(() => {
        const unsubscribe = wsClient.subscribe("incidents", (event) => {
            if (!event.type.startsWith("incident.")) {
                return;
            }
            const payload = event.payload;
            if (payload.incident == null) {
                return;
            }
            setStreamStatus("live");
            setLiveIncidents((current) => {
                const merged = mergeIncidents(current.map((entry) => entry.incident), payload.incident);
                const receivedAt = Date.now();
                return merged.map((incident) => ({
                    incident,
                    receivedAt: incident.id === payload.incident.id
                        ? receivedAt
                        : current.find((entry) => entry.incident.id === incident.id)?.receivedAt ?? receivedAt,
                }));
            });
            setHistory((current) => [buildHistoryEntry("Stream update", payload.incident), ...current].slice(0, 8));
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
    useEffect(() => {
        if (snoozedUntil.size === 0) {
            return;
        }
        const now = Date.now();
        let nextExpiry = null;
        for (const value of snoozedUntil.values()) {
            if (value > now && (nextExpiry == null || value < nextExpiry)) {
                nextExpiry = value;
            }
        }
        if (nextExpiry == null) {
            return;
        }
        const timer = setTimeout(() => {
            setSnoozedUntil((current) => {
                const refreshed = new Map(current);
                const refreshNow = Date.now();
                for (const [incidentId, expiry] of current.entries()) {
                    if (expiry <= refreshNow) {
                        refreshed.delete(incidentId);
                    }
                }
                return refreshed;
            });
        }, Math.max(0, nextExpiry - now));
        return () => clearTimeout(timer);
    }, [snoozedUntil]);
    const mergedIncidents = useMemo(() => {
        const merged = new Map();
        for (const incident of scopedIncidents) {
            merged.set(incident.id, incident);
        }
        const cutoff = Date.now() - LIVE_INCIDENT_TTL_MS;
        for (const entry of liveIncidents) {
            if (entry.receivedAt >= cutoff) {
                merged.set(entry.incident.id, entry.incident);
            }
        }
        const now = Date.now();
        return sortIncidents([...merged.values()]).filter((incident) => {
            if (dismissed.has(incident.id)) {
                return false;
            }
            const snoozeExpiry = snoozedUntil.get(incident.id);
            return snoozeExpiry == null || snoozeExpiry <= now;
        });
    }, [dismissed, liveIncidents, scopedIncidents, snoozedUntil]);
    const dedupedIncidents = useMemo(() => {
        const byId = new Map();
        for (const incident of mergedIncidents) {
            byId.set(incident.id, incident);
        }
        return sortIncidents([...byId.values()]);
    }, [mergedIncidents]);
    const appendHistory = useCallback((entry) => {
        setHistory((current) => [entry, ...current].slice(0, 8));
    }, []);
    const findIncident = useCallback((id) => dedupedIncidents.find((incident) => incident.id === id) ?? null, [dedupedIncidents]);
    const withPending = useCallback(async (operation) => {
        setPendingOperations((current) => current + 1);
        try {
            await operation();
        }
        finally {
            setPendingOperations((current) => Math.max(0, current - 1));
        }
    }, []);
    const onAcknowledge = useCallback(async (id) => {
        const incident = findIncident(id);
        await withPending(async () => {
            await acknowledgeMutateAsync({ id });
            if (incident != null) {
                appendHistory(buildHistoryEntry("Acknowledged", incident));
            }
        });
    }, [acknowledgeMutateAsync, appendHistory, findIncident, withPending]);
    const onDismiss = useCallback(async (id) => {
        const incident = findIncident(id);
        setDismissed((current) => new Set([...current, id]));
        try {
            await withPending(async () => {
                await dismissMutateAsync({ id });
                if (incident != null) {
                    appendHistory(buildHistoryEntry("Dismissed", incident));
                }
            });
        }
        catch (error) {
            setDismissed((current) => {
                const next = new Set(current);
                next.delete(id);
                return next;
            });
            throw error;
        }
    }, [appendHistory, dismissMutateAsync, findIncident, withPending]);
    const onSnooze = useCallback(async (id) => {
        const expiry = Date.now() + 30 * 60 * 1000;
        const incident = findIncident(id);
        setSnoozedUntil((current) => {
            const next = new Map(current);
            next.set(id, expiry);
            return next;
        });
        try {
            await withPending(async () => {
                await snoozeMutateAsync({ id });
                if (incident != null) {
                    appendHistory(buildHistoryEntry("Snoozed 30m", incident));
                }
            });
        }
        catch (error) {
            setSnoozedUntil((current) => {
                const next = new Map(current);
                next.delete(id);
                return next;
            });
            throw error;
        }
    }, [appendHistory, findIncident, snoozeMutateAsync, withPending]);
    const onEscalate = useCallback(async (id) => {
        const incident = findIncident(id);
        await withPending(async () => {
            await escalateMutateAsync({ id });
            if (incident != null) {
                appendHistory(buildHistoryEntry("Escalated", incident));
            }
        });
    }, [appendHistory, escalateMutateAsync, findIncident, withPending]);
    return useMemo(() => buildAlertsVm(dedupedIncidents, filters, history, streamStatus, pendingOperations, {
        setFilters(next) {
            setFiltersState((current) => ({ ...current, ...next }));
        },
        onAcknowledge,
        onDismiss,
        onEscalate,
        onSnooze,
    }), [
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
