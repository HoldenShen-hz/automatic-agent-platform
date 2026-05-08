import type { DivisionRegistry } from "../../../domains/governance/division-loader.js";
import { safeLoadDivisionRegistry } from "../../../domains/governance/safe-load-division-registry.js";
import { GatewayTargetDirectoryService } from "../channel-gateway/gateway-target-directory-service.js";
import type { HealthStatusReport } from "../../shared/observability/health-service.js";
import { HealthService } from "../../shared/observability/health-service.js";
import {
  InspectService,
  type TaskInspectSummary,
  type WorkflowInspectSummary,
  type WorkerInspectSummary,
} from "../../shared/observability/inspect-service.js";
import { MetricsService, type RuntimeMetricsSummary } from "../../shared/observability/metrics-service.js";
import { TaskBoardService } from "../../shared/observability/task-board-service.js";
import { TaskTimelineService } from "../../shared/observability/task-timeline-service.js";
import { AuthoritativeTaskStore, type TaskBoardItem } from "../../state-evidence/truth/authoritative-task-store.js";
import type {
  ApprovalRecord,
  BillingAccountRecord,
  ExecutionLeaseRecord,
  IntelBriefRecord,
  PmfValidationReportRecord,
} from "../../contracts/types/domain.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { StorageError, TenantBoundaryError } from "../../contracts/errors.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

export interface DivisionCatalogEntry {
  divisionId: string;
  name: string;
  description: string;
  defaultWorkflowId: string | null;
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

export class MissionControlService {
  private readonly taskBoardService: TaskBoardService;
  private readonly timelineService: TaskTimelineService;
  private readonly divisionRegistry: DivisionRegistry | null;
  private readonly gatewayTargetDirectoryService: GatewayTargetDirectoryService | null;

  public constructor(
    private readonly store: AuthoritativeTaskStore,
    private readonly healthService: HealthService,
    private readonly metricsService: MetricsService,
    private readonly inspectService: InspectService,
    options: MissionControlServiceOptions = {},
  ) {
    this.taskBoardService = new TaskBoardService(store);
    this.timelineService = new TaskTimelineService(inspectService);
    this.divisionRegistry = options.divisionRegistry ?? safeLoadDivisionRegistry();
    this.gatewayTargetDirectoryService = options.gatewayTargetDirectoryService ?? null;
  }

  public getSnapshot(tenantId?: string | null): MissionControlSnapshot {
    this.assertGlobalOnlyView("mission_control.snapshot_not_tenant_scoped", tenantId);
    const pendingApprovals = this.inspectService
      .queryDecisionInspectSummaries({
        decisionType: "approval",
        status: "requested",
        limit: 25,
      })
      .map((summary) => this.store.approval.getApproval(summary.decisionId))
      .filter((record): record is ApprovalRecord => record != null);

    return {
      generatedAt: new Date().toISOString(),
      health: this.healthService.getReport(),
      metrics: this.metricsService.buildSummary(),
      taskBoard: this.taskBoardService.list(25),
      pendingApprovals,
      divisions: this.listDivisionCatalog(),
      productSignals: {
        latestPmfReport: this.store.operations.getLatestPmfValidationReport(),
        billingAccounts: this.store.billing.listBillingAccounts(10).map((account) => ({
          accountId: account.accountId,
          ownerId: account.ownerId,
          workspaceId: account.workspaceId,
          planId: account.planId,
          status: account.status,
          updatedAt: account.updatedAt,
        })),
        perceptionBriefs: this.buildPerceptionBriefPreviews(this.store.intelligence.listIntelBriefs(10)),
      },
      gatewayTargets: this.gatewayTargetDirectoryService == null
        ? []
        : this.gatewayTargetDirectoryService.listTargets({ limit: 10 }).map((entry) => ({
            targetId: entry.targetId,
            channel: entry.channel,
            displayName: entry.displayName,
            source: entry.source,
            lastSeenAt: entry.lastSeenAt,
          })),
    };
  }

