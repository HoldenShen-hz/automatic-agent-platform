export * from "./dashboard-projection-service.js";

import type { TaskBoardItem } from "../../platform/state-evidence/truth/authoritative-task-store.js";

export interface DashboardSnapshot {
  readonly generatedAt: string;
  readonly workflowBacklog: number;
  readonly incidentCount: number;
  readonly budgetAlerts: number;
}

export interface DashboardPort {
  getSnapshot(): Promise<DashboardSnapshot>;
}

export interface AttentionItem {
  readonly itemType: "approval_needed" | "incident" | "budget_warning" | "quality_alert" | "suggestion";
  readonly priority: "low" | "normal" | "high" | "critical";
  readonly title: string;
  readonly description: string;
  readonly actionOptions: readonly string[];
  readonly createdAt: string;
  readonly domainId: string;
  readonly actionControls?: readonly DashboardActionControl[];
}

export interface DailySummary {
  readonly tasksCompleted: number;
  readonly tasksInProgress: number;
  readonly tasksFailed: number;
  readonly totalCostToday: string;
  readonly agentUptimePercent: number;
  readonly highlights: readonly string[];
  readonly concerns: readonly string[];
  readonly nlSummaryMetadata?: NlSummaryMetadata;
}

export interface AgentHealthCard {
  readonly agentId: string;
  readonly domainId: string;
  readonly name: string;
  readonly status: "healthy" | "degraded" | "failing" | "paused";
  readonly trustLevel: string;
  readonly tasksToday: number;
  readonly successRate7d: number;
  readonly cost7d: string;
  readonly trend: "improving" | "stable" | "declining";
}

export interface OperatorDashboard {
  readonly attentionQueue: readonly AttentionItem[];
  readonly dailySummary: DailySummary;
  readonly agentHealthCards: readonly AgentHealthCard[];
  readonly costBurn: { readonly consumedUsd: number; readonly forecastUsd: number };
  readonly activeGoals: readonly { readonly goalId: string; readonly progressPercent: number }[];
  readonly recentCompletions: readonly TaskBoardItem[];
  readonly proactiveSuggestions: readonly AttentionItem[];
  readonly metricRegistry: readonly MetricRegistryEntry[];
}

export interface DomainAdminDashboard {
  readonly domainId: string;
  readonly agentInventory: readonly AgentHealthCard[];
  readonly activeWorkflows: readonly TaskBoardItem[];
  readonly pendingApprovals: readonly AttentionItem[];
  readonly domainBudget: { readonly allocated: string; readonly consumed: string; readonly forecast: string };
}

export interface PlatformOpsDashboard {
  readonly infrastructureHealth: readonly {
    readonly component: string;
    readonly status: "healthy" | "degraded" | "down";
    readonly uptime30d: number;
    readonly errorBudgetRemaining: number;
  }[];
  readonly queueMetrics: readonly {
    readonly queueName: string;
    readonly depth: number;
    readonly avgWaitMs: number;
    readonly dlqCount: number;
  }[];
  readonly activeIncidents: readonly AttentionItem[];
}

export interface FleetDashboard {
  readonly platformHealth: {
    readonly overall: number;
    readonly degradedComponents: readonly string[];
  };
  readonly departmentOverview: readonly {
    readonly departmentId: string;
    readonly agentCount: number;
    readonly activeWorkflows: number;
    readonly healthScore: number;
    readonly incidentsOpen: number;
    readonly attentionItems: number;
  }[];
}

export interface DashboardTaskSource {
  list(limit?: number, tenantId?: string | null): TaskBoardItem[];
}

export interface DashboardSystemSituation {
  readonly healthStatus: "ok" | "degraded" | "overloaded" | "unhealthy";
  readonly queueBacklog: ReadonlySet<string>;
  readonly findings: readonly unknown[];
}

export interface DashboardSystemSource {
  build(): DashboardSystemSituation;
}

export interface DashboardAggregationServiceOptions {
  readonly taskSource: DashboardTaskSource;
  readonly systemSource: DashboardSystemSource;
  readonly currentTime?: () => string;
  readonly costBurnUsd?: number;
  readonly forecastCostUsd?: number;
  readonly activeGoals?: readonly { goalId: string; progressPercent: number }[];
  readonly suggestions?: readonly AttentionItem[];
  readonly metricRegistry?: readonly MetricRegistryEntry[];
}

