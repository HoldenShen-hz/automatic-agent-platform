import { useAgentsQuery, useDashboardSnapshotQuery, useIncidentsQuery, useQueuesQuery, useWorkersQuery } from "@aa/shared-state";
import { translateMessage } from "@aa/shared-i18n";
import type { AgentDTO, DashboardSnapshotDTO, IncidentDTO, QueueDTO, WorkerDTO } from "@aa/shared-types";

export interface StabilityVm {
  readonly metrics: readonly { label: string; value: string | number }[];
  readonly rows: readonly { key: string; value: string }[];
  readonly items: readonly { title: string; description: string }[];
}

function formatPercent(value?: number | null): string {
  if (value == null) {
    return "--";
  }
  return `${value.toFixed(1)}%`;
}

function formatMs(value?: number | null): string {
  if (value == null) {
    return "--";
  }
  return `${Math.round(value)} ms`;
}

export function mapStabilityToVm(
  snapshot: DashboardSnapshotDTO | null,
  incidents: readonly IncidentDTO[],
  workers: readonly WorkerDTO[],
  queues: readonly QueueDTO[],
  agents: readonly AgentDTO[],
): StabilityVm {
  const totalDlq = queues.reduce((total, queue) => total + queue.dlq, 0);
  return {
    metrics: [
      { label: translateMessage("ui.stability.metric.incidents"), value: incidents.length },
      { label: translateMessage("ui.stability.metric.workers"), value: workers.length },
      { label: translateMessage("ui.stability.metric.queues"), value: queues.length },
      { label: translateMessage("ui.stability.metric.dlq"), value: totalDlq },
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
        value: String(incidents.length + totalDlq + agents.filter((agent) => agent.status === "degraded").length),
      },
    ],
    items: incidents.map((incident) => ({
      title: `${incident.severity.toUpperCase()} · ${incident.title}`,
      description: incident.summary,
    })).concat(
      workers.slice(0, 2).map((worker) => ({
        title: `Worker ${worker.id}`,
        description: `${worker.status} · ${worker.queue} · lag ${worker.heartbeatLagMs}ms`,
      })),
      queues.slice(0, 2).map((queue) => ({
        title: `Queue ${queue.id}`,
        description: `ready ${queue.ready} · in-flight ${queue.inFlight} · dlq ${queue.dlq}`,
      })),
    ),
  };
}

export function useStabilityVm(): StabilityVm {
  return mapStabilityToVm(
    useDashboardSnapshotQuery().data ?? null,
    useIncidentsQuery().data ?? [],
    useWorkersQuery().data ?? [],
    useQueuesQuery().data ?? [],
    useAgentsQuery().data ?? [],
  );
}