  public getHealthReportAsync(): Promise<HealthStatusReport> {
    return this.healthService.getReportAsync();
  }

  /**
   * Retrieves task cockpit view with optional tenant filtering.
   * When tenantId is provided, ensures the task belongs to that tenant.
   */
  public getTaskCockpit(taskId: string, tenantId?: string | null) {
    return {
      snapshot: this.store.operations.loadTaskSnapshot(taskId, tenantId),
      inspect: this.inspectService.getTaskInspectView(taskId, tenantId),
      timeline: this.timelineService.buildTaskTimeline(taskId),
    };
  }

  public listWorkflowCockpits(limit: number = 25, tenantId?: string | null): WorkflowInspectSummary[] {
    return this.inspectService.queryWorkflowInspectSummaries({
      limit,
      ...(tenantId !== undefined ? { tenantId } : {}),
    });
  }

  public getWorkflowCockpit(taskId: string, tenantId?: string | null): WorkflowCockpitView {
    let inspect;
    try {
      inspect = this.inspectService.getTaskInspectView(taskId, tenantId);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Task not found:")) {
        throw new StorageError("workflow.not_found", "workflow.not_found", {
          statusCode: 404,
          retryable: false,
          details: { taskId, tenantId: tenantId ?? null },
        });
      }
      throw error;
    }
    if (inspect.workflowState == null) {
      throw new StorageError("workflow.not_found", "workflow.not_found", {
        statusCode: 404,
        retryable: false,
        details: { taskId, tenantId: tenantId ?? null },
      });
    }

    const summary = this.inspectService
      .queryWorkflowInspectSummaries({
        limit: 200,
        ...(tenantId !== undefined ? { tenantId } : {}),
      })
      .find((item) => item.taskId === taskId);
    if (!summary) {
      throw new StorageError("workflow.not_found", "workflow.not_found", {
        statusCode: 404,
        retryable: false,
        details: { taskId, tenantId: tenantId ?? null },
      });
    }

    return {
      generatedAt: new Date().toISOString(),
      summary,
      inspect,
      timeline: this.timelineService.buildTaskTimeline(taskId),
    };
  }

  public listApprovalQueue(limit: number = 25, tenantId?: string | null): ApprovalRecord[] {
    return this.inspectService
      .queryDecisionInspectSummaries({
        decisionType: "approval",
        status: "requested",
        limit,
        ...(tenantId !== undefined ? { tenantId } : {}),
      })
      .map((summary) => this.store.approval.getApproval(summary.decisionId))
      .filter((record): record is ApprovalRecord => record != null);
  }

  public getStabilityPanel(limit: number = 25, tenantId?: string | null): StabilityPanelView {
    this.assertGlobalOnlyView("mission_control.stability_not_tenant_scoped", tenantId);
    const taskSummaries = this.inspectService.queryTaskInspectSummaries({ limit: Math.max(limit, 50) });
    const workflowSummaries = this.inspectService.queryWorkflowInspectSummaries({ limit });
    const workers = this.inspectService.queryWorkerInspectSummaries({ limit });
    const pendingApprovals = this.listApprovalQueue(limit);

    return {
      generatedAt: new Date().toISOString(),
      health: this.healthService.getReport(),
      activeTasks: taskSummaries.filter((summary) => isActiveTaskSummary(summary)).slice(0, limit),
      queuedTasks: taskSummaries.filter((summary) => isQueuedTaskSummary(summary)).slice(0, limit),
      blockedTasks: taskSummaries.filter((summary) => isBlockedTaskSummary(summary)).slice(0, limit),
      workflows: workflowSummaries,
      pendingApprovals,
      workers,
      findings: this.healthService.getReport().findings,
    };
  }

