export * from "./dashboard-projection-service.js";

import type { TaskBoardItem } from "../../platform/state-evidence/truth/authoritative-task-store.js";
import type { SystemSituation } from "../../platform/shared/observability/system-situation-model.js";

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
}

export interface DailySummary {
  readonly tasksCompleted: number;
  readonly tasksInProgress: number;
  readonly tasksFailed: number;
  readonly totalCostToday: string;
  readonly agentUptimePercent: number;
  readonly highlights: readonly string[];
  readonly concerns: readonly string[];
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

export interface DashboardSystemSource {
  build(): SystemSituation;
}

export interface DashboardAggregationServiceOptions {
  readonly taskSource: DashboardTaskSource;
  readonly systemSource: DashboardSystemSource;
  readonly currentTime?: () => string;
  readonly costBurnUsd?: number;
  readonly forecastCostUsd?: number;
  readonly activeGoals?: readonly { goalId: string; progressPercent: number }[];
  readonly suggestions?: readonly AttentionItem[];
}

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

  public constructor(private readonly options: DashboardAggregationServiceOptions) {
    this.now = options.currentTime ?? (() => new Date().toISOString());
    this.costBurnUsd = options.costBurnUsd ?? 0;
    this.forecastCostUsd = options.forecastCostUsd ?? this.costBurnUsd;
    this.activeGoals = options.activeGoals ?? [];
    this.suggestions = options.suggestions ?? [];
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
        `${recentCompletions.length} 个任务已经完成`,
        `当前排队 ${system.queueBacklog.size} 个任务`,
      ],
      concerns: attentionQueue.map((item) => item.title).slice(0, 3),
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
          title: `任务失败: ${task.title}`,
          description: `任务 ${task.taskId} 需要关注`,
          actionOptions: ["inspect", "retry"],
          createdAt: task.updatedAt,
          domainId: task.divisionId ?? "general_ops",
        });
      }
      if (task.taskStatus === "pending") {
        queue.push({
          itemType: "approval_needed",
          priority: "normal",
          title: `待处理任务: ${task.title}`,
          description: "该任务尚未开始或仍在等待处理。",
          actionOptions: ["open_task", "prioritize"],
          createdAt: task.updatedAt,
          domainId: task.divisionId ?? "general_ops",
        });
      }
    }

    if (system.healthStatus !== "ok") {
      queue.push({
        itemType: "incident",
        priority: system.healthStatus === "unhealthy" ? "critical" : "high",
        title: "平台健康度下降",
        description: `当前系统状态为 ${system.healthStatus}`,
        actionOptions: ["open_ops_dashboard", "run_doctor"],
        createdAt: this.now(),
        domainId: "platform",
      });
    }

    if (this.costBurnUsd > this.forecastCostUsd && this.forecastCostUsd > 0) {
      queue.push({
        itemType: "budget_warning",
        priority: "high",
        title: "成本燃烧超出预测",
        description: `当前花费 ${formatUsd(this.costBurnUsd)}，已超过预测 ${formatUsd(this.forecastCostUsd)}`,
        actionOptions: ["review_budget", "adjust_scope"],
        createdAt: this.now(),
        domainId: "platform",
      });
    }

    return [...queue, ...this.suggestions].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }
}
