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
    readonly costBurn: {
        readonly consumedUsd: number;
        readonly forecastUsd: number;
    };
    readonly activeGoals: readonly {
        readonly goalId: string;
        readonly progressPercent: number;
    }[];
    readonly recentCompletions: readonly TaskBoardItem[];
    readonly proactiveSuggestions: readonly AttentionItem[];
}
export interface DomainAdminDashboard {
    readonly domainId: string;
    readonly agentInventory: readonly AgentHealthCard[];
    readonly activeWorkflows: readonly TaskBoardItem[];
    readonly pendingApprovals: readonly AttentionItem[];
    readonly domainBudget: {
        readonly allocated: string;
        readonly consumed: string;
        readonly forecast: string;
    };
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
    readonly activeGoals?: readonly {
        goalId: string;
        progressPercent: number;
    }[];
    readonly suggestions?: readonly AttentionItem[];
}
export declare class DashboardAggregationService implements DashboardPort {
    private readonly options;
    private readonly now;
    private readonly costBurnUsd;
    private readonly forecastCostUsd;
    private readonly activeGoals;
    private readonly suggestions;
    constructor(options: DashboardAggregationServiceOptions);
    getSnapshot(): Promise<DashboardSnapshot>;
    buildOperatorDashboard(limit?: number): OperatorDashboard;
    buildDomainAdminDashboard(domainId: string, limit?: number): DomainAdminDashboard;
    buildPlatformOpsDashboard(limit?: number): PlatformOpsDashboard;
    buildFleetDashboard(limit?: number): FleetDashboard;
    private buildAttentionQueue;
}
