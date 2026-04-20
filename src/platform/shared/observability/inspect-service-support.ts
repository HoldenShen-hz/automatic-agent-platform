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

import type {
  AgentExecutionRecord,
  ApprovalRecord,
  ArtifactRecord,
  DispatchDecisionTrace,
  DispatchWorkerEvaluation,
  EventRecord,
  RemoteSessionStatus,
  SessionConsistencyCheckStatus,
  TaskRecord,
  WorkerSchedulingStatus,
  WorkerStatus,
  WorkerPlacement,
  WorkflowStateRecord,
} from "../../contracts/types/domain.js";
import { buildStepResultEnvelope, type ResultEnvelope } from "../../contracts/result-envelope/result-envelope.js";
import type { TaskSnapshot } from "../../state-evidence/truth/authoritative-task-store.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import { type TaskRuntimeRecoveryView } from "../../execution/recovery/runtime-recovery-service-root.js";
import { StructuredLogger } from "./structured-logger.js";

const inspectLogger = new StructuredLogger({ retentionLimit: 50 });

const TERMINAL_EXECUTION_STATUSES = new Set(["succeeded", "failed", "cancelled", "superseded"]);

interface ApprovalRequestSummary {
  sourceAgentId: string | null;
  riskLevel: string | null;
}

interface ApprovalDecisionSummary {
  decisionType: string | null;
  respondedBy: string | null;
  cascadeDeny: boolean;
}

export function parseApprovalRequestSummary(requestJson: string): ApprovalRequestSummary {
  try {
    const parsed = JSON.parse(requestJson) as Record<string, unknown>;
    return {
      sourceAgentId: typeof parsed.sourceAgentId === "string" ? parsed.sourceAgentId : null,
      riskLevel: typeof parsed.riskLevel === "string" ? parsed.riskLevel : null,
    };
  } catch (err) {
    inspectLogger.log({ level: "debug", message: "Failed to parse approval request summary", data: { error: err instanceof Error ? err.message : String(err) } });
    return {
      sourceAgentId: null,
      riskLevel: null,
    };
  }
}

export function parseApprovalDecisionSummary(responseJson: string | null): ApprovalDecisionSummary {
  if (responseJson == null) {
    return {
      decisionType: null,
      respondedBy: null,
      cascadeDeny: false,
    };
  }

  try {
    const parsed = JSON.parse(responseJson) as Record<string, unknown>;
    return {
      decisionType: typeof parsed.decisionType === "string" ? parsed.decisionType : null,
      respondedBy: typeof parsed.respondedBy === "string" ? parsed.respondedBy : null,
      cascadeDeny: parsed.cascadeDeny === true,
    };
  } catch (err) {
    inspectLogger.log({ level: "debug", message: "Failed to parse approval decision summary", data: { error: err instanceof Error ? err.message : String(err) } });
    return {
      decisionType: null,
      respondedBy: null,
      cascadeDeny: false,
    };
  }
}

export function parseDispatchDecisionTraceFromEvent(event: EventRecord): DispatchDecisionTrace | null {
  if (event.eventType !== "dispatch:decision_recorded") {
    return null;
  }

  try {
    const parsed = JSON.parse(event.payloadJson) as unknown;
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const candidate = parsed as Record<string, unknown>;
    if (
      typeof candidate.ticketId !== "string" ||
      typeof candidate.executionId !== "string" ||
      typeof candidate.taskId !== "string" ||
      !Array.isArray(candidate.requiredCapabilities) ||
      !Array.isArray(candidate.evaluations)
    ) {
      return null;
    }
    return parsed as DispatchDecisionTrace;
  } catch (err) {
    inspectLogger.log({ level: "debug", message: "Failed to parse dispatch decision trace from event", data: { error: err instanceof Error ? err.message : String(err) } });
    return null;
  }
}

export function normalizeLimit(limit: number | undefined, fallback: number): number {
  if (!Number.isFinite(limit) || limit == null) {
    return fallback;
  }
  return Math.max(1, Math.min(200, Math.trunc(limit)));
}

export function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch (err) {
    inspectLogger.log({ level: "debug", message: "Failed to parse JSON array", data: { error: err instanceof Error ? err.message : String(err) } });
    return [];
  }
}

function isTerminalExecutionStatus(status: string): boolean {
  return TERMINAL_EXECUTION_STATUSES.has(status);
}

export function findActiveExecutionId(executions: Array<{ id: string; status: string }>): string | null {
  for (let index = executions.length - 1; index >= 0; index -= 1) {
    const execution = executions[index];
    if (execution && !isTerminalExecutionStatus(execution.status)) {
      return execution.id;
    }
  }
  return null;
}

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



export function buildStepResultEnvelopes(stepOutputs: TaskSnapshot["stepOutputs"], artifacts: ArtifactRecord[]): ResultEnvelope[] {
  return stepOutputs.map((stepOutput) =>
    buildStepResultEnvelope(
      stepOutput,
      artifacts.filter((artifact) => artifact.stepId === stepOutput.stepId),
    ),
  );
}

