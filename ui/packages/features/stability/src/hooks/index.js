import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { dashboardQueryKeys, missionControlQueryKeys, useAgentsQuery, useDashboardSnapshotQuery, useIncidentsQuery, useQueuesQuery, useWorkersQuery } from "@aa/shared-state";
import { translateMessage } from "@aa/shared-i18n";
const ACTIVE_INCIDENT_STATUSES = /* @__PURE__ */ new Set(["open", "acknowledged", "mitigating"]);
function formatPercent(value) {
  if (value == null) {
    return "--";
  }
  return `${value.toFixed(1)}%`;
}
function formatMs(value) {
  if (value == null) {
    return "--";
  }
  return `${Math.round(value)} ms`;
}
function formatCount(value) {
  if (value == null) {
    return "--";
  }
  return value;
}
function isActiveIncident(incident) {
  return incident.status == null || ACTIVE_INCIDENT_STATUSES.has(incident.status);
}
function incidentPriority(incident) {
  if (incident.status === "open" || incident.status === "acknowledged") {
    return 0;
  }
  if (incident.status === "mitigating" || incident.status == null) {
    return 1;
  }
  return 2;
}
function prioritizeStabilityIncidents(incidents) {
  if (incidents == null) {
    return [];
  }
  return [...incidents].sort((left, right) => {
    const priorityDiff = incidentPriority(left) - incidentPriority(right);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    const timeDiff = Date.parse(right.createdAt) - Date.parse(left.createdAt);
    if (Number.isFinite(timeDiff) && timeDiff !== 0) {
      return timeDiff;
    }
    return right.id.localeCompare(left.id);
  });
}
function mapStabilityToVm(snapshot, incidents, workers, queues, agents) {
  const prioritizedIncidents = prioritizeStabilityIncidents(incidents);
  const activeIncidentCount = prioritizedIncidents.filter(isActiveIncident).length;
  const totalDlq = queues?.reduce((total, queue) => total + queue.dlq, 0);
  const degradedAgentCount = agents?.filter((agent) => agent.status === "degraded").length;
  const findingsValue = incidents == null || totalDlq == null || degradedAgentCount == null ? "--" : String(activeIncidentCount + totalDlq + degradedAgentCount);
  const items = [
    ...prioritizedIncidents.map((incident) => ({
      title: `${incident.severity.toUpperCase()} \xB7 ${incident.title}`,
      description: incident.summary
    })),
    ...(workers ?? []).slice(0, 2).map((worker) => ({
      title: `Worker ${worker.id}`,
      description: worker.status === "offline" ? `${worker.status} \xB7 ${worker.queue} \xB7 heartbeat unavailable` : `${worker.status} \xB7 ${worker.queue} \xB7 lag ${worker.heartbeatLagMs}ms`
    })),
    ...(queues ?? []).slice(0, 2).map((queue) => ({
      title: `Queue ${queue.id}`,
      description: `ready ${queue.ready} \xB7 in-flight ${queue.inFlight} \xB7 dlq ${queue.dlq}`
    }))
  ];
  return {
    loading: false,
    metrics: [
      { label: translateMessage("ui.stability.metric.incidents"), value: formatCount(incidents == null ? void 0 : activeIncidentCount) },
      { label: translateMessage("ui.stability.metric.workers"), value: formatCount(workers?.length) },
      { label: translateMessage("ui.stability.metric.queues"), value: formatCount(queues?.length) },
      { label: translateMessage("ui.stability.metric.dlq"), value: formatCount(totalDlq) }
    ],
    rows: snapshot == null ? [] : [
      { key: translateMessage("ui.stability.row.overall"), value: snapshot.overallHealth },
      { key: translateMessage("ui.stability.row.uptime"), value: formatPercent(snapshot.uptimePercent) },
      { key: translateMessage("ui.stability.row.errorRate"), value: formatPercent(snapshot.errorRate) },
      { key: translateMessage("ui.stability.row.p50Latency"), value: formatMs(snapshot.p50LatencyMs) },
      { key: translateMessage("ui.stability.row.p99Latency"), value: formatMs(snapshot.p99LatencyMs) },
      { key: translateMessage("ui.stability.row.queueDepth"), value: String(snapshot.queueDepth) },
      { key: translateMessage("ui.stability.row.activeWorkers"), value: String(snapshot.activeAgents ?? workers?.length ?? "--") },
      { key: translateMessage("ui.stability.row.budgetUtilization"), value: formatPercent(snapshot.budgetUtilizationPercent) },
      { key: translateMessage("ui.stability.row.findings"), value: findingsValue }
    ],
    items
  };
}
function useStabilityVm() {
  const queryClient = useQueryClient();
  const snapshotQuery = useDashboardSnapshotQuery();
  const incidentsQuery = useIncidentsQuery();
  const workersQuery = useWorkersQuery();
  const queuesQuery = useQueuesQuery();
  const agentsQuery = useAgentsQuery();
  const snapshot = snapshotQuery.data ?? null;
  const incidents = incidentsQuery.data;
  const workers = workersQuery.data;
  const queues = queuesQuery.data;
  const agents = agentsQuery.data;
  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.snapshot }),
      queryClient.invalidateQueries({ queryKey: missionControlQueryKeys.incidents }),
      queryClient.invalidateQueries({ queryKey: missionControlQueryKeys.workers }),
      queryClient.invalidateQueries({ queryKey: missionControlQueryKeys.queues }),
      queryClient.invalidateQueries({ queryKey: missionControlQueryKeys.agents })
    ]);
  }, [queryClient]);
  return useMemo(() => ({
    ...mapStabilityToVm(snapshot, incidents, workers, queues, agents),
    loading: snapshotQuery.isLoading || incidentsQuery.isLoading || workersQuery.isLoading || queuesQuery.isLoading || agentsQuery.isLoading,
    refresh
  }), [agents, agentsQuery.isLoading, incidents, incidentsQuery.isLoading, queues, queuesQuery.isLoading, refresh, snapshot, snapshotQuery.isLoading, workers, workersQuery.isLoading]);
}
export {
  mapStabilityToVm,
  useStabilityVm
};
