import { ValidationError } from "../../contracts/errors.js";
import { nowIso } from "../../contracts/types/ids.js";
export class OperatorConsoleBackendService {
    sources;
    constructor(sources = {}) {
        this.sources = sources;
    }
    buildSnapshot(operator) {
        assertOperator(operator);
        const taskBoard = this.filterByOperatorScope(this.sources.listTasks?.() ?? [], operator);
        const approvalQueue = this.filterByOperatorScope(this.sources.listPendingApprovals?.() ?? [], operator);
        const workerPanel = this.sources.listWorkers?.() ?? [];
        const tenantPanel = (this.sources.listTenants?.() ?? []).filter((tenant) => operator.tenantId == null || tenant.tenantId === operator.tenantId);
        const incidentTimeline = this.filterByOperatorScope(this.sources.listIncidents?.() ?? [], operator)
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
            .slice(0, 50);
        return {
            generatedAt: nowIso(),
            operator,
            moduleCoverage: buildModuleCoverage({
                taskBoard,
                approvalQueue,
                workerPanel,
                tenantPanel,
                incidentTimeline,
            }),
            taskBoard,
            approvalQueue,
            workerPanel,
            tenantPanel,
            incidentTimeline,
            findings: buildFindings({ taskBoard, approvalQueue, workerPanel, incidentTimeline }),
        };
    }
    planHumanTakeoverAction(input) {
        assertOperator(input.operator);
        if (input.taskId.trim().length === 0) {
            throw new ValidationError("console.task_id_required", "Operator action requires a task id.");
        }
        if (input.reasonCode.trim().length === 0) {
            throw new ValidationError("console.reason_required", "Operator action requires a reason code.");
        }
        const requiresBreakGlass = BREAK_GLASS_ACTIONS.has(input.actionType) && !input.operator.roles.includes("break_glass");
        const requiresPolicyEvaluation = HIGH_RISK_ACTIONS.has(input.actionType) || requiresBreakGlass;
        return {
            actionId: input.actionId,
            actionType: input.actionType,
            taskId: input.taskId,
            tenantId: input.tenantId ?? null,
            workspaceId: input.workspaceId ?? null,
            operatorId: input.operator.operatorId,
            requiresPolicyEvaluation,
            requiresBreakGlass,
            auditPayload: {
                actionType: input.actionType,
                reasonCode: input.reasonCode,
                beforeStateRef: input.beforeStateRef ?? null,
                afterStateRef: input.afterStateRef ?? null,
            },
        };
    }
    filterByOperatorScope(items, operator) {
        return operator.tenantId == null ? items : items.filter((item) => item.tenantId === operator.tenantId);
    }
}
const HIGH_RISK_ACTIONS = new Set([
    "switch_worker",
    "attach_artifact",
    "advance_rollout",
    "rollback_rollout",
    "finish_task",
]);
const BREAK_GLASS_ACTIONS = new Set([
    "skip_step",
    "switch_worker",
    "finish_task",
    "rollback_rollout",
]);
const MODULE_IDS = [
    "worker_management",
    "queue_management",
    "tenant_management",
    "approval_management",
    "audit_search",
    "feature_flag_management",
    "incident_timeline",
    "oapeflir_loop_management",
    "rollout_management",
    "feedback_learning_management",
];
function buildModuleCoverage(input) {
    return MODULE_IDS.map((moduleId) => {
        const hasData = (moduleId === "worker_management" && input.workerPanel.length > 0)
            || (moduleId === "queue_management" && input.workerPanel.some((worker) => worker.queueDepth > 0))
            || (moduleId === "tenant_management" && input.tenantPanel.length > 0)
            || (moduleId === "approval_management" && input.approvalQueue.length > 0)
            || (moduleId === "incident_timeline" && input.incidentTimeline.length > 0)
            || (moduleId === "oapeflir_loop_management" && input.taskBoard.length > 0);
        return { moduleId, status: hasData ? "available" : "empty" };
    });
}
function buildFindings(input) {
    const findings = [];
    if (input.approvalQueue.some((approval) => approval.riskLevel === "critical")) {
        findings.push("critical approval waiting for operator decision");
    }
    if (input.workerPanel.some((worker) => worker.status === "offline" && worker.activeExecutionCount > 0)) {
        findings.push("offline worker still owns active executions");
    }
    if (input.incidentTimeline.some((incident) => incident.severity === "critical")) {
        findings.push("critical incident requires takeover review");
    }
    if (input.taskBoard.some((task) => task.status === "blocked")) {
        findings.push("blocked tasks exist in operator scope");
    }
    return findings;
}
function assertOperator(operator) {
    if (operator.operatorId.trim().length === 0) {
        throw new ValidationError("console.operator_id_required", "Operator id is required.");
    }
}
//# sourceMappingURL=index.js.map