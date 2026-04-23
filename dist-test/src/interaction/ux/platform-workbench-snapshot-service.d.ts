import type { OperatorDashboard } from "../dashboard/index.js";
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
export declare class PlatformWorkbenchSnapshotService {
    buildSnapshot(input: {
        generatedAt?: string;
        onboarding?: GuidedOnboardingSession | null;
        dashboard?: OperatorDashboard | null;
        hitlInbox?: readonly HitlInboxItem[];
        approvalQueue?: readonly WorkbenchApprovalQueueItem[];
        operatorActions?: readonly WorkbenchOperatorAction[];
        sdkShortcuts?: readonly SdkWorkbenchShortcut[];
        inventorySummary?: Partial<PlatformWorkbenchSnapshot["inventorySummary"]>;
    }): PlatformWorkbenchSnapshot;
}
