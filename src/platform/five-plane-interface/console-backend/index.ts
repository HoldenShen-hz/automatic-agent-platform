import { ValidationError } from "../../contracts/errors.js";
import { nowIso } from "../../contracts/types/ids.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const securityLogger = new StructuredLogger({ retentionLimit: 1000, service: "console-backend-security" });

/**
 * Roles that are explicitly authorized for cross-tenant system operations.
 * These roles may use null tenantId only for designated system-level operations.
 */
const SYSTEM_ROLES = new Set(["platform_admin", "system_service", "audit_service"]);

/**
 * Determines if an operator with a null tenantId is authorized for cross-tenant access.
 * Returns true only for operators with explicit system roles.
 */
function isAuthorizedForCrossTenantAccess(operator: OperatorIdentity): boolean {
  return operator.roles.some((role) => SYSTEM_ROLES.has(role));
}

/**
 * Logs a security event when null tenantId access is attempted.
 */
function logSecurityEvent(
  eventType: string,
  operator: OperatorIdentity,
  details: Record<string, unknown>,
): void {
  securityLogger.warn(`SECURITY EVENT: ${eventType}`, {
    crosscuttingFabric: "security",
    tenantId: operator.tenantId ?? "NULL_WILDCARD_ATTEMPT",
    operatorId: operator.operatorId,
    operatorRoles: operator.roles,
    ...details,
  });
}

export type ConsoleModuleId =
  | "worker_management"
  | "queue_management"
  | "tenant_management"
  | "approval_management"
  | "audit_search"
  | "feature_flag_management"
  | "incident_timeline"
  | "oapeflir_loop_management"
  | "rollout_management"
  | "feedback_learning_management";

export type OperatorControlActionType =
  | "take_over_task"
  | "modify_next_input"
  | "skip_step"
  | "retry_step"
  | "switch_model"
  | "switch_worker"
  | "attach_artifact"
  | "inject_feedback"
  | "create_improvement_candidate"
  | "advance_rollout"
  | "rollback_rollout"
  | "finish_task";

export interface OperatorIdentity {
  operatorId: string;
  roles: string[];
  tenantId?: string | null;
  workspaceId?: string | null;
}

export interface ConsoleTaskSummary {
  taskId: string;
  tenantId: string | null;
  workspaceId: string | null;
  status: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  updatedAt: string;
}

export interface ConsoleApprovalSummary {
  approvalId: string;
  taskId: string;
  tenantId: string | null;
  riskLevel: "low" | "medium" | "high" | "critical";
  reason: string;
  createdAt: string;
}

export interface ConsoleWorkerSummary {
  workerId: string;
  status: "online" | "draining" | "offline" | "unknown";
  activeExecutionCount: number;
  queueDepth: number;
}

export interface ConsoleIncidentSummary {
  incidentId: string;
  taskId: string | null;
  tenantId: string | null;
  severity: "info" | "warning" | "critical";
  summary: string;
  createdAt: string;
}

export interface ConsoleDataSources {
  listTasks?: () => ConsoleTaskSummary[];
  listPendingApprovals?: () => ConsoleApprovalSummary[];
  listWorkers?: () => ConsoleWorkerSummary[];
  listIncidents?: () => ConsoleIncidentSummary[];
  listTenants?: () => Array<{ tenantId: string; organizationId: string; isolationMode: string }>;
}

export interface OperatorConsoleSnapshot {
  generatedAt: string;
  operator: OperatorIdentity;
  moduleCoverage: Array<{ moduleId: ConsoleModuleId; status: "available" | "empty" }>;
  taskBoard: ConsoleTaskSummary[];
  approvalQueue: ConsoleApprovalSummary[];
  workerPanel: ConsoleWorkerSummary[];
  tenantPanel: Array<{ tenantId: string; organizationId: string; isolationMode: string }>;
  incidentTimeline: ConsoleIncidentSummary[];
  findings: string[];
}

export interface OperatorActionPlan {
  actionId: string;
  actionType: OperatorControlActionType;
  taskId: string;
  tenantId: string | null;
  workspaceId: string | null;
  operatorId: string;
  requiresPolicyEvaluation: boolean;
  requiresBreakGlass: boolean;
  auditPayload: Record<string, unknown>;
}

export class OperatorConsoleBackendService {
  public constructor(private readonly sources: ConsoleDataSources = {}) {}

  public buildSnapshot(operator: OperatorIdentity): OperatorConsoleSnapshot {
    assertOperator(operator);
    const taskBoard = this.filterByOperatorScope(this.sources.listTasks?.() ?? [], operator);
    const approvalQueue = this.filterByOperatorScope(this.sources.listPendingApprovals?.() ?? [], operator);
    const workerPanel = this.sources.listWorkers?.() ?? [];
    const tenantPanel = (this.sources.listTenants?.() ?? []).filter((tenant) => {
      // R13-31 FIX: Reject null tenantId unless operator has explicit system role for cross-tenant access
      if (operator.tenantId == null) {
        if (isAuthorizedForCrossTenantAccess(operator)) {
          logSecurityEvent("CROSS_TENANT_ACCESS_GRANTED", operator, {
            action: "buildSnapshot_tenantPanel",
          });
          return true;
        }
        logSecurityEvent("NULL_TENANT_ID_ACCESS_DENIED", operator, {
          action: "buildSnapshot_tenantPanel",
        });
        return false;
      }
      return tenant.tenantId === operator.tenantId;
    });
    // R14-23: Priority sorting - critical incidents first, then warning, then info, then by createdAt descending
    const severityPriority: Record<ConsoleIncidentSummary["severity"], number> = {
      critical: 0,
      warning: 1,
      info: 2,
    };
    const incidentTimeline = this.filterByOperatorScope(this.sources.listIncidents?.() ?? [], operator)
      .sort((left, right) => {
        const severityDiff = severityPriority[left.severity] - severityPriority[right.severity];
        if (severityDiff !== 0) return severityDiff;
        return right.createdAt.localeCompare(left.createdAt);
      })
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

  public planHumanTakeoverAction(input: {
    actionId: string;
    actionType: OperatorControlActionType;
    taskId: string;
    tenantId?: string | null;
    workspaceId?: string | null;
    operator: OperatorIdentity;
    reasonCode: string;
    beforeStateRef?: string | null;
    afterStateRef?: string | null;
  }): OperatorActionPlan {
    assertOperator(input.operator);
    if (input.taskId.trim().length === 0) {
      throw new ValidationError("console.task_id_required", "Operator action requires a task id.");
    }
    if (input.reasonCode.trim().length === 0) {
      throw new ValidationError("console.reason_required", "Operator action requires a reason code.");
    }
    const requiresBreakGlass = BREAK_GLASS_ACTIONS.has(input.actionType) && !input.operator.roles.includes("break_glass");
    const requiresPolicyEvaluation = HIGH_RISK_ACTIONS.has(input.actionType) || requiresBreakGlass;

    // R13-31 FIX: Deny null tenantId in action plans unless operator has explicit system role
    const effectiveTenantId = input.tenantId ?? input.operator.tenantId ?? null;
    if (effectiveTenantId == null && !isAuthorizedForCrossTenantAccess(input.operator)) {
      logSecurityEvent("NULL_TENANT_ID_ACTION_DENIED", input.operator, {
        actionType: input.actionType,
        taskId: input.taskId,
      });
      throw new ValidationError(
        "console.tenant_id_required",
        "Operator action requires a valid tenantId. Null tenantId is not permitted without system role.",
      );
    }

    return {
      actionId: input.actionId,
      actionType: input.actionType,
      taskId: input.taskId,
      tenantId: effectiveTenantId,
      workspaceId: input.workspaceId ?? input.operator.workspaceId ?? null,
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

  private filterByOperatorScope<T extends { tenantId: string | null }>(items: T[], operator: OperatorIdentity): T[] {
    // R13-31 FIX: Reject null tenantId unless operator has explicit system role for cross-tenant access
    if (operator.tenantId == null) {
      if (isAuthorizedForCrossTenantAccess(operator)) {
        logSecurityEvent("CROSS_TENANT_ACCESS_GRANTED", operator, {
          action: "filterByOperatorScope",
          itemCount: items.length,
        });
        return items;
      }
      logSecurityEvent("NULL_TENANT_ID_ACCESS_DENIED", operator, {
        action: "filterByOperatorScope",
        itemCount: items.length,
      });
      return [];
    }
    return items.filter((item) => item.tenantId === operator.tenantId);
  }
}

const HIGH_RISK_ACTIONS = new Set<OperatorControlActionType>([
  "skip_step",
  "switch_worker",
  "attach_artifact",
  "advance_rollout",
  "rollback_rollout",
  "finish_task",
]);

const BREAK_GLASS_ACTIONS = new Set<OperatorControlActionType>([
  "skip_step",
  "switch_worker",
  "finish_task",
  "rollback_rollout",
]);

const MODULE_IDS: ConsoleModuleId[] = [
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

function buildModuleCoverage(input: {
  taskBoard: ConsoleTaskSummary[];
  approvalQueue: ConsoleApprovalSummary[];
  workerPanel: ConsoleWorkerSummary[];
  tenantPanel: Array<{ tenantId: string; organizationId: string; isolationMode: string }>;
  incidentTimeline: ConsoleIncidentSummary[];
}): Array<{ moduleId: ConsoleModuleId; status: "available" | "empty" }> {
  return MODULE_IDS.map((moduleId) => {
    const hasData =
      (moduleId === "worker_management" && input.workerPanel.length > 0)
      || (moduleId === "queue_management" && input.workerPanel.some((worker) => worker.queueDepth > 0))
      || (moduleId === "tenant_management" && input.tenantPanel.length > 0)
      || (moduleId === "approval_management" && input.approvalQueue.length > 0)
      || (moduleId === "incident_timeline" && input.incidentTimeline.length > 0)
      || (moduleId === "oapeflir_loop_management" && input.taskBoard.length > 0);
    return { moduleId, status: hasData ? "available" : "empty" };
  });
}

function buildFindings(input: {
  taskBoard: ConsoleTaskSummary[];
  approvalQueue: ConsoleApprovalSummary[];
  workerPanel: ConsoleWorkerSummary[];
  incidentTimeline: ConsoleIncidentSummary[];
}): string[] {
  const findings: string[] = [];
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

function assertOperator(operator: OperatorIdentity): void {
  if (operator.operatorId.trim().length === 0) {
    throw new ValidationError("console.operator_id_required", "Operator id is required.");
  }
}
