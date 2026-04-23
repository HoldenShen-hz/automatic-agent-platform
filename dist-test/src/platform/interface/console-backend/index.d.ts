export type ConsoleModuleId = "worker_management" | "queue_management" | "tenant_management" | "approval_management" | "audit_search" | "feature_flag_management" | "incident_timeline" | "oapeflir_loop_management" | "rollout_management" | "feedback_learning_management";
export type OperatorControlActionType = "take_over_task" | "modify_next_input" | "skip_step" | "retry_step" | "switch_model" | "switch_worker" | "attach_artifact" | "inject_feedback" | "create_improvement_candidate" | "advance_rollout" | "rollback_rollout" | "finish_task";
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
    listTenants?: () => Array<{
        tenantId: string;
        organizationId: string;
        isolationMode: string;
    }>;
}
export interface OperatorConsoleSnapshot {
    generatedAt: string;
    operator: OperatorIdentity;
    moduleCoverage: Array<{
        moduleId: ConsoleModuleId;
        status: "available" | "empty";
    }>;
    taskBoard: ConsoleTaskSummary[];
    approvalQueue: ConsoleApprovalSummary[];
    workerPanel: ConsoleWorkerSummary[];
    tenantPanel: Array<{
        tenantId: string;
        organizationId: string;
        isolationMode: string;
    }>;
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
export declare class OperatorConsoleBackendService {
    private readonly sources;
    constructor(sources?: ConsoleDataSources);
    buildSnapshot(operator: OperatorIdentity): OperatorConsoleSnapshot;
    planHumanTakeoverAction(input: {
        actionId: string;
        actionType: OperatorControlActionType;
        taskId: string;
        tenantId?: string | null;
        workspaceId?: string | null;
        operator: OperatorIdentity;
        reasonCode: string;
        beforeStateRef?: string | null;
        afterStateRef?: string | null;
    }): OperatorActionPlan;
    private filterByOperatorScope;
}
