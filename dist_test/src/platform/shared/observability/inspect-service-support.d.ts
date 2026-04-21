/**
 * Inspect Service
 *
 * Provides read-only views into task, execution, and approval state for debugging,
 * operator interfaces, and observability dashboards. Aggregates data from the
 * AuthoritativeTaskStore and RuntimeRecoveryService.
 *
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/debug_inspect_health_backpressure_contract.md | Debug Inspect Health Backpressure Contract}
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/contracts/observability_contract.md | Observability Contract}
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/architecture/00-platform-architecture.md | Architecture and Technical Design}
 */
import type { AgentExecutionRecord, ApprovalRecord, ArtifactRecord, DispatchDecisionTrace, EventRecord, RemoteSessionStatus, SessionConsistencyCheckStatus, TaskRecord, WorkerSchedulingStatus, WorkerStatus, WorkerPlacement, WorkflowStateRecord } from "../../contracts/types/domain.js";
import { type ResultEnvelope } from "../../contracts/result-envelope/result-envelope.js";
import type { TaskSnapshot } from "../../state-evidence/truth/authoritative-task-store.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import { type TaskRuntimeRecoveryView } from "../../execution/recovery/runtime-recovery-service-root.js";
interface ApprovalRequestSummary {
    sourceAgentId: string | null;
    riskLevel: string | null;
}
interface ApprovalDecisionSummary {
    decisionType: string | null;
    respondedBy: string | null;
    cascadeDeny: boolean;
}
export declare function parseApprovalRequestSummary(requestJson: string): ApprovalRequestSummary;
export declare function parseApprovalDecisionSummary(responseJson: string | null): ApprovalDecisionSummary;
export declare function parseDispatchDecisionTraceFromEvent(event: EventRecord): DispatchDecisionTrace | null;
export declare function normalizeLimit(limit: number | undefined, fallback: number): number;
export declare function parseJsonArray(value: string): string[];
export declare function findActiveExecutionId(executions: Array<{
    id: string;
    status: string;
}>): string | null;
export interface TaskInspectQuery {
    limit?: number;
    tenantId?: string | null;
    taskStatus?: TaskRecord["status"];
    workflowStatus?: WorkflowStateRecord["status"];
    workflowId?: string;
    divisionId?: string;
    hasPendingApproval?: boolean;
}
export interface TaskInspectSummary {
    taskId: string;
    title: string;
    divisionId: string | null;
    priority: TaskRecord["priority"];
    taskStatus: TaskRecord["status"];
    workflowId: string | null;
    workflowStatus: WorkflowStateRecord["status"] | null;
    currentStepIndex: number | null;
    sessionStatus: string | null;
    activeExecutionId: string | null;
    latestExecutionStatus: string | null;
    pendingApprovalCount: number;
    resolvedApprovalCount: number;
    dispatchDecisionCount: number;
    latestEventAt: string | null;
    updatedAt: string;
}
export interface WorkflowInspectQuery {
    limit?: number;
    tenantId?: string | null;
    workflowId?: string;
    workflowStatus?: WorkflowStateRecord["status"];
    divisionId?: string;
    taskStatus?: TaskRecord["status"];
}
export interface WorkflowInspectSummary {
    taskId: string;
    divisionId: string;
    workflowId: string;
    workflowStatus: WorkflowStateRecord["status"];
    currentStepIndex: number;
    retryCount: number;
    resumableFromStep: string | null;
    lastErrorCode: string | null;
    taskStatus: TaskRecord["status"];
    activeExecutionId: string | null;
    pendingApprovalCount: number;
    latestEventAt: string | null;
    updatedAt: string;
}
export interface DecisionInspectQuery {
    limit?: number;
    tenantId?: string | null;
    decisionType?: "approval" | "dispatch";
    status?: string;
    taskId?: string;
    executionId?: string;
}
export interface WorkerInspectQuery {
    limit?: number;
    status?: WorkerStatus;
    placement?: WorkerPlacement;
    remoteSessionStatus?: RemoteSessionStatus;
    queueAffinity?: string;
}
export interface DecisionInspectSummary {
    decisionType: "approval" | "dispatch";
    decisionId: string;
    taskId: string;
    executionId: string | null;
    workflowId: string | null;
    status: string;
    reasonCode: string | null;
    sourceAgentId: string | null;
    actorId: string | null;
    riskLevel: string | null;
    selectedWorkerId: string | null;
    queueName: string | null;
    cascadeDeny: boolean;
    createdAt: string;
    respondedAt: string | null;
}
export interface WorkerInspectSummary {
    workerId: string;
    status: WorkerStatus;
    schedulingStatus: WorkerSchedulingStatus;
    placement: WorkerPlacement;
    isolationLevel: string;
    repoVersion: string | null;
    remoteSessionStatus: RemoteSessionStatus | null;
    lastAcknowledgedStreamOffset: string | null;
    streamResumeSuccessRate: number | null;
    credentialRefreshSuccessRate: number | null;
    sessionConsistencyCheckStatus: SessionConsistencyCheckStatus | null;
    sessionConsistencyCheckedAt: string | null;
    saturation: number | null;
    activeLeaseCount: number;
    meanStartupLatencyMs: number | null;
    sandboxSuccessRate: number | null;
    repoCacheHitRate: number | null;
    maxConcurrency: number;
    runningExecutionCount: number;
    availableSlots: number;
    queueAffinity: string | null;
    lastHeartbeatAt: string;
    updatedAt: string;
}
export interface DispatchDecisionInspectTrace extends DispatchDecisionTrace {
    selectedWorkerPlacement: WorkerPlacement | null;
    acceptedWorkerIds: string[];
    rejectedWorkerIds: string[];
    remoteAcceptedWorkerIds: string[];
    remoteRejectedWorkerIds: string[];
    localAcceptedWorkerIds: string[];
    localRejectedWorkerIds: string[];
}
export interface RemoteRoutingSummary {
    totalDecisions: number;
    remoteDecisionCount: number;
    healthyDecisionCount: number;
    partialAvailableDecisionCount: number;
    degradedDecisionCount: number;
    unavailableDecisionCount: number;
    remoteDispatchCount: number;
    localDispatchCount: number;
    localFallbackCount: number;
    requireRemoteBlockedCount: number;
    latestRemoteAvailability: DispatchDecisionTrace["remoteAvailability"];
    latestSelectedWorkerPlacement: WorkerPlacement | null;
    remoteWorkerIds: string[];
    localWorkerIds: string[];
}
export interface LeaseHandoverSummary {
    totalHandovers: number;
    latestHandoverAt: string | null;
    latestReasonCode: string | null;
    latestPreviousWorkerId: string | null;
    latestWorkerId: string | null;
    workerIds: string[];
}
/**
 * Comprehensive inspect view of a task including all related records:
 * task state, workflow state, execution, session, approvals, takeover sessions,
 * operator actions, dispatch decisions, events, step outputs, and artifacts.
 */
export interface TaskInspectView {
    task: TaskSnapshot["task"];
    workflowState: TaskSnapshot["workflow"];
    execution: TaskSnapshot["execution"];
    session: TaskSnapshot["session"];
    approvals: ApprovalRecord[];
    takeoverSessions: ReturnType<AuthoritativeTaskStore["listTakeoverSessionsByTask"]>;
    operatorActions: ReturnType<AuthoritativeTaskStore["listOperatorActionsByTask"]>;
    agentExecutions: AgentExecutionRecord[];
    dispatchDecisions: DispatchDecisionInspectTrace[];
    remoteRoutingSummary: RemoteRoutingSummary;
    leaseHandoverSummary: LeaseHandoverSummary;
    recentEvents: TaskSnapshot["events"];
    stepOutputs: TaskSnapshot["stepOutputs"];
    stepResults: ResultEnvelope[];
    taskResult: ResultEnvelope | null;
    artifacts: ArtifactRecord[];
    runtimeRecovery: TaskRuntimeRecoveryView;
    recoverySummary: {
        activeExecutionId: string | null;
        hasTerminalTask: boolean;
        lastTakeoverActionType: string | null;
    };
}
/**
 * Comprehensive inspect view for an execution, including the execution itself,
 * all executions for the task, and all related records. Used for detailed
 * execution debugging and operator workflows.
 */
export interface ExecutionInspectView {
    task: TaskSnapshot["task"];
    workflowState: TaskSnapshot["workflow"];
    execution: NonNullable<TaskSnapshot["execution"]>;
    executions: ReturnType<AuthoritativeTaskStore["listExecutionsByTask"]>;
    session: TaskSnapshot["session"];
    approvals: ApprovalRecord[];
    takeoverSessions: ReturnType<AuthoritativeTaskStore["listTakeoverSessionsByTask"]>;
    operatorActions: ReturnType<AuthoritativeTaskStore["listOperatorActionsByTask"]>;
    agentExecution: AgentExecutionRecord | null;
    dispatchDecisions: DispatchDecisionInspectTrace[];
    remoteRoutingSummary: RemoteRoutingSummary;
    leaseHandoverSummary: LeaseHandoverSummary;
    recentEvents: TaskSnapshot["events"];
    stepOutputs: TaskSnapshot["stepOutputs"];
    stepResults: ResultEnvelope[];
    taskResult: ResultEnvelope | null;
    artifacts: ArtifactRecord[];
    runtimeRecovery: TaskRuntimeRecoveryView;
}
/**
 * Focused inspect view for an approval, including the approval record itself
 * and all related context needed for approval review and decision-making.
 */
export interface ApprovalInspectView {
    task: TaskSnapshot["task"];
    workflowState: TaskSnapshot["workflow"];
    execution: TaskSnapshot["execution"];
    session: TaskSnapshot["session"];
    approval: ApprovalRecord;
    approvals: ApprovalRecord[];
    operatorActions: ReturnType<AuthoritativeTaskStore["listOperatorActionsByTask"]>;
    agentExecution: AgentExecutionRecord | null;
    dispatchDecisions: DispatchDecisionInspectTrace[];
    remoteRoutingSummary: RemoteRoutingSummary;
    leaseHandoverSummary: LeaseHandoverSummary;
    recentEvents: TaskSnapshot["events"];
    stepResults: ResultEnvelope[];
    taskResult: ResultEnvelope | null;
    artifacts: ArtifactRecord[];
    runtimeRecovery: TaskRuntimeRecoveryView;
}
/**
 * InspectService provides read-only views into task, execution, and approval state.
 * It aggregates data from the AuthoritativeTaskStore and RuntimeRecoveryService to provide
 * comprehensive debugging and observability information.
 */
export declare function buildStepResultEnvelopes(stepOutputs: TaskSnapshot["stepOutputs"], artifacts: ArtifactRecord[]): ResultEnvelope[];
export declare function enrichDispatchDecisionTrace(decision: DispatchDecisionTrace): DispatchDecisionInspectTrace;
export declare function buildRemoteRoutingSummary(decisions: DispatchDecisionInspectTrace[]): RemoteRoutingSummary;
export declare function buildLeaseHandoverSummary(events: EventRecord[]): LeaseHandoverSummary;
export {};