export interface MetricRegistryEntry {
  readonly metricId: string;
  readonly metricOwner: string;
  readonly sourceOfTruth: string;
  readonly freshnessSlo: string;
  readonly actionability: "informational" | "operator_actionable" | "policy_gated";
  readonly permissionFilter: string;
  readonly staleBehavior: "hide" | "mark_stale" | "block_actions";
  readonly redactionPolicy: "none" | "tenant" | "strict";
}

const ATTENTION_PRIORITY_ORDER: Record<AttentionItem["priority"], number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export interface NlSummaryMetadata {
  readonly evidenceRefs: readonly string[];
  readonly freshness: string;
  readonly confidence: number;
  readonly redactionPolicy: MetricRegistryEntry["redactionPolicy"];
  readonly sourceProjectionVersion: string;
}

export interface DashboardActionControl {
  readonly actionId: string;
  readonly riskLevel: "low" | "medium" | "high" | "critical";
  readonly executionMode: "direct" | "requires_confirmation" | "blocked";
  readonly reasonCode: string;
}

const DEFAULT_METRIC_REGISTRY: readonly MetricRegistryEntry[] = [
  {
    metricId: "workflow_backlog",
    metricOwner: "orchestration_ops",
    sourceOfTruth: "authoritative-task-store",
    freshnessSlo: "1m",
    actionability: "operator_actionable",
    permissionFilter: "dashboard:l1",
    staleBehavior: "mark_stale",
    redactionPolicy: "tenant",
  },
  {
    metricId: "incident_count",
    metricOwner: "platform_ops",
    sourceOfTruth: "incident_projection",
    freshnessSlo: "30s",
    actionability: "policy_gated",
    permissionFilter: "dashboard:l2",
    staleBehavior: "block_actions",
    redactionPolicy: "strict",
  },
] as const;

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

