export * from "./dashboard-projection-service.js";
function formatUsd(value) {
    return `$${value.toFixed(2)}`;
}
function buildAgentCards(items) {
    const grouped = new Map();
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
export class DashboardAggregationService {
    options;
    now;
    costBurnUsd;
    forecastCostUsd;
    activeGoals;
    suggestions;
    constructor(options) {
        this.options = options;
        this.now = options.currentTime ?? (() => new Date().toISOString());
        this.costBurnUsd = options.costBurnUsd ?? 0;
        this.forecastCostUsd = options.forecastCostUsd ?? this.costBurnUsd;
        this.activeGoals = options.activeGoals ?? [];
        this.suggestions = options.suggestions ?? [];
    }
    async getSnapshot() {
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
    buildOperatorDashboard(limit = 25) {
        const tasks = this.options.taskSource.list(limit);
        const system = this.options.systemSource.build();
        const attentionQueue = this.buildAttentionQueue(tasks, system);
        const recentCompletions = tasks.filter((item) => item.taskStatus === "done").slice(0, 5);
        const summary = {
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
    buildDomainAdminDashboard(domainId, limit = 50) {
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
    buildPlatformOpsDashboard(limit = 100) {
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
    buildFleetDashboard(limit = 100) {
        const tasks = this.options.taskSource.list(limit);
        const system = this.options.systemSource.build();
        const grouped = new Map();
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
    buildAttentionQueue(tasks, system) {
        const queue = [];
        for (const task of tasks) {
            if (task.taskStatus === "failed") {
                queue.push({
                    itemType: "incident",
                    priority: "high",
                    title: `Task failed: ${task.title}`,
                    description: `Task ${task.taskId} requires attention`,
                    actionOptions: ["inspect", "retry"],
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
                createdAt: this.now(),
                domainId: "platform",
            });
        }
        return [...queue, ...this.suggestions].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    }
}
//# sourceMappingURL=index.js.map