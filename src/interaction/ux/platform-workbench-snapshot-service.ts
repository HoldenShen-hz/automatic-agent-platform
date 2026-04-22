import type { AttentionItem, OperatorDashboard } from "../dashboard/index.js";
import type { GuidedOnboardingSession } from "./user-experience-orchestration-service.js";
import type { HitlInboxItem } from "../../platform/orchestration/hitl/hitl-inbox-service.js";
import type { SdkWorkbenchShortcut } from "../../sdk/workbench/index.js";

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

export interface PlatformWorkbenchSnapshot {
  readonly generatedAt: string;
  readonly onboarding: GuidedOnboardingSession | null;
  readonly dashboard: Pick<OperatorDashboard, "dailySummary" | "attentionQueue" | "recentCompletions"> | null;
  readonly hitlInbox: readonly HitlInboxItem[];
  readonly approvalQueue: readonly WorkbenchApprovalQueueItem[];
  readonly operatorActions: readonly WorkbenchOperatorAction[];
  readonly sdkShortcuts: readonly SdkWorkbenchShortcut[];
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
    onboarding?: GuidedOnboardingSession | null;
    dashboard?: OperatorDashboard | null;
    hitlInbox?: readonly HitlInboxItem[];
    approvalQueue?: readonly WorkbenchApprovalQueueItem[];
    operatorActions?: readonly WorkbenchOperatorAction[];
    sdkShortcuts?: readonly SdkWorkbenchShortcut[];
    inventorySummary?: Partial<PlatformWorkbenchSnapshot["inventorySummary"]>;
  }): PlatformWorkbenchSnapshot {
    return {
      generatedAt: input.generatedAt ?? new Date().toISOString(),
      onboarding: input.onboarding ?? null,
      dashboard: input.dashboard == null
        ? null
        : {
            dailySummary: input.dashboard.dailySummary,
            attentionQueue: input.dashboard.attentionQueue,
            recentCompletions: input.dashboard.recentCompletions,
          },
      hitlInbox: [...(input.hitlInbox ?? [])],
      approvalQueue: [...(input.approvalQueue ?? [])],
      operatorActions: [...(input.operatorActions ?? defaultOperatorActions(input.dashboard?.attentionQueue ?? []))],
      sdkShortcuts: [...(input.sdkShortcuts ?? [])],
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

function defaultOperatorActions(attentionQueue: readonly AttentionItem[]): readonly WorkbenchOperatorAction[] {
  const hasCriticalAttention = attentionQueue.some((item) => item.priority === "critical");
  return [
    {
      actionId: "open_approvals",
      label: "Open Approval Queue",
      route: "/console/approvals",
      requiredRole: "viewer",
    },
    {
      actionId: "open_stability",
      label: "Open Stability Panel",
      route: "/console/stability",
      requiredRole: "operator",
    },
    {
      actionId: hasCriticalAttention ? "open_takeover_console" : "open_task_board",
      label: hasCriticalAttention ? "Open Takeover Console" : "Open Task Board",
      route: hasCriticalAttention ? "/console/admin/tasks" : "/console",
      requiredRole: hasCriticalAttention ? "admin" : "operator",
    },
  ];
}