function buildAgentCards(items: readonly TaskBoardItem[]): AgentHealthCard[] {
  const grouped = new Map<string, TaskBoardItem[]>();
  for (const item of items) {
    const key = item.divisionId ?? "general_ops";
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  return [...grouped.entries()].map(([domainId, groupedItems], index) => {
    const failures = groupedItems.filter((item) => item.taskStatus === "failed").length;
    const completed = groupedItems.filter((item) => item.taskStatus === "done").length;
    const total = groupedItems.length;
    const successRate = total === 0 ? 1 : completed / total;
    return {
      agentId: `agent:${domainId}:${index + 1}`,
      domainId,
      name: `${domainId} agent`,
      status: failures > 0 ? "degraded" : "healthy",
      trustLevel: failures > 0 ? "supervised" : "trusted",
      tasksToday: total,
      successRate7d: Number(successRate.toFixed(2)),
      cost7d: formatUsd(total * 0.05),
      trend: failures > 0 ? "declining" : completed > 0 ? "improving" : "stable",
    };
  });
}

export class DashboardAggregationService implements DashboardPort {
  private readonly now: () => string;
  private readonly costBurnUsd: number;
  private readonly forecastCostUsd: number;
  private readonly activeGoals: readonly { goalId: string; progressPercent: number }[];
  private readonly suggestions: readonly AttentionItem[];
  private readonly metricRegistry: readonly MetricRegistryEntry[];

  public constructor(private readonly options: DashboardAggregationServiceOptions) {
    this.now = options.currentTime ?? (() => new Date().toISOString());
    this.costBurnUsd = options.costBurnUsd ?? 0;
    this.forecastCostUsd = options.forecastCostUsd ?? this.costBurnUsd;
    this.activeGoals = options.activeGoals ?? [];
    this.suggestions = options.suggestions ?? [];
    this.metricRegistry = options.metricRegistry ?? DEFAULT_METRIC_REGISTRY;
  }

  public async getSnapshot(): Promise<DashboardSnapshot> {
    const tasks = this.options.taskSource.list(100);
    const system = this.options.systemSource.build();
    const attention = this.buildAttentionQueue(tasks, system);
    return {
      generatedAt: this.now(),
      workflowBacklog: tasks.filter((item) => item.taskStatus !== "done").length,
      incidentCount: attention.filter((item) => item.itemType === "incident").length,
      budgetAlerts: attention.filter((item) => item.itemType === "budget_warning").length,
    };
  }

  public buildOperatorDashboard(limit = 25): OperatorDashboard {
    const tasks = this.options.taskSource.list(limit);
    const system = this.options.systemSource.build();
    const attentionQueue = this.buildAttentionQueue(tasks, system);
    const recentCompletions = tasks.filter((item) => item.taskStatus === "done").slice(0, 5);
    const summary: DailySummary = {
      tasksCompleted: recentCompletions.length,
      tasksInProgress: tasks.filter((item) => item.taskStatus === "in_progress").length,
      tasksFailed: tasks.filter((item) => item.taskStatus === "failed").length,
      totalCostToday: formatUsd(this.costBurnUsd),
      agentUptimePercent: system.healthStatus === "ok" ? 99 : system.healthStatus === "degraded" ? 95 : 85,
      highlights: [
        `${recentCompletions.length} tasks completed`,
        `${system.queueBacklog.size} tasks currently queued`,
      ],
      concerns: attentionQueue.map((item) => item.title).slice(0, 3),
      nlSummaryMetadata: {
        evidenceRefs: [
          "projection:task_summary",
          "projection:incident_summary",
          "projection:system_situation",
        ],
        freshness: "1m",
        confidence: system.healthStatus === "ok" ? 0.91 : 0.84,
        redactionPolicy: "tenant",
        sourceProjectionVersion: "dashboard.v43",
      },
    };

    return {
      attentionQueue,
      dailySummary: summary,
      agentHealthCards: buildAgentCards(tasks),
      costBurn: {
        consumedUsd: this.costBurnUsd,
        forecastUsd: this.forecastCostUsd,
      },
      activeGoals: this.activeGoals,
      recentCompletions,
      proactiveSuggestions: this.suggestions,
      metricRegistry: this.metricRegistry,
    };
  }

  public buildDomainAdminDashboard(domainId: string, limit = 50): DomainAdminDashboard {
    const tasks = this.options.taskSource.list(limit).filter((item) => (item.divisionId ?? "general_ops") === domainId);
    const approvals = this.buildAttentionQueue(tasks, this.options.systemSource.build())
      .filter((item) => item.itemType === "approval_needed");
    return {
      domainId,
      agentInventory: buildAgentCards(tasks),
      activeWorkflows: tasks.filter((item) => item.taskStatus !== "done"),
      pendingApprovals: approvals,
      domainBudget: {
        allocated: formatUsd(Math.max(10, tasks.length * 0.2)),
        consumed: formatUsd(tasks.length * 0.05),
        forecast: formatUsd(tasks.length * 0.08),
      },
    };
  }

  public buildPlatformOpsDashboard(limit = 100): PlatformOpsDashboard {
    const tasks = this.options.taskSource.list(limit);
    const system = this.options.systemSource.build();
    const incidents = this.buildAttentionQueue(tasks, system).filter((item) => item.itemType === "incident");
    return {
      infrastructureHealth: [
        {
          component: "platform",
          status: system.healthStatus === "unhealthy" ? "down" : system.healthStatus === "ok" ? "healthy" : "degraded",
          uptime30d: system.healthStatus === "ok" ? 99.9 : 96,
          errorBudgetRemaining: system.healthStatus === "ok" ? 92 : 68,
        },
        {
          component: "model_gateway",
          status: system.providerHealth.status === "failed" ? "down" : system.providerHealth.status === "healthy" ? "healthy" : "degraded",
          uptime30d: Number((system.providerHealth.successRate * 100).toFixed(1)),
          errorBudgetRemaining: Number((system.providerHealth.successRate * 100).toFixed(0)),
        },
      ],
      queueMetrics: [
        {
          queueName: "default",
          depth: system.queueBacklog.size,
          avgWaitMs: system.queueBacklog.degraded ? 2000 : 250,
          dlqCount: 0,
        },
      ],
      activeIncidents: incidents,
    };
  }

  public buildFleetDashboard(limit = 100): FleetDashboard {
    const tasks = this.options.taskSource.list(limit);
    const system = this.options.systemSource.build();
    const grouped = new Map<string, TaskBoardItem[]>();
    for (const item of tasks) {
      const key = item.divisionId ?? "general_ops";
      grouped.set(key, [...(grouped.get(key) ?? []), item]);
    }

    return {
      platformHealth: {
        overall: system.healthStatus === "ok" ? 92 : system.healthStatus === "degraded" ? 75 : 58,
        degradedComponents: system.healthStatus === "ok" ? [] : [system.healthStatus],
      },
      departmentOverview: [...grouped.entries()].map(([departmentId, items]) => {
        const incidentsOpen = items.filter((item) => item.taskStatus === "failed").length;
        return {
          departmentId,
          agentCount: Math.max(1, new Set(items.map((item) => item.divisionId ?? "general_ops")).size),
          activeWorkflows: items.filter((item) => item.taskStatus !== "done").length,
          healthScore: Math.max(20, 100 - incidentsOpen * 20),
          incidentsOpen,
          attentionItems: incidentsOpen + items.filter((item) => item.taskStatus === "pending").length,
        };
      }),
    };
  }

  private buildAttentionQueue(tasks: readonly TaskBoardItem[], system: SystemSituation): AttentionItem[] {
    const queue: AttentionItem[] = [];
    for (const task of tasks) {
      if (task.taskStatus === "failed") {
        queue.push({
          itemType: "incident",
          priority: "high",
          title: `Task failed: ${task.title}`,
          description: `Task ${task.taskId} requires attention`,
          actionOptions: ["inspect", "retry"],
          actionControls: this.buildActionControls("incident", "high", ["inspect", "retry"]),
          createdAt: task.updatedAt,
          domainId: task.divisionId ?? "general_ops",
        });
      }
      if (task.taskStatus === "pending") {
        queue.push({
          itemType: "approval_needed",
          priority: "normal",
          title: `Pending task: ${task.title}`,
          description: "This task has not started or is still waiting to be processed.",
          actionOptions: ["open_task", "prioritize"],
          actionControls: this.buildActionControls("approval_needed", "normal", ["open_task", "prioritize"]),
          createdAt: task.updatedAt,
          domainId: task.divisionId ?? "general_ops",
        });
      }
    }

    if (system.healthStatus !== "ok") {
      queue.push({
        itemType: "incident",
        priority: system.healthStatus === "unhealthy" ? "critical" : "high",
        title: "Platform health degraded",
        description: `Current system status: ${system.healthStatus}`,
        actionOptions: ["open_ops_dashboard", "run_doctor"],
        actionControls: this.buildActionControls("incident", system.healthStatus === "unhealthy" ? "critical" : "high", ["open_ops_dashboard", "run_doctor"]),
        createdAt: this.now(),
        domainId: "platform",
      });
    }

    if (this.costBurnUsd > this.forecastCostUsd && this.forecastCostUsd > 0) {
      queue.push({
        itemType: "budget_warning",
        priority: "high",
        title: "Cost burn exceeds forecast",
        description: `Current spend ${formatUsd(this.costBurnUsd)} has exceeded forecast ${formatUsd(this.forecastCostUsd)}`,
        actionOptions: ["review_budget", "adjust_scope"],
        actionControls: this.buildActionControls("budget_warning", "high", ["review_budget", "adjust_scope"]),
        createdAt: this.now(),
        domainId: "platform",
      });
    }

    return [...queue, ...this.suggestions].sort((left, right) => {
      const priorityDelta = ATTENTION_PRIORITY_ORDER[left.priority] - ATTENTION_PRIORITY_ORDER[right.priority];
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return right.createdAt.localeCompare(left.createdAt);
    });
  }

  private buildActionControls(
    itemType: AttentionItem["itemType"],
    priority: AttentionItem["priority"],
    actionOptions: readonly string[],
  ): DashboardActionControl[] {
    return actionOptions.map((actionId) => {
      const riskLevel: DashboardActionControl["riskLevel"] =
        priority === "critical" ? "critical" : priority === "high" ? "high" : itemType === "approval_needed" ? "medium" : "low";
      return {
        actionId,
        riskLevel,
        executionMode: riskLevel === "high" || riskLevel === "critical" ? "requires_confirmation" : "direct",
        reasonCode: riskLevel === "high" || riskLevel === "critical"
          ? "dashboard.action_requires_risk_gate"
          : "dashboard.action_low_risk",
      };
    });
  }
}
