import type {
  WorkflowSuspensionRecord,
  WorkflowSuspensionStatus,
  WorkflowTimeoutPolicy,
  WorkflowWaitKind,
} from "./long-running-workflow-service.js";

export interface WorkflowSleepLease {
  readonly suspensionId: string;
  readonly taskId: string;
  readonly workflowId: string;
  readonly executionId: string | null;
  readonly divisionId: string;
  readonly waitKind: WorkflowWaitKind;
  readonly status: WorkflowSuspensionStatus;
  readonly suspendedAt: string;
  readonly resumeAfter: string | null;
  readonly expiresAt: string | null;
  readonly resumableFromStep: string;
  readonly checkpointArtifactId: string | null;
  readonly timeoutPolicy: WorkflowTimeoutPolicy;
  readonly metadata: Record<string, unknown>;
}

export interface WorkflowResumeWindow {
  readonly suspensionId: string;
  readonly taskId: string;
  readonly workflowId: string;
  readonly dueAt: string | null;
  readonly expiresAt: string | null;
  readonly due: boolean;
  readonly expired: boolean;
  readonly nextAction: "wait" | "resume" | "expire";
  readonly timeoutPolicy: WorkflowTimeoutPolicy;
  readonly resumableFromStep: string;
}

export function toWorkflowSleepLease(record: WorkflowSuspensionRecord): WorkflowSleepLease {
  return {
    suspensionId: record.suspensionId,
    taskId: record.taskId,
    workflowId: record.workflowId,
    executionId: record.executionId,
    divisionId: record.divisionId,
    waitKind: record.waitKind,
    status: record.status,
    suspendedAt: record.suspendedAt,
    resumeAfter: record.resumeAfter,
    expiresAt: record.expiresAt,
    resumableFromStep: record.resumableFromStep,
    checkpointArtifactId: record.checkpointArtifactId,
    timeoutPolicy: record.timeoutPolicy,
    metadata: record.metadata,
  };
}

export function toWorkflowResumeWindow(record: WorkflowSuspensionRecord, now: string): WorkflowResumeWindow {
  const expired = record.expiresAt != null && record.expiresAt <= now;
  const due = !expired && record.resumeAfter != null && record.resumeAfter <= now;
  return {
    suspensionId: record.suspensionId,
    taskId: record.taskId,
    workflowId: record.workflowId,
    dueAt: record.resumeAfter,
    expiresAt: record.expiresAt,
    due,
    expired,
    nextAction: expired ? "expire" : due ? "resume" : "wait",
    timeoutPolicy: record.timeoutPolicy,
    resumableFromStep: record.resumableFromStep,
  };
}
