import type { DivisionRegistry } from "../../../domains/governance/division-loader.js";
import { GatewayTargetDirectoryService } from "../channel-gateway/gateway-target-directory-service.js";
import type { HealthStatusReport } from "../../shared/observability/health-service.js";
import { HealthService } from "../../shared/observability/health-service.js";
import { InspectService, type TaskInspectSummary, type WorkflowInspectSummary, type WorkerInspectSummary } from "../../shared/observability/inspect-service.js";
import { MetricsService, type RuntimeMetricsSummary } from "../../shared/observability/metrics-service.js";
import { TaskTimelineService } from "../../shared/observability/task-timeline-service.js";
import { AuthoritativeTaskStore, type TaskBoardItem } from "../../state-evidence/truth/authoritative-task-store.js";
import type { ApprovalRecord, BillingAccountRecord, ExecutionLeaseRecord, PmfValidationReportRecord } from "../../contracts/types/domain.js";
export interface DivisionCatalogEntry {
    divisionId: string;
    name: string;
    source: "registry" | "tasks";
}
export interface BillingAccountPreview {
    accountId: string;
    ownerId: string;
    workspaceId: string | null;
    planId: string;
    status: BillingAccountRecord["status"];
    updatedAt: string;
}
export interface PerceptionBriefPreview {
    briefId: string;
    generatedAt: string;
    itemIds: string[];
    summary: string;
    proposalCount: number;
}
export interface GatewayTargetPreview {
    targetId: string;
    channel: string;
    displayName: string;
    source: "directory" | "session_history";
    lastSeenAt: string | null;
}
export interface MissionControlSnapshot {
    generatedAt: string;
    health: HealthStatusReport;
    metrics: RuntimeMetricsSummary;
    taskBoard: TaskBoardItem[];
    pendingApprovals: ApprovalRecord[];
    divisions: DivisionCatalogEntry[];
    productSignals: {
        latestPmfReport: PmfValidationReportRecord | null;
        billingAccounts: BillingAccountPreview[];
        perceptionBriefs: PerceptionBriefPreview[];
    };
    gatewayTargets: GatewayTargetPreview[];
}
export interface WorkflowCockpitView {
    generatedAt: string;
    summary: WorkflowInspectSummary;
    inspect: ReturnType<InspectService["getTaskInspectView"]>;
    timeline: ReturnType<TaskTimelineService["buildTaskTimeline"]>;
}
export interface StabilityPanelView {
    generatedAt: string;
    health: HealthStatusReport;
    activeTasks: TaskInspectSummary[];
    queuedTasks: TaskInspectSummary[];
    blockedTasks: TaskInspectSummary[];
    workflows: WorkflowInspectSummary[];
    pendingApprovals: ApprovalRecord[];
    workers: WorkerInspectSummary[];
    findings: string[];
}
export interface AdminTakeoverConsoleView {
    generatedAt: string;
    scope: {
        taskId: string;
        divisionId: string | null;
        workspaceId: string | null;
        tenantId: string | null;
    };
    executionOwner: {
        executionId: string | null;
        agentId: string | null;
        workerId: string | null;
        leaseId: string | null;
        leaseStatus: ExecutionLeaseRecord["status"] | null;
    };
    activeWorker: WorkerInspectSummary | null;
    versions: {
        modelVersion: string | null;
        promptVersion: string | null;
        policyVersion: string | null;
    };
    latestPmfVerdict: PmfValidationReportRecord["verdict"] | null;
    billingAccounts: BillingAccountPreview[];
    inspect: ReturnType<InspectService["getTaskInspectView"]>;
    timeline: ReturnType<TaskTimelineService["buildTaskTimeline"]>;
}
export interface MissionControlServiceOptions {
    divisionRegistry?: DivisionRegistry | null;
    gatewayTargetDirectoryService?: GatewayTargetDirectoryService | null;
}
export declare class MissionControlService {
    private readonly store;
    private readonly healthService;
    private readonly metricsService;
    private readonly inspectService;
    private readonly taskBoardService;
    private readonly timelineService;
    private readonly divisionRegistry;
    private readonly gatewayTargetDirectoryService;
    constructor(store: AuthoritativeTaskStore, healthService: HealthService, metricsService: MetricsService, inspectService: InspectService, options?: MissionControlServiceOptions);
    getSnapshot(tenantId?: string | null): MissionControlSnapshot;
    getHealthReportAsync(): Promise<HealthStatusReport>;
    /**
     * Retrieves task cockpit view with optional tenant filtering.
     * When tenantId is provided, ensures the task belongs to that tenant.
     */
    getTaskCockpit(taskId: string, tenantId?: string | null): {
        snapshot: import("../../state-evidence/truth/authoritative-task-store.js").TaskSnapshot;
        inspect: import("../../shared/observability/inspect-service-support.js").TaskInspectView;
        timeline: {
            taskId: string;
            entries: import("../../shared/observability/task-timeline-service.js").TaskTimelineEntry[];
            inspect: import("../../shared/observability/inspect-service-support.js").TaskInspectView;
        };
    };
    listWorkflowCockpits(limit?: number, tenantId?: string | null): WorkflowInspectSummary[];
    getWorkflowCockpit(taskId: string, tenantId?: string | null): WorkflowCockpitView;
    listApprovalQueue(limit?: number, tenantId?: string | null): ApprovalRecord[];
    getStabilityPanel(limit?: number, tenantId?: string | null): StabilityPanelView;
    getAdminTakeoverConsole(taskId: string, tenantId?: string | null): AdminTakeoverConsoleView;
    private listDivisionCatalog;
    private buildPerceptionBriefPreviews;
    private assertGlobalOnlyView;
}
