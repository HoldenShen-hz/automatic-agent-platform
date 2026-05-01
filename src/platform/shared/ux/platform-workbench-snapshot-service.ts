/**
 * Platform Workbench Snapshot Service
 *
 * Provides the canonical snapshot builder for the operator workbench dashboard.
 * This service is located in platform/shared (rather than interaction/) so it
 * can be used by platform/interface without crossing plane boundaries.
 */

export interface WorkbenchApprovalQueueItem {
  readonly approvalId: string;
  readonly taskId: string;
  readonly riskLevel: "low" | "medium" | "high" | "critical";
  readonly title: string;
  readonly status: string;
}

export interface WorkbenchOperatorAction {
  readonly actionId: string;
  readonly label: string;
  readonly route: string;
  readonly requiredRole: "viewer" | "operator" | "admin";
}

export interface WorkbenchDashboardSnapshot {
  readonly dailySummary: {
    readonly tasksCompleted: number;
    readonly tasksInProgress: number;
    readonly tasksFailed: number;
    readonly totalCostToday: string;
    readonly agentUptimePercent: number;
    readonly highlights: readonly string[];
    readonly concerns: readonly string[];
  };
  readonly attentionQueue: readonly WorkbenchAttentionItem[];
  readonly recentCompletions: readonly WorkbenchTaskBoardItem[];
  readonly agentHealthCards: readonly unknown[];
  readonly costBurn: { consumedUsd: number; forecastUsd: number };
  readonly activeGoals: readonly unknown[];
  readonly proactiveSuggestions: readonly unknown[];
  readonly metricRegistry: readonly unknown[];
}

export interface WorkbenchAttentionItem {
  readonly itemType: string;
  readonly priority: "low" | "normal" | "high" | "critical";
  readonly title: string;
  readonly description: string;
  readonly actionOptions: readonly string[];
  readonly createdAt: string;
  readonly domainId: string;
}

export interface WorkbenchTaskBoardItem {
  readonly taskId: string;
  readonly taskStatus: string;
}

export interface PlatformWorkbenchSnapshot {
  readonly generatedAt: string;
  readonly dashboard: WorkbenchDashboardSnapshot | null;
  readonly approvalQueue: readonly WorkbenchApprovalQueueItem[];
  readonly inventorySummary: {
    readonly benchmarkCount: number;
    readonly projectionCount: number;
    readonly deploymentCount: number;
    readonly judgeCount: number;
    readonly complianceProgramCount: number;
  };
}

export class PlatformWorkbenchSnapshotService {
  public buildSnapshot(input: {
    generatedAt?: string;
    dashboard?: WorkbenchDashboardSnapshot | null;
    approvalQueue?: readonly WorkbenchApprovalQueueItem[];
    inventorySummary?: Partial<PlatformWorkbenchSnapshot["inventorySummary"]>;
  }): PlatformWorkbenchSnapshot {
    return {
      generatedAt: input.generatedAt ?? new Date().toISOString(),
      dashboard: input.dashboard ?? null,
      approvalQueue: [...(input.approvalQueue ?? [])],
      inventorySummary: {
        benchmarkCount: input.inventorySummary?.benchmarkCount ?? 0,
        projectionCount: input.inventorySummary?.projectionCount ?? 0,
        deploymentCount: input.inventorySummary?.deploymentCount ?? 0,
        judgeCount: input.inventorySummary?.judgeCount ?? 0,
        complianceProgramCount: input.inventorySummary?.complianceProgramCount ?? 0,
      },
    };
  }
}