export function enrichDispatchDecisionTrace(decision: DispatchDecisionTrace): DispatchDecisionInspectTrace {
  const acceptedWorkerIds = decision.evaluations.filter((evaluation) => evaluation.accepted).map((evaluation) => evaluation.workerId);
  const rejectedWorkerIds = decision.evaluations.filter((evaluation) => !evaluation.accepted).map((evaluation) => evaluation.workerId);

  return {
    ...decision,
    selectedWorkerPlacement: resolveSelectedWorkerPlacement(decision.selectedWorkerId, decision.evaluations),
    acceptedWorkerIds,
    rejectedWorkerIds,
    remoteAcceptedWorkerIds: collectWorkerIds(decision.evaluations, "remote", true),
    remoteRejectedWorkerIds: collectWorkerIds(decision.evaluations, "remote", false),
    localAcceptedWorkerIds: collectWorkerIds(decision.evaluations, "local", true),
    localRejectedWorkerIds: collectWorkerIds(decision.evaluations, "local", false),
  };
}

export function buildRemoteRoutingSummary(decisions: DispatchDecisionInspectTrace[]): RemoteRoutingSummary {
  const latestDecision = decisions.at(-1) ?? null;
  const remoteWorkerIds = new Set<string>();
  const localWorkerIds = new Set<string>();

  for (const decision of decisions) {
    for (const evaluation of decision.evaluations) {
      if (evaluation.placement === "remote") {
        remoteWorkerIds.add(evaluation.workerId);
      } else if (evaluation.placement === "local") {
        localWorkerIds.add(evaluation.workerId);
      }
    }
  }

  return {
    totalDecisions: decisions.length,
    remoteDecisionCount: decisions.filter(hasRemoteRoutingDimension).length,
    healthyDecisionCount: decisions.filter((decision) => decision.remoteAvailability === "healthy").length,
    partialAvailableDecisionCount: decisions.filter((decision) => decision.remoteAvailability === "partial_available").length,
    degradedDecisionCount: decisions.filter((decision) => decision.remoteAvailability === "degraded").length,
    unavailableDecisionCount: decisions.filter((decision) => decision.remoteAvailability === "unavailable").length,
    remoteDispatchCount: decisions.filter((decision) => decision.selectedWorkerPlacement === "remote").length,
    localDispatchCount: decisions.filter((decision) => decision.selectedWorkerPlacement === "local").length,
    localFallbackCount: decisions.filter((decision) => decision.fallbackApplied === true).length,
    requireRemoteBlockedCount: decisions.filter(
      (decision) => decision.outcome === "blocked" && decision.dispatchTarget === "require_remote",
    ).length,
    latestRemoteAvailability: latestDecision?.remoteAvailability ?? null,
    latestSelectedWorkerPlacement: latestDecision?.selectedWorkerPlacement ?? null,
    remoteWorkerIds: [...remoteWorkerIds].sort(),
    localWorkerIds: [...localWorkerIds].sort(),
  };
}

interface LeaseHandoverEventPayload {
  previousWorkerId?: string;
  workerId?: string;
  reasonCode?: string | null;
}

export function buildLeaseHandoverSummary(events: EventRecord[]): LeaseHandoverSummary {
  const handovers = events
    .filter((event) => event.eventType === "lease:handover_recorded")
    .map((event) => {
      let payload: LeaseHandoverEventPayload | null = null;
      try {
        const parsed = JSON.parse(event.payloadJson) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          payload = parsed as LeaseHandoverEventPayload;
        }
      } catch (err) {
        inspectLogger.log({ level: "debug", message: "Failed to parse lease handover event payload", data: { eventId: event.id, error: err instanceof Error ? err.message : String(err) } });
        payload = null;
      }

      return {
        createdAt: event.createdAt,
        previousWorkerId: typeof payload?.previousWorkerId === "string" ? payload.previousWorkerId : null,
        workerId: typeof payload?.workerId === "string" ? payload.workerId : null,
        reasonCode: typeof payload?.reasonCode === "string" ? payload.reasonCode : null,
      };
    });
  const latestHandover = handovers.at(-1) ?? null;
  const workerIds = new Set<string>();

  for (const handover of handovers) {
    if (handover.previousWorkerId) {
      workerIds.add(handover.previousWorkerId);
    }
    if (handover.workerId) {
      workerIds.add(handover.workerId);
    }
  }

  return {
    totalHandovers: handovers.length,
    latestHandoverAt: latestHandover?.createdAt ?? null,
    latestReasonCode: latestHandover?.reasonCode ?? null,
    latestPreviousWorkerId: latestHandover?.previousWorkerId ?? null,
    latestWorkerId: latestHandover?.workerId ?? null,
    workerIds: [...workerIds].sort(),
  };
}

function hasRemoteRoutingDimension(decision: DispatchDecisionInspectTrace): boolean {
  return (
    decision.dispatchTarget === "prefer_remote" ||
    decision.dispatchTarget === "require_remote" ||
    decision.remoteAvailability != null ||
    decision.evaluations.some((evaluation) => evaluation.placement === "remote")
  );
}

function resolveSelectedWorkerPlacement(
  selectedWorkerId: string | null,
  evaluations: DispatchWorkerEvaluation[],
): WorkerPlacement | null {
  if (!selectedWorkerId) {
    return null;
  }

  return evaluations.find((evaluation) => evaluation.workerId === selectedWorkerId)?.placement ?? null;
}

function collectWorkerIds(
  evaluations: DispatchWorkerEvaluation[],
  placement: WorkerPlacement,
  accepted: boolean,
): string[] {
  return evaluations
    .filter((evaluation) => evaluation.placement === placement && evaluation.accepted === accepted)
    .map((evaluation) => evaluation.workerId);
}
