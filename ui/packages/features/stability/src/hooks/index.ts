import { useAgentsQuery, useDashboardSnapshotQuery, useIncidentsQuery, useQueuesQuery, useWorkersQuery } from "@aa/shared-state";
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
      { label: "Incidents", value: incidents.length },
      { label: "Workers", value: workers.length },
      { label: "Queues", value: queues.length },
      { label: "DLQ", value: totalDlq },
    ],
    rows: snapshot == null ? [] : [
      { key: "Overall", value: snapshot.overallHealth },
      { key: "Uptime", value: formatPercent(snapshot.uptimePercent) },
      { key: "Error Rate", value: formatPercent(snapshot.errorRate) },
      { key: "P50 Latency", value: formatMs(snapshot.p50LatencyMs) },
      { key: "P99 Latency", value: formatMs(snapshot.p99LatencyMs) },
      { key: "Queue Depth", value: String(snapshot.queueDepth) },
      { key: "Active Workers", value: String(snapshot.activeAgents ?? workers.length) },
      { key: "Budget Utilization", value: formatPercent(snapshot.budgetUtilizationPercent) },
      { key: "Findings", value: String(incidents.length + totalDlq + agents.filter((agent) => agent.status === "degraded").length) },
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
