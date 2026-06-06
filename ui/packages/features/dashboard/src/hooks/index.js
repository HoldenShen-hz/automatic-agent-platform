import {
  useAgentsQuery,
  useAnalyticsQuery,
  useDashboardSnapshotQuery,
  useIncidentsQuery,
  useQueuesQuery,
  useWorkersQuery
} from "@aa/shared-state";
import { translateMessage } from "@aa/shared-i18n";
import { useMemo } from "react";
const ACTIVE_INCIDENT_STATUSES = /* @__PURE__ */ new Set(["open", "acknowledged", "mitigating"]);
function formatPercent(value) {
  if (value == null) {
    return "--";
  }
  return `${value.toFixed(1)}%`;
}
function formatCount(value) {
  if (value == null) {
    return "--";
  }
  return String(value);
}
function formatMs(value) {
  if (value == null) {
    return "--";
  }
  return `${Math.round(value)} ms`;
}
function formatRatio(value) {
  if (value == null) {
    return "--";
  }
  const normalized = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  return `${(normalized * 100).toFixed(0)}%`;
}
function formatMetricValue(metric) {
  if (metric == null) {
    return "--";
  }
  if (typeof metric.value === "string" || typeof metric.value === "number") {
    return String(metric.value);
  }
  return JSON.stringify(metric.value);
}
function isActiveIncident(incident) {
  return incident.status == null || ACTIVE_INCIDENT_STATUSES.has(incident.status);
}
function findMetric(metrics, key) {
  if (metrics == null) {
    return void 0;
  }
  const aliases = {
    "queue-throughput": ["queue-throughput", "queue throughput", "\u961F\u5217\u541E\u5410"],
    "approval-sla": ["approval-sla", "approval sla", "\u5BA1\u6279 sla"],
    "workflow-completion": ["workflow-completion", "workflow completion", "\u5DE5\u4F5C\u6D41\u5B8C\u6210\u7387"]
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
function buildPanelGroups(snapshot, analytics, incidents, workers, queues, agents) {
  const activeIncidents = incidents?.filter(isActiveIncident);
  const queueReady = queues?.reduce((total, queue) => total + queue.ready, 0);
  const queueInFlight = queues?.reduce(
    (total, queue) => total + queue.inFlight,
    0
  );
  const queueRetries = queues?.reduce(
    (total, queue) => total + queue.retries,
    0
  );
  const totalDlq = queues?.reduce((total, queue) => total + queue.dlq, 0);
  const incidentCount = activeIncidents?.length;
  const criticalIncidents = activeIncidents?.filter(
    (incident) => incident.severity === "critical"
  ).length;
  const degradedAgents = agents?.filter(
    (agent) => agent.status === "degraded"
  ).length;
  const healthyAgents = agents?.filter(
    (agent) => agent.status === "healthy"
  ).length;
  const drainingWorkers = workers?.filter(
    (worker) => worker.status === "draining"
  ).length;
  const maxWorkerLag = workers == null ? null : workers.length === 0 ? 0 : workers.reduce((maxLag, worker) => Math.max(maxLag, worker.heartbeatLagMs), 0);
  const loadBearingAgents = agents?.filter((agent) => agent.status !== "offline");
  const averageAgentLoad = loadBearingAgents == null ? null : loadBearingAgents.length === 0 ? 0 : loadBearingAgents.reduce((total, agent) => total + agent.load, 0) / loadBearingAgents.length;
  const maxAgentLoad = loadBearingAgents == null ? null : loadBearingAgents.reduce(
    (maxLoad, agent) => Math.max(maxLoad, agent.load),
    0
  );
  const healthyAgentRatio = agents == null ? null : agents.length === 0 ? 1 : (healthyAgents ?? 0) / agents.length;
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
          description: translateMessage("ui.dashboard.panel.overall-health.description")
        },
        {
          id: "success-rate",
          title: translateMessage("ui.dashboard.panel.success-rate.title"),
          value: formatPercent(snapshot.successRate),
          description: translateMessage("ui.dashboard.panel.success-rate.description")
        },
        {
          id: "active-executions",
          title: translateMessage("ui.dashboard.panel.active-executions.title"),
          value: String(snapshot.activeExecutions),
          description: translateMessage("ui.dashboard.panel.active-executions.description")
        },
        {
          id: "active-agents",
          title: translateMessage("ui.dashboard.panel.active-agents.title"),
          value: String(snapshot.activeAgents ?? agents.length),
          description: translateMessage("ui.dashboard.panel.active-agents.description")
        },
        {
          id: "approval-backlog",
          title: translateMessage("ui.dashboard.panel.approval-backlog.title"),
          value: String(snapshot.approvalBacklog),
          description: translateMessage("ui.dashboard.panel.approval-backlog.description")
        },
        {
          id: "uptime",
          title: translateMessage("ui.dashboard.panel.uptime.title"),
          value: formatPercent(snapshot.uptimePercent),
          description: translateMessage("ui.dashboard.panel.uptime.description")
        },
        {
          id: "alerts",
          title: translateMessage("ui.dashboard.panel.alerts.title"),
          value: snapshot.alertSummary,
          description: translateMessage("ui.dashboard.panel.alerts.description")
        }
      ]
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
          description: translateMessage("ui.dashboard.panel.queue-depth.description")
        },
        {
          id: "avg-duration",
          title: translateMessage("ui.dashboard.panel.avg-duration.title"),
          value: formatMs(snapshot.avgDurationMs),
          description: translateMessage("ui.dashboard.panel.avg-duration.description")
        },
        {
          id: "p50-latency",
          title: translateMessage("ui.dashboard.panel.p50-latency.title"),
          value: formatMs(snapshot.p50LatencyMs),
          description: translateMessage("ui.dashboard.panel.p50-latency.description")
        },
        {
          id: "p99-latency",
          title: translateMessage("ui.dashboard.panel.p99-latency.title"),
          value: formatMs(snapshot.p99LatencyMs),
          description: translateMessage("ui.dashboard.panel.p99-latency.description")
        },
        {
          id: "queue-ready",
          title: translateMessage("ui.dashboard.panel.queue-ready.title"),
          value: formatCount(queueReady),
          description: translateMessage("ui.dashboard.panel.queue-ready.description")
        },
        {
          id: "queue-inflight",
          title: translateMessage("ui.dashboard.panel.queue-inflight.title"),
          value: formatCount(queueInFlight),
          description: translateMessage("ui.dashboard.panel.queue-inflight.description")
        },
        {
          id: "throughput",
          title: translateMessage("ui.dashboard.panel.throughput.title"),
          value: formatMetricValue(findMetric(analytics, "queue-throughput")),
          description: translateMessage("ui.dashboard.panel.throughput.description")
        }
      ]
    },
    {
      id: "reliability",
      title: translateMessage("ui.dashboard.group.reliability.title"),
      description: translateMessage("ui.dashboard.group.reliability.description"),
      panels: [
        {
          id: "incident-count",
          title: translateMessage("ui.dashboard.panel.incident-count.title"),
          value: formatCount(incidentCount),
          description: translateMessage("ui.dashboard.panel.incident-count.description")
        },
        {
          id: "critical-incidents",
          title: translateMessage("ui.dashboard.panel.critical-incidents.title"),
          value: formatCount(criticalIncidents),
          description: translateMessage("ui.dashboard.panel.critical-incidents.description")
        },
        {
          id: "degraded-agents",
          title: translateMessage("ui.dashboard.panel.degraded-agents.title"),
          value: formatCount(degradedAgents),
          description: translateMessage("ui.dashboard.panel.degraded-agents.description")
        },
        {
          id: "draining-workers",
          title: translateMessage("ui.dashboard.panel.draining-workers.title"),
          value: formatCount(drainingWorkers),
          description: translateMessage("ui.dashboard.panel.draining-workers.description")
        },
        {
          id: "worker-lag",
          title: translateMessage("ui.dashboard.panel.worker-lag.title"),
          value: formatMs(maxWorkerLag),
          description: translateMessage("ui.dashboard.panel.worker-lag.description")
        },
        {
          id: "error-rate",
          title: translateMessage("ui.dashboard.panel.error-rate.title"),
          value: formatPercent(snapshot.errorRate),
          description: translateMessage("ui.dashboard.panel.error-rate.description")
        },
        {
          id: "dlq",
          title: translateMessage("ui.dashboard.panel.dlq.title"),
          value: formatCount(totalDlq),
          description: translateMessage("ui.dashboard.panel.dlq.description")
        }
      ]
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
          description: translateMessage("ui.dashboard.panel.budget-utilization.description")
        },
        {
          id: "avg-agent-load",
          title: translateMessage("ui.dashboard.panel.avg-agent-load.title"),
          value: formatRatio(averageAgentLoad),
          description: translateMessage("ui.dashboard.panel.avg-agent-load.description")
        },
        {
          id: "max-agent-load",
          title: translateMessage("ui.dashboard.panel.max-agent-load.title"),
          value: formatRatio(maxAgentLoad),
          description: translateMessage("ui.dashboard.panel.max-agent-load.description")
        },
        {
          id: "approval-sla",
          title: translateMessage("ui.dashboard.panel.approval-sla.title"),
          value: formatMetricValue(findMetric(analytics, "approval-sla")),
          description: translateMessage("ui.dashboard.panel.approval-sla.description")
        },
        {
          id: "workflow-completion",
          title: translateMessage("ui.dashboard.panel.workflow-completion.title"),
          value: formatMetricValue(findMetric(analytics, "workflow-completion")),
          description: translateMessage("ui.dashboard.panel.workflow-completion.description")
        },
        {
          id: "queue-retries",
          title: translateMessage("ui.dashboard.panel.queue-retries.title"),
          value: formatCount(queueRetries),
          description: translateMessage("ui.dashboard.panel.queue-retries.description")
        },
        {
          id: "healthy-agent-ratio",
          title: translateMessage("ui.dashboard.panel.healthy-agent-ratio.title"),
          value: formatRatio(healthyAgentRatio),
          description: translateMessage("ui.dashboard.panel.healthy-agent-ratio.description")
        }
      ]
    }
  ];
}
function mapDashboardSnapshotToVm(snapshot, analytics = [], incidents = [], workers = [], queues = [], agents = []) {
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
      "Evidence/Artifact"
    ],
    operatorWorkflowChecks: [
      translateMessage("ui.dashboard.check.mission-filter"),
      translateMessage("ui.dashboard.check.task-drilldown"),
      translateMessage("ui.dashboard.check.plan-graph"),
      translateMessage("ui.dashboard.check.node-run"),
      translateMessage("ui.dashboard.check.hitl-decision"),
      translateMessage("ui.dashboard.check.p0-runbook"),
      translateMessage("ui.dashboard.check.projection-warning"),
      translateMessage("ui.dashboard.check.offline-replay")
    ],
    trendValues: snapshot == null ? [] : [
      clampPercent(snapshot.successRate),
      clampPercent(snapshot.uptimePercent),
      clampPercent(snapshot.budgetUtilizationPercent),
      clampPercent(snapshot.errorRate != null ? 100 - snapshot.errorRate : void 0),
      clampPercent(
        agents == null ? void 0 : agents.length === 0 ? 100 : agents.filter((agent) => agent.status === "healthy").length / agents.length * 100
      ),
      clampPercent(snapshot.activeExecutions / Math.max(1, snapshot.activeExecutions + snapshot.queueDepth) * 100)
    ],
    metrics: snapshot == null ? [] : [
      { label: translateMessage("ui.dashboard.metric.overallHealth"), value: snapshot.overallHealth },
      {
        label: translateMessage("ui.dashboard.metric.successRate"),
        value: formatPercent(snapshot.successRate)
      },
      { label: translateMessage("ui.dashboard.metric.queueDepth"), value: snapshot.queueDepth },
      { label: translateMessage("ui.dashboard.metric.activeExecutions"), value: snapshot.activeExecutions },
      { label: translateMessage("ui.dashboard.metric.approvalBacklog"), value: snapshot.approvalBacklog }
    ],
    panelGroups: snapshot == null ? [] : buildPanelGroups(
      snapshot,
      analytics,
      incidents,
      workers,
      queues,
      agents
    )
  };
}
function useDashboardVm() {
  const snapshot = useDashboardSnapshotQuery().data ?? null;
  const detailQueriesEnabled = snapshot != null;
  const analyticsQuery = useAnalyticsQuery({ enabled: detailQueriesEnabled });
  const incidentsQuery = useIncidentsQuery({ enabled: detailQueriesEnabled });
  const workersQuery = useWorkersQuery({ enabled: detailQueriesEnabled });
  const queuesQuery = useQueuesQuery({ enabled: detailQueriesEnabled });
  const agentsQuery = useAgentsQuery({ enabled: detailQueriesEnabled });
  return useMemo(() => mapDashboardSnapshotToVm(
    snapshot,
    analyticsQuery.data,
    incidentsQuery.data,
    workersQuery.data,
    queuesQuery.data,
    agentsQuery.data
  ), [
    agentsQuery.data,
    analyticsQuery.data,
    incidentsQuery.data,
    queuesQuery.data,
    snapshot,
    workersQuery.data
  ]);
}
function normalizeMetricSelector(value) {
  return value.trim().toLowerCase().replace(/[_\s]+/g, "-");
}
function clampPercent(value) {
  if (value == null || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}
export {
  mapDashboardSnapshotToVm,
  useDashboardVm
};
