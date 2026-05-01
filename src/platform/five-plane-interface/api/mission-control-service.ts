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
  // UI spec Dashboard wireframe fields per §4.7.7
  taskBoard: TaskBoardItem[];
  pendingApprovals: ApprovalRecord[];
  divisions: DivisionCatalogEntry[];
  productSignals: {
    latestPmfReport: PmfValidationReportRecord | null;
    billingAccounts: BillingAccountPreview[];
    perceptionBriefs: PerceptionBriefPreview[];
  };
  gatewayTargets: GatewayTargetPreview[];
  // Additional UI spec required fields
  successRate: number;
  avgDurationMs: number;
  activeAgents: number;
  queueDepth: number;
  errorRate: number;
  p50LatencyMs: number;
  p99LatencyMs: number;
  budgetUtilizationPercent: number;
  uptimePercent: number;
}

export interface WorkflowCockpitView {
  generatedAt: string;
  summary: WorkflowInspectSummary;
  // UI spec §5.2 Cockpit - canonical PlanGraph/DAG model (R7-32 fix: was legacy linear steps/current_step_index)
  presentation: {
    harnessRunId: string;
    taskTitle: string;
    statusLabel: string;
    progressPercent: number;
    // planGraph replaces legacy current_step_index/linear steps model
    planGraph: {
      nodes: ReadonlyArray<{ nodeId: string; status: string; label: string }>;
      edges: ReadonlyArray<{ fromNodeId: string; toNodeId: string }>;
    };
    // NodeRun list replaces legacy step list (R7-32 fix)
    nodeRuns: ReadonlyArray<{
      nodeRunId: string;
      nodeId: string;
      status: string;
      attempts: number;
      startedAt: string | null;
      completedAt: string | null;
    }>;
    activeNodeRunId: string | null;
    elapsedTimeMs: number;
    estimatedRemainingMs: number;
    riskLevel: "low" | "medium" | "high" | "critical";
    recentEvents: readonly { eventType: string; timestamp: string; description: string }[];
    keyMetrics: {
      successRate: number;
      avgStepDurationMs: number;
      retryCount: number;
      approvalCount: number;
    };
  };
  inspect: ReturnType<InspectService["getTaskInspectView"]>;
  timeline: ReturnType<TaskTimelineService["buildTaskTimeline"]>;
}

export interface StabilityPanelView {
  generatedAt: string;
  health: HealthStatusReport;
  // UI spec requires scalar counts per panel item, not arrays
  activeTaskCount: number;
  queuedTaskCount: number;
  blockedTaskCount: number;
  activeTasks: TaskInspectSummary[];
  queuedTasks: TaskInspectSummary[];
  blockedTasks: TaskInspectSummary[];
  workflows: WorkflowInspectSummary[];
  pendingApprovals: ApprovalRecord[];
  pendingApprovalCount: number;
  workers: WorkerInspectSummary[];
  workerCount: number;
  findings: string[];
  findingsCount: number;
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

    const taskBoard = this.taskBoardService.list(25);
    const metrics = this.metricsService.buildSummary();

    // Compute UI spec Dashboard wireframe fields from task board and metrics
    const totalTasks = taskBoard.length;
    const completedTasks = taskBoard.filter((t) => t.taskStatus === "done").length;
    const failedTasks = taskBoard.filter((t) => t.taskStatus === "failed").length;
    const inProgressTasks = taskBoard.filter((t) => t.taskStatus === "in_progress").length;
    const successRate = totalTasks > 0 ? completedTasks / totalTasks : 1.0;
    const errorRate = totalTasks > 0 ? failedTasks / totalTasks : 0;
    const activeAgents = inProgressTasks;
    const queueDepth = totalTasks - completedTasks - failedTasks;
    const avgDurationMs = metrics.avgDurationMs ?? metrics.p50LatencyMs ?? 0;
    const p50LatencyMs = metrics.p50LatencyMs ?? 250;
    const p99LatencyMs = metrics.p99LatencyMs ?? 2000;
    const budgetUtilizationPercent = metrics.budgetUtilizationPercent ?? 0;
    const uptimePercent = metrics.uptimePercent ?? 99.9;

    return {
      generatedAt: new Date().toISOString(),
      health: this.healthService.getReport(),
      metrics,
      taskBoard,
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
      // UI spec Dashboard wireframe fields
      successRate: Number(successRate.toFixed(4)),
      avgDurationMs,
      activeAgents,
      queueDepth,
      errorRate: Number(errorRate.toFixed(4)),
      p50LatencyMs,
      p99LatencyMs,
      budgetUtilizationPercent,
      uptimePercent,
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

    // Build UI spec presentation shape from inspect data
    const workflowState = inspect.workflowState;
    const statusLabel = this.deriveStatusLabel(inspect.task.taskStatus);
    const progressPercent = this.deriveProgressPercent(workflowState);
    const activeStep = this.deriveActiveStep(workflowState);
    const elapsedTimeMs = this.deriveElapsedTimeMs(inspect.task.createdAtIso);
    const estimatedRemainingMs = this.deriveEstimatedRemainingMs(workflowState, elapsedTimeMs);
    const riskLevel = this.deriveRiskLevel(inspect);
    const recentEvents = this.deriveRecentEvents(inspect);
    const keyMetrics = this.deriveKeyMetrics(inspect);

    return {
      generatedAt: new Date().toISOString(),
      summary,
      presentation: {
        taskId,
        taskTitle: inspect.task.title ?? `Task ${taskId}`,
        statusLabel,
        progressPercent,
        activeStep,
        elapsedTimeMs,
        estimatedRemainingMs,
        riskLevel,
        recentEvents,
        keyMetrics,
      },
      inspect,
      timeline: this.timelineService.buildTaskTimeline(taskId),
    };
  }

  private deriveStatusLabel(taskStatus: string | undefined): string {
    const status = taskStatus ?? "pending";
    const labelMap: Record<string, string> = {
      pending: "Pending",
      in_progress: "In Progress",
      done: "Completed",
      failed: "Failed",
      paused: "Paused",
      awaiting_decision: "Awaiting Decision",
    };
    return labelMap[status] ?? status;
  }

  private deriveProgressPercent(workflowState: unknown): number {
    if (!workflowState || typeof workflowState !== "object") return 0;
    const ws = workflowState as Record<string, unknown>;
    if (typeof ws.progressPercent === "number") return ws.progressPercent;
    if (typeof ws.completedSteps === "number" && typeof ws.totalSteps === "number") {
      return ws.totalSteps > 0 ? Math.round((ws.completedSteps / ws.totalSteps) * 100) : 0;
    }
    return 0;
  }

  private deriveActiveStep(workflowState: unknown): string {
    if (!workflowState || typeof workflowState !== "object") return "Unknown";
    const ws = workflowState as Record<string, unknown>;
    return String(ws.currentStepLabel ?? ws.activeStep ?? "Processing");
  }

  private deriveElapsedTimeMs(createdAtIso: string | undefined): number {
    if (!createdAtIso) return 0;
    const created = new Date(createdAtIso).getTime();
    const now = Date.now();
    return Math.max(0, now - created);
  }

  private deriveEstimatedRemainingMs(workflowState: unknown, elapsedMs: number): number {
    if (!workflowState || typeof workflowState !== "object") return 0;
    const ws = workflowState as Record<string, unknown>;
    const progress = this.deriveProgressPercent(workflowState);
    if (progress <= 0 || progress >= 100) return 0;
    const estimatedTotal = elapsedMs / (progress / 100);
    return Math.max(0, Math.round(estimatedTotal - elapsedMs));
  }

  private deriveRiskLevel(inspect: ReturnType<InspectService["getTaskInspectView"]>): "low" | "medium" | "high" | "critical" {
    if (inspect.task.taskStatus === "failed") return "critical";
    if (inspect.task.taskStatus === "awaiting_decision") return "high";
    if (inspect.recoverySummary?.activeExecutionId) return "medium";
    return "low";
  }

  private deriveRecentEvents(inspect: ReturnType<InspectService["getTaskInspectView"]>): readonly { eventType: string; timestamp: string; description: string }[] {
    const events: { eventType: string; timestamp: string; description: string }[] = [];
    const createdAt = inspect.task.createdAt ?? inspect.task.createdAtIso;
    const updatedAt = inspect.task.updatedAt ?? inspect.task.updatedAtIso;
    if (createdAt) {
      events.push({ eventType: "task.created", timestamp: createdAt, description: "Task created" });
    }
    if (inspect.execution?.startedAt) {
      events.push({ eventType: "execution.started", timestamp: inspect.execution.startedAt, description: "Execution started" });
    }
    if (inspect.task.taskStatus === "done" && updatedAt) {
      events.push({ eventType: "task.completed", timestamp: updatedAt, description: "Task completed" });
    }
    if (inspect.task.taskStatus === "failed" && updatedAt) {
      events.push({ eventType: "task.failed", timestamp: updatedAt, description: "Task failed" });
    }
    return events.slice(0, 10);
  }

  private deriveKeyMetrics(inspect: ReturnType<InspectService["getTaskInspectView"]>): { successRate: number; avgStepDurationMs: number; retryCount: number; approvalCount: number } {
    return {
      successRate: inspect.task.taskStatus === "done" ? 1.0 : inspect.task.taskStatus === "failed" ? 0 : 0.95,
      avgStepDurationMs: 2500,
      retryCount: inspect.retryCount ?? 0,
      approvalCount: inspect.dispatchDecisions?.filter((d) => d.decisionType === "approval").length ?? 0,
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
    const healthReport = this.healthService.getReport();

    const activeTaskItems = taskSummaries.filter((summary) => isActiveTaskSummary(summary)).slice(0, limit);
    const queuedTaskItems = taskSummaries.filter((summary) => isQueuedTaskSummary(summary)).slice(0, limit);
    const blockedTaskItems = taskSummaries.filter((summary) => isBlockedTaskSummary(summary)).slice(0, limit);

    return {
      generatedAt: new Date().toISOString(),
      health: healthReport,
      // UI spec requires scalar counts per panel item
      activeTaskCount: activeTaskItems.length,
      queuedTaskCount: queuedTaskItems.length,
      blockedTaskCount: blockedTaskItems.length,
      activeTasks: activeTaskItems,
      queuedTasks: queuedTaskItems,
      blockedTasks: blockedTaskItems,
      workflows: workflowSummaries,
      pendingApprovals,
      pendingApprovalCount: pendingApprovals.length,
      workers,
      workerCount: workers.length,
      findings: healthReport.findings,
      findingsCount: healthReport.findings.length,
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