  public getAdminTakeoverConsole(taskId: string, tenantId?: string | null): AdminTakeoverConsoleView {
    this.assertGlobalOnlyView("mission_control.admin_console_not_tenant_scoped", tenantId);
    const inspect = this.inspectService.getTaskInspectView(taskId);
    const activeExecutionId = inspect.recoverySummary.activeExecutionId ?? inspect.execution?.id ?? null;
    const workers = this.inspectService.queryWorkerInspectSummaries({ limit: 200 });
    const lease =
      activeExecutionId == null
        ? null
        : this.store.worker.getActiveExecutionLease(activeExecutionId) ?? this.store.worker.getLatestExecutionLease(activeExecutionId);
    const activeWorkerId =
      lease?.workerId
      ?? inspect.dispatchDecisions.at(-1)?.selectedWorkerId
      ?? null;
    const activeWorker =
      activeWorkerId == null
        ? workers.length === 1 ? workers[0] ?? null : null
        : workers.find((worker) => worker.workerId === activeWorkerId) ?? null;

    return {
      generatedAt: new Date().toISOString(),
      scope: {
        taskId,
        divisionId: inspect.task.divisionId ?? null,
        workspaceId: null,
        tenantId: inspect.task.tenantId ?? null,
      },
      executionOwner: {
        executionId: activeExecutionId,
        agentId: inspect.execution?.agentId ?? null,
        workerId: activeWorkerId,
        leaseId: lease?.id ?? null,
        leaseStatus: lease?.status ?? null,
      },
      activeWorker,
      versions: {
        modelVersion: null,
        promptVersion: null,
        policyVersion: null,
      },
      latestPmfVerdict: this.store.operations.getLatestPmfValidationReport()?.verdict ?? null,
      billingAccounts: this.store.billing.listBillingAccounts(10).map((account) => ({
        accountId: account.accountId,
        ownerId: account.ownerId,
        workspaceId: account.workspaceId,
        planId: account.planId,
        status: account.status,
        updatedAt: account.updatedAt,
      })),
      inspect,
      timeline: this.timelineService.buildTaskTimeline(taskId),
    };
  }

  private listDivisionCatalog(): DivisionCatalogEntry[] {
    if (this.divisionRegistry != null) {
      return [...this.divisionRegistry.divisions.values()]
        .map((division) => ({
          divisionId: division.id,
          name: division.name,
          description: division.description,
          defaultWorkflowId: division.defaultWorkflowId,
          source: "registry" as const,
        }))
        .sort((left, right) => left.divisionId.localeCompare(right.divisionId));
    }

    const divisionIds = new Set(
      this.store
        .listTasks(200)
        .map((task) => task.divisionId)
        .filter((divisionId): divisionId is string => divisionId != null && divisionId.length > 0),
    );

    return [...divisionIds]
      .sort((left, right) => left.localeCompare(right))
      .map((divisionId) => ({
        divisionId,
        name: divisionId,
        description: "",
        defaultWorkflowId: null,
        source: "tasks" as const,
      }));
  }

  private buildPerceptionBriefPreviews(briefs: IntelBriefRecord[]): PerceptionBriefPreview[] {
    return briefs.map((brief) => ({
      briefId: brief.briefId,
      generatedAt: brief.generatedAt,
      itemIds: parseJsonStringArray(brief.itemIdsJson),
      summary: brief.overallSummary,
      proposalCount: this.store.intelligence.listActionProposalsByBrief(brief.briefId).length,
    }));
  }

  private assertGlobalOnlyView(code: string, tenantId?: string | null): void {
    if (tenantId == null) {
      return;
    }
    throw new TenantBoundaryError(code, code, {
      retryable: false,
      details: { tenantId },
    });
  }
}

function isActiveTaskSummary(summary: TaskInspectSummary): boolean {
  return summary.taskStatus === "in_progress" || summary.taskStatus === "pending";
}

function isQueuedTaskSummary(summary: TaskInspectSummary): boolean {
  return summary.taskStatus === "queued" || summary.taskStatus === "pending";
}

function isBlockedTaskSummary(summary: TaskInspectSummary): boolean {
  return summary.taskStatus === "awaiting_decision" || summary.workflowStatus === "paused" || summary.pendingApprovalCount > 0;
}

function parseJsonStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch (err) {
    logger.warn("parseJsonStringArray failed", { error: err });
    return [];
  }
}
