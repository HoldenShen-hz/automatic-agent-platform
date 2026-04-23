import type { ApprovalDTO, DashboardSnapshotDTO, TaskDTO, UserPreferenceDTO } from "@aa/shared-types";

export interface MockApiShape {
  readonly dashboard: DashboardSnapshotDTO;
  readonly tasks: readonly TaskDTO[];
  readonly approvals: readonly ApprovalDTO[];
  readonly preferences: UserPreferenceDTO;
}

export const defaultMockApiShape: MockApiShape = {
  dashboard: {
    overallHealth: "healthy",
    queueDepth: 7,
    activeExecutions: 12,
    approvalBacklog: 3,
    alertSummary: "2 medium alerts",
  },
  tasks: [
    { id: "task-1", title: "春季营销活动", status: "running", domainId: "marketing", currentStep: "launch-assets" },
    { id: "task-2", title: "量化策略检查", status: "blocked", domainId: "quant-trading", currentStep: "approval" },
  ],
  approvals: [
    { approvalId: "approval-1", taskId: "task-2", riskLevel: "critical", reasonSummary: "策略需要人工审批" },
  ],
  preferences: {
    locale: "zh-CN",
    theme: "dark",
    defaultDashboardLayout: ["overview", "tasks", "approvals"],
  },
};
