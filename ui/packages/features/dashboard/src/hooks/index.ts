import {
  useAgentsQuery,
  useAnalyticsQuery,
  useDashboardSnapshotQuery,
  useIncidentsQuery,
  useQueuesQuery,
  useWorkersQuery,
} from "@aa/shared-state";
import { translateMessage } from "@aa/shared-i18n";
import type {
  AgentDTO,
  AnalyticsMetricDTO,
  DashboardSnapshotDTO,
  IncidentDTO,
  QueueDTO,
  WorkerDTO,
} from "@aa/shared-types";
import { useMemo } from "react";

export interface DashboardPanel {
  readonly id: string;
  readonly title: string;
  readonly value: string;
  readonly description: string;
}

export interface DashboardPanelGroup {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly panels: readonly DashboardPanel[];
}

export interface DashboardVm {
  readonly loading: boolean;
  readonly metrics: readonly { label: string; value: string | number }[];
  readonly trendValues: readonly number[];
  readonly panelGroups: readonly DashboardPanelGroup[];
  readonly drilldownTrail: readonly string[];
  readonly operatorWorkflowChecks: readonly string[];
  readonly snapshot: DashboardSnapshotDTO | null;
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

function formatRatio(value: number): string {
  const normalized = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  return `${(normalized * 100).toFixed(0)}%`;
}

function formatMetricValue(metric: AnalyticsMetricDTO | undefined): string {
  if (metric == null) {
    return "--";
  }
  if (typeof metric.value === "string" || typeof metric.value === "number") {
    return String(metric.value);
  }
  return JSON.stringify(metric.value);
}

function findMetric(
  metrics: readonly AnalyticsMetricDTO[],
  key: "queue-throughput" | "approval-sla" | "workflow-completion",
): AnalyticsMetricDTO | undefined {
  const aliases: Record<typeof key, readonly string[]> = {
    "queue-throughput": ["queue-throughput", "queue throughput", "队列吞吐"],
    "approval-sla": ["approval-sla", "approval sla", "审批 sla"],
    "workflow-completion": ["workflow-completion", "workflow completion", "工作流完成率"],
  };
  const candidates = aliases[key];
  return metrics.find((metric) => {
    const normalizedId = normalizeMetricSelector(metric.id);
    const normalizedLabel = normalizeMetricSelector(metric.label);
    return candidates.some((candidate) => {
      const normalizedCandidate = normalizeMetricSelector(candidate);
      return normalizedId === normalizedCandidate || normalizedLabel === normalizedCandidate;
    });
  });
}

function buildPanelGroups(
  snapshot: DashboardSnapshotDTO,
  analytics: readonly AnalyticsMetricDTO[],
  incidents: readonly IncidentDTO[],
  workers: readonly WorkerDTO[],
  queues: readonly QueueDTO[],
  agents: readonly AgentDTO[],
): readonly DashboardPanelGroup[] {
  const queueReady = queues.reduce((total, queue) => total + queue.ready, 0);
  const queueInFlight = queues.reduce(
    (total, queue) => total + queue.inFlight,
    0,
  );
  const queueRetries = queues.reduce(
    (total, queue) => total + queue.retries,
    0,
  );
  const totalDlq = queues.reduce((total, queue) => total + queue.dlq, 0);
  const criticalIncidents = incidents.filter(
    (incident) => incident.severity === "critical",
  ).length;
  const degradedAgents = agents.filter(
    (agent) => agent.status === "degraded",
  ).length;
  const healthyAgents = agents.filter(
    (agent) => agent.status === "healthy",
  ).length;
  const drainingWorkers = workers.filter(
    (worker) => worker.status === "draining",
  ).length;
  const maxWorkerLag = workers.reduce(
    (maxLag, worker) => Math.max(maxLag, worker.heartbeatLagMs),
    0,
  );
  const averageAgentLoad =
    agents.length === 0
      ? 0
      : agents.reduce((total, agent) => total + agent.load, 0) / agents.length;
  const maxAgentLoad = agents.reduce(
    (maxLoad, agent) => Math.max(maxLoad, agent.load),
    0,
  );
  const healthyAgentRatio =
    agents.length === 0 ? 1 : healthyAgents / agents.length;

  return [
    {
      id: "executive",
      title: translateMessage("ui.dashboard.group.executive.title"),
      description: translateMessage("ui.dashboard.group.executive.description"),
      panels: [
        {
          id: "overall-health",
          title: translateMessage("ui.dashboard.panel.overall-health.title"),
          value: snapshot.overallHealth,
          description: translateMessage("ui.dashboard.panel.overall-health.description"),
        },
        {
          id: "success-rate",
          title: translateMessage("ui.dashboard.panel.success-rate.title"),
          value: formatPercent(snapshot.successRate),
          description: translateMessage("ui.dashboard.panel.success-rate.description"),
        },
        {
          id: "active-executions",
          title: translateMessage("ui.dashboard.panel.active-executions.title"),
          value: String(snapshot.activeExecutions),
          description: translateMessage("ui.dashboard.panel.active-executions.description"),
        },
        {
          id: "active-agents",
          title: translateMessage("ui.dashboard.panel.active-agents.title"),
          value: String(snapshot.activeAgents ?? agents.length),
          description: translateMessage("ui.dashboard.panel.active-agents.description"),
        },
        {
          id: "approval-backlog",
          title: translateMessage("ui.dashboard.panel.approval-backlog.title"),
          value: String(snapshot.approvalBacklog),
          description: translateMessage("ui.dashboard.panel.approval-backlog.description"),
        },
        {
          id: "uptime",
          title: translateMessage("ui.dashboard.panel.uptime.title"),
          value: formatPercent(snapshot.uptimePercent),
          description: translateMessage("ui.dashboard.panel.uptime.description"),
        },
        {
          id: "alerts",
          title: translateMessage("ui.dashboard.panel.alerts.title"),
          value: snapshot.alertSummary,
          description: translateMessage("ui.dashboard.panel.alerts.description"),
        },
      ],
    },
    {
      id: "execution",
      title: translateMessage("ui.dashboard.group.execution.title"),
      description: translateMessage("ui.dashboard.group.execution.description"),
      panels: [
        {
          id: "queue-depth",
          title: translateMessage("ui.dashboard.panel.queue-depth.title"),
          value: String(snapshot.queueDepth),
          description: translateMessage("ui.dashboard.panel.queue-depth.description"),
        },
        {
          id: "avg-duration",
          title: translateMessage("ui.dashboard.panel.avg-duration.title"),
          value: formatMs(snapshot.avgDurationMs),
          description: translateMessage("ui.dashboard.panel.avg-duration.description"),
        },
        {
          id: "p50-latency",
          title: translateMessage("ui.dashboard.panel.p50-latency.title"),
          value: formatMs(snapshot.p50LatencyMs),
          description: translateMessage("ui.dashboard.panel.p50-latency.description"),
        },
        {
          id: "p99-latency",
          title: translateMessage("ui.dashboard.panel.p99-latency.title"),
          value: formatMs(snapshot.p99LatencyMs),
          description: translateMessage("ui.dashboard.panel.p99-latency.description"),
        },
        {
          id: "queue-ready",
          title: translateMessage("ui.dashboard.panel.queue-ready.title"),
          value: String(queueReady),
          description: translateMessage("ui.dashboard.panel.queue-ready.description"),
        },
        {
          id: "queue-inflight",
          title: translateMessage("ui.dashboard.panel.queue-inflight.title"),
          value: String(queueInFlight),
          description: translateMessage("ui.dashboard.panel.queue-inflight.description"),
        },
        {
          id: "throughput",
          title: translateMessage("ui.dashboard.panel.throughput.title"),
          value: formatMetricValue(findMetric(analytics, "queue-throughput")),
          description: translateMessage("ui.dashboard.panel.throughput.description"),
        },
      ],
    },
    {
      id: "reliability",
      title: translateMessage("ui.dashboard.group.reliability.title"),
      description: translateMessage("ui.dashboard.group.reliability.description"),
      panels: [
        {
          id: "incident-count",
          title: translateMessage("ui.dashboard.panel.incident-count.title"),
          value: String(incidents.length),
          description: translateMessage("ui.dashboard.panel.incident-count.description"),
        },
        {
          id: "critical-incidents",
          title: translateMessage("ui.dashboard.panel.critical-incidents.title"),
          value: String(criticalIncidents),
          description: translateMessage("ui.dashboard.panel.critical-incidents.description"),
        },
        {
          id: "degraded-agents",
          title: translateMessage("ui.dashboard.panel.degraded-agents.title"),
          value: String(degradedAgents),
          description: translateMessage("ui.dashboard.panel.degraded-agents.description"),
        },
        {
          id: "draining-workers",
          title: translateMessage("ui.dashboard.panel.draining-workers.title"),
          value: String(drainingWorkers),
          description: translateMessage("ui.dashboard.panel.draining-workers.description"),
        },
        {
          id: "worker-lag",
          title: translateMessage("ui.dashboard.panel.worker-lag.title"),
          value: formatMs(maxWorkerLag),
          description: translateMessage("ui.dashboard.panel.worker-lag.description"),
        },
        {
          id: "error-rate",
          title: translateMessage("ui.dashboard.panel.error-rate.title"),
          value: formatPercent(snapshot.errorRate),
          description: translateMessage("ui.dashboard.panel.error-rate.description"),
        },
        {
          id: "dlq",
          title: translateMessage("ui.dashboard.panel.dlq.title"),
          value: String(totalDlq),
          description: translateMessage("ui.dashboard.panel.dlq.description"),
        },
      ],
    },
    {
      id: "economics",
      title: translateMessage("ui.dashboard.group.economics.title"),
      description: translateMessage("ui.dashboard.group.economics.description"),
      panels: [
        {
          id: "budget-utilization",
          title: translateMessage("ui.dashboard.panel.budget-utilization.title"),
          value: formatPercent(snapshot.budgetUtilizationPercent),
          description: translateMessage("ui.dashboard.panel.budget-utilization.description"),
        },
        {
          id: "avg-agent-load",
          title: translateMessage("ui.dashboard.panel.avg-agent-load.title"),
          value: formatRatio(averageAgentLoad),
          description: translateMessage("ui.dashboard.panel.avg-agent-load.description"),
        },
        {
          id: "max-agent-load",
          title: translateMessage("ui.dashboard.panel.max-agent-load.title"),
          value: formatRatio(maxAgentLoad),
          description: translateMessage("ui.dashboard.panel.max-agent-load.description"),
        },
        {
          id: "approval-sla",
          title: translateMessage("ui.dashboard.panel.approval-sla.title"),
          value: formatMetricValue(findMetric(analytics, "approval-sla")),
          description: translateMessage("ui.dashboard.panel.approval-sla.description"),
        },
        {
          id: "workflow-completion",
          title: translateMessage("ui.dashboard.panel.workflow-completion.title"),
          value: formatMetricValue(findMetric(analytics, "workflow-completion")),
          description: translateMessage("ui.dashboard.panel.workflow-completion.description"),
        },
        {
          id: "queue-retries",
          title: translateMessage("ui.dashboard.panel.queue-retries.title"),
          value: String(queueRetries),
          description: translateMessage("ui.dashboard.panel.queue-retries.description"),
        },
        {
          id: "healthy-agent-ratio",
          title: translateMessage("ui.dashboard.panel.healthy-agent-ratio.title"),
          value: formatRatio(healthyAgentRatio),
          description: translateMessage("ui.dashboard.panel.healthy-agent-ratio.description"),
        },
      ],
    },
  ];
}

export function mapDashboardSnapshotToVm(
  snapshot: DashboardSnapshotDTO | null,
  analytics: readonly AnalyticsMetricDTO[] = [],
  incidents: readonly IncidentDTO[] = [],
  workers: readonly WorkerDTO[] = [],
  queues: readonly QueueDTO[] = [],
  agents: readonly AgentDTO[] = [],
): DashboardVm {
  return {
    loading: snapshot == null,
    snapshot,
    drilldownTrail: [
      "Mission",
      "Task",
      "HarnessRun",
      "PlanGraphBundle",
      "NodeRun",
      "NodeAttempt",
      "Tool/Model/Connector",
      "Evidence/Artifact",
    ],
    operatorWorkflowChecks: [
      translateMessage("ui.dashboard.check.mission-filter"),
      translateMessage("ui.dashboard.check.task-drilldown"),
      translateMessage("ui.dashboard.check.plan-graph"),
      translateMessage("ui.dashboard.check.node-run"),
      translateMessage("ui.dashboard.check.hitl-decision"),
      translateMessage("ui.dashboard.check.p0-runbook"),
      translateMessage("ui.dashboard.check.projection-warning"),
      translateMessage("ui.dashboard.check.offline-replay"),
    ],
    trendValues:
      snapshot == null
        ? []
        : [
            clampPercent(snapshot.successRate),
            clampPercent(snapshot.uptimePercent),
            clampPercent(snapshot.budgetUtilizationPercent),
            clampPercent(snapshot.errorRate != null ? 100 - snapshot.errorRate : undefined),
            clampPercent(agents.length === 0 ? 100 : (agents.filter((agent) => agent.status === "healthy").length / agents.length) * 100),
            clampPercent((snapshot.activeExecutions / Math.max(1, snapshot.activeExecutions + snapshot.queueDepth)) * 100),
          ],
    metrics:
      snapshot == null
        ? []
        : [
            { label: "Overall Health", value: snapshot.overallHealth },
            {
              label: "Success Rate",
              value: formatPercent(snapshot.successRate),
            },
            { label: "Queue Depth", value: snapshot.queueDepth },
            { label: "Active Executions", value: snapshot.activeExecutions },
            { label: "Approval Backlog", value: snapshot.approvalBacklog },
          ],
    panelGroups:
      snapshot == null
        ? []
        : buildPanelGroups(
            snapshot,
            analytics,
            incidents,
            workers,
            queues,
            agents,
          ),
  };
}

export function useDashboardVm(): DashboardVm {
  const snapshot = useDashboardSnapshotQuery().data ?? null;
  const detailQueriesEnabled = snapshot != null;
  const analytics = useAnalyticsQuery({ enabled: detailQueriesEnabled }).data ?? [];
  const incidents = useIncidentsQuery({ enabled: detailQueriesEnabled }).data ?? [];
  const workers = useWorkersQuery({ enabled: detailQueriesEnabled }).data ?? [];
  const queues = useQueuesQuery({ enabled: detailQueriesEnabled }).data ?? [];
  const agents = useAgentsQuery({ enabled: detailQueriesEnabled }).data ?? [];
  return useMemo(() => mapDashboardSnapshotToVm(
    snapshot,
    analytics,
    incidents,
    workers,
    queues,
    agents,
  ), [
    agents,
    analytics,
    incidents,
    queues,
    snapshot,
    workers,
  ]);
}

function normalizeMetricSelector(value: string): string {
  return value.trim().toLowerCase().replace(/[_\s]+/g, "-");
}

function clampPercent(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}
