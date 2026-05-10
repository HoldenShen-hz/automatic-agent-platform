import {
  useAgentsQuery,
  useAnalyticsQuery,
  useDashboardSnapshotQuery,
  useIncidentsQuery,
  useQueuesQuery,
  useWorkersQuery,
} from "@aa/shared-state";
import type {
  AgentDTO,
  AnalyticsMetricDTO,
  DashboardSnapshotDTO,
  IncidentDTO,
  QueueDTO,
  WorkerDTO,
} from "@aa/shared-types";

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
  return `${(value * 100).toFixed(0)}%`;
}

function formatMetricValue(metric: AnalyticsMetricDTO | undefined): string {
  if (metric == null) {
    return "--";
  }
  return String(metric.value);
}

function findMetric(metrics: readonly AnalyticsMetricDTO[], label: string): AnalyticsMetricDTO | undefined {
  return metrics.find((metric) => metric.label === label);
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
  const queueInFlight = queues.reduce((total, queue) => total + queue.inFlight, 0);
  const queueRetries = queues.reduce((total, queue) => total + queue.retries, 0);
  const totalDlq = queues.reduce((total, queue) => total + queue.dlq, 0);
  const criticalIncidents = incidents.filter((incident) => incident.severity === "critical").length;
  const degradedAgents = agents.filter((agent) => agent.status === "degraded").length;
  const healthyAgents = agents.filter((agent) => agent.status === "healthy").length;
  const drainingWorkers = workers.filter((worker) => worker.status === "draining").length;
  const maxWorkerLag = workers.reduce((maxLag, worker) => Math.max(maxLag, worker.heartbeatLagMs), 0);
  const averageAgentLoad = agents.length === 0 ? 0 : agents.reduce((total, agent) => total + agent.load, 0) / agents.length;
  const maxAgentLoad = agents.reduce((maxLoad, agent) => Math.max(maxLoad, agent.load), 0);
  const healthyAgentRatio = agents.length === 0 ? 1 : healthyAgents / agents.length;

  return [
    {
      id: "executive",
      title: "总览层",
      description: "系统健康、待办积压与值班关注点。",
      panels: [
        { id: "overall-health", title: "总体健康", value: snapshot.overallHealth, description: "Mission Control 汇总状态。" },
        { id: "success-rate", title: "成功率", value: formatPercent(snapshot.successRate), description: "任务与执行主链的成功比例。" },
        { id: "active-executions", title: "活跃执行", value: String(snapshot.activeExecutions), description: "当前正在运行的执行单元。" },
        { id: "active-agents", title: "活跃代理", value: String(snapshot.activeAgents ?? agents.length), description: "当前参与任务的代理数量。" },
        { id: "approval-backlog", title: "审批积压", value: String(snapshot.approvalBacklog), description: "等待人工批准的积压数量。" },
        { id: "uptime", title: "运行可用率", value: formatPercent(snapshot.uptimePercent), description: "Mission Control 汇总 uptime 百分比。" },
        { id: "alerts", title: "告警摘要", value: snapshot.alertSummary, description: "值班视角的一句话风险提示。" },
      ],
    },
    {
      id: "execution",
      title: "执行层",
      description: "延迟、队列压力与执行吞吐。",
      panels: [
        { id: "queue-depth", title: "队列深度", value: String(snapshot.queueDepth), description: "聚合等待队列深度。" },
        { id: "avg-duration", title: "平均耗时", value: formatMs(snapshot.avgDurationMs), description: "任务或步骤的平均完成耗时。" },
        { id: "p50-latency", title: "P50 延迟", value: formatMs(snapshot.p50LatencyMs), description: "中位延迟。" },
        { id: "p99-latency", title: "P99 延迟", value: formatMs(snapshot.p99LatencyMs), description: "高尾延迟。" },
        { id: "queue-ready", title: "待消费任务", value: String(queueReady), description: "全部队列中 ready 状态任务总数。" },
        { id: "queue-inflight", title: "处理中任务", value: String(queueInFlight), description: "全部队列中 in-flight 任务总数。" },
        { id: "throughput", title: "队列吞吐", value: formatMetricValue(findMetric(analytics, "Queue Throughput")), description: "来自分析层的队列吞吐指标。" },
      ],
    },
    {
      id: "reliability",
      title: "稳定性层",
      description: "事件压力、Worker 稳定度与降级容量。",
      panels: [
        { id: "incident-count", title: "事件总数", value: String(incidents.length), description: "当前稳定性事件数量。" },
        { id: "critical-incidents", title: "严重事件", value: String(criticalIncidents), description: "critical 优先级事件数量。" },
        { id: "degraded-agents", title: "降级代理", value: String(degradedAgents), description: "状态为 degraded 的代理数量。" },
        { id: "draining-workers", title: "Draining Workers", value: String(drainingWorkers), description: "正在退出流量的 Worker 数量。" },
        { id: "worker-lag", title: "最大心跳延迟", value: formatMs(maxWorkerLag), description: "Worker 心跳延迟上界。" },
        { id: "error-rate", title: "错误率", value: formatPercent(snapshot.errorRate), description: "Mission Control 汇总错误率。" },
        { id: "dlq", title: "DLQ 总量", value: String(totalDlq), description: "全部队列死信数量。" },
      ],
    },
    {
      id: "economics",
      title: "预算风险层",
      description: "预算姿态、审批负载与领域负荷信号。",
      panels: [
        { id: "budget-utilization", title: "预算利用率", value: formatPercent(snapshot.budgetUtilizationPercent), description: "当前预算消耗占比。" },
        { id: "avg-agent-load", title: "平均代理负荷", value: formatRatio(averageAgentLoad), description: "代理平均负荷。" },
        { id: "max-agent-load", title: "峰值代理负荷", value: formatRatio(maxAgentLoad), description: "代理峰值负荷。" },
        { id: "approval-sla", title: "审批 SLA", value: formatMetricValue(findMetric(analytics, "Approval SLA")), description: "审批链路的 SLA 指标。" },
        { id: "workflow-completion", title: "工作流完成率", value: formatMetricValue(findMetric(analytics, "Workflow Completion")), description: "工作流完成率趋势。" },
        { id: "queue-retries", title: "重试总量", value: String(queueRetries), description: "全部队列累计重试次数。" },
        { id: "healthy-agent-ratio", title: "健康代理占比", value: formatRatio(healthyAgentRatio), description: "healthy 状态代理占比。" },
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
    trendValues: snapshot == null
      ? []
      : [
          snapshot.successRate ?? 0,
          snapshot.queueDepth,
          snapshot.activeExecutions,
          snapshot.approvalBacklog,
          snapshot.errorRate ?? 0,
          snapshot.budgetUtilizationPercent ?? 0,
        ],
    metrics: snapshot == null ? [] : [
      { label: "Overall Health", value: snapshot.overallHealth },
      { label: "Success Rate", value: formatPercent(snapshot.successRate) },
      { label: "Queue Depth", value: snapshot.queueDepth },
      { label: "Active Executions", value: snapshot.activeExecutions },
      { label: "Approval Backlog", value: snapshot.approvalBacklog },
    ],
    panelGroups: snapshot == null ? [] : buildPanelGroups(snapshot, analytics, incidents, workers, queues, agents),
  };
}

export function useDashboardVm(): DashboardVm {
  const snapshot = useDashboardSnapshotQuery().data ?? null;
  const analytics = useAnalyticsQuery().data ?? [];
  const incidents = useIncidentsQuery().data ?? [];
  const workers = useWorkersQuery().data ?? [];
  const queues = useQueuesQuery().data ?? [];
  const agents = useAgentsQuery().data ?? [];
  return mapDashboardSnapshotToVm(snapshot, analytics, incidents, workers, queues, agents);
}
