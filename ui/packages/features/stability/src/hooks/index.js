import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { dashboardQueryKeys, missionControlQueryKeys, useAgentsQuery, useDashboardSnapshotQuery, useIncidentsQuery, useQueuesQuery, useWorkersQuery } from "@aa/shared-state";
import { translateMessage } from "@aa/shared-i18n";
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
function mapStabilityToVm(snapshot, incidents, workers, queues, agents) {
  const totalDlq = queues.reduce((total, queue) => total + queue.dlq, 0);
  return {
    metrics: [
      { label: translateMessage("ui.stability.metric.incidents"), value: incidents.length },
      { label: translateMessage("ui.stability.metric.workers"), value: workers.length },
      { label: translateMessage("ui.stability.metric.queues"), value: queues.length },
      { label: translateMessage("ui.stability.metric.dlq"), value: totalDlq }
    ],
    rows: snapshot == null ? [] : [
      { key: translateMessage("ui.stability.row.overall"), value: snapshot.overallHealth },
      { key: translateMessage("ui.stability.row.uptime"), value: formatPercent(snapshot.uptimePercent) },
      { key: translateMessage("ui.stability.row.errorRate"), value: formatPercent(snapshot.errorRate) },
      { key: translateMessage("ui.stability.row.p50Latency"), value: formatMs(snapshot.p50LatencyMs) },
      { key: translateMessage("ui.stability.row.p99Latency"), value: formatMs(snapshot.p99LatencyMs) },
      { key: translateMessage("ui.stability.row.queueDepth"), value: String(snapshot.queueDepth) },
      { key: translateMessage("ui.stability.row.activeWorkers"), value: String(snapshot.activeAgents ?? workers.length) },
      { key: translateMessage("ui.stability.row.budgetUtilization"), value: formatPercent(snapshot.budgetUtilizationPercent) },
      {
        key: translateMessage("ui.stability.row.findings"),
        value: String(incidents.length + totalDlq + agents.filter((agent) => agent.status === "degraded").length)
      }
    ],
    items: incidents.map((incident) => ({
      title: `${incident.severity.toUpperCase()} \xB7 ${incident.title}`,
      description: incident.summary
    })).concat(
      workers.slice(0, 2).map((worker) => ({
        title: `Worker ${worker.id}`,
        description: worker.status === "offline" ? `${worker.status} \xB7 ${worker.queue} \xB7 heartbeat unavailable` : `${worker.status} \xB7 ${worker.queue} \xB7 lag ${worker.heartbeatLagMs}ms`
      })),
      queues.slice(0, 2).map((queue) => ({
        title: `Queue ${queue.id}`,
        description: `ready ${queue.ready} \xB7 in-flight ${queue.inFlight} \xB7 dlq ${queue.dlq}`
      }))
    )
  };
}
function useStabilityVm() {
  const queryClient = useQueryClient();
  const snapshot = useDashboardSnapshotQuery().data ?? null;
  const incidents = useIncidentsQuery().data ?? [];
  const workers = useWorkersQuery().data ?? [];
  const queues = useQueuesQuery().data ?? [];
  const agents = useAgentsQuery().data ?? [];
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
    refresh
  }), [agents, incidents, queues, refresh, snapshot, workers]);
}
export {
  mapStabilityToVm,
  useStabilityVm
};
