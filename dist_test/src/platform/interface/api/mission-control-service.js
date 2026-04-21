import { safeLoadDivisionRegistry } from "../../../domains/governance/safe-load-division-registry.js";
import { TaskBoardService } from "../../shared/observability/task-board-service.js";
import { TaskTimelineService } from "../../shared/observability/task-timeline-service.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { StorageError, TenantBoundaryError } from "../../contracts/errors.js";
const logger = new StructuredLogger({ retentionLimit: 100 });
export class MissionControlService {
    store;
    healthService;
    metricsService;
    inspectService;
    taskBoardService;
    timelineService;
    divisionRegistry;
    gatewayTargetDirectoryService;
    constructor(store, healthService, metricsService, inspectService, options = {}) {
        this.store = store;
        this.healthService = healthService;
        this.metricsService = metricsService;
        this.inspectService = inspectService;
        this.taskBoardService = new TaskBoardService(store);
        this.timelineService = new TaskTimelineService(inspectService);
        this.divisionRegistry = options.divisionRegistry ?? safeLoadDivisionRegistry();
        this.gatewayTargetDirectoryService = options.gatewayTargetDirectoryService ?? null;
    }
    getSnapshot(tenantId) {
        this.assertGlobalOnlyView("mission_control.snapshot_not_tenant_scoped", tenantId);
        const pendingApprovals = this.inspectService
            .queryDecisionInspectSummaries({
            decisionType: "approval",
            status: "requested",
            limit: 25,
        })
            .map((summary) => this.store.approval.getApproval(summary.decisionId))
            .filter((record) => record != null);
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
    getHealthReportAsync() {
        return this.healthService.getReportAsync();
    }
    /**
     * Retrieves task cockpit view with optional tenant filtering.
     * When tenantId is provided, ensures the task belongs to that tenant.
     */
    getTaskCockpit(taskId, tenantId) {
        return {
            snapshot: this.store.operations.loadTaskSnapshot(taskId, tenantId),
            inspect: this.inspectService.getTaskInspectView(taskId, tenantId),
            timeline: this.timelineService.buildTaskTimeline(taskId),
        };
    }
    listWorkflowCockpits(limit = 25, tenantId) {
        return this.inspectService.queryWorkflowInspectSummaries({
            limit,
            ...(tenantId !== undefined ? { tenantId } : {}),
        });
    }
    getWorkflowCockpit(taskId, tenantId) {
        let inspect;
        try {
            inspect = this.inspectService.getTaskInspectView(taskId, tenantId);
        }
        catch (error) {
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
    listApprovalQueue(limit = 25, tenantId) {
        return this.inspectService
            .queryDecisionInspectSummaries({
            decisionType: "approval",
            status: "requested",
            limit,
            ...(tenantId !== undefined ? { tenantId } : {}),
        })
            .map((summary) => this.store.approval.getApproval(summary.decisionId))
            .filter((record) => record != null);
    }
    getStabilityPanel(limit = 25, tenantId) {
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
    getAdminTakeoverConsole(taskId, tenantId) {
        this.assertGlobalOnlyView("mission_control.admin_console_not_tenant_scoped", tenantId);
        const inspect = this.inspectService.getTaskInspectView(taskId);
        const activeExecutionId = inspect.recoverySummary.activeExecutionId ?? inspect.execution?.id ?? null;
        const workers = this.inspectService.queryWorkerInspectSummaries({ limit: 200 });
        const lease = activeExecutionId == null
            ? null
            : this.store.worker.getActiveExecutionLease(activeExecutionId) ?? this.store.worker.getLatestExecutionLease(activeExecutionId);
        const activeWorkerId = lease?.workerId
            ?? inspect.dispatchDecisions.at(-1)?.selectedWorkerId
            ?? null;
        const activeWorker = activeWorkerId == null
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
    listDivisionCatalog() {
        if (this.divisionRegistry != null) {
            return [...this.divisionRegistry.divisions.values()]
                .map((division) => ({
                divisionId: division.id,
                name: division.name,
                source: "registry",
            }))
                .sort((left, right) => left.divisionId.localeCompare(right.divisionId));
        }
        const divisionIds = new Set(this.store
            .listTasks(200)
            .map((task) => task.divisionId)
            .filter((divisionId) => divisionId != null && divisionId.length > 0));
        return [...divisionIds]
            .sort((left, right) => left.localeCompare(right))
            .map((divisionId) => ({
            divisionId,
            name: divisionId,
            source: "tasks",
        }));
    }
    buildPerceptionBriefPreviews(briefs) {
        return briefs.map((brief) => ({
            briefId: brief.briefId,
            generatedAt: brief.generatedAt,
            itemIds: parseJsonStringArray(brief.itemIdsJson),
            summary: brief.overallSummary,
            proposalCount: this.store.intelligence.listActionProposalsByBrief(brief.briefId).length,
        }));
    }
    assertGlobalOnlyView(code, tenantId) {
        if (tenantId == null) {
            return;
        }
        throw new TenantBoundaryError(code, code, {
            retryable: false,
            details: { tenantId },
        });
    }
}
function isActiveTaskSummary(summary) {
    return summary.taskStatus === "in_progress" || summary.taskStatus === "pending";
}
function isQueuedTaskSummary(summary) {
    return summary.taskStatus === "queued" || summary.taskStatus === "pending";
}
function isBlockedTaskSummary(summary) {
    return summary.taskStatus === "awaiting_decision" || summary.workflowStatus === "paused" || summary.pendingApprovalCount > 0;
}
function parseJsonStringArray(value) {
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
    }
    catch (err) {
        logger.warn("parseJsonStringArray failed", { error: err });
        return [];
    }
}
//# sourceMappingURL=mission-control-service.js.map