import type {
  WorkflowSuspensionRecord,
  WorkflowSuspensionStatus,
  WorkflowTimeoutPolicy,
  WorkflowWaitKind,
} from "./long-running-workflow-service.js";

export interface WorkflowSleepLease {
  readonly suspensionId?: string;
  readonly taskId: string;
  readonly workflowId?: string;
  readonly executionId: string | null;
  readonly divisionId?: string;
  readonly waitKind?: WorkflowWaitKind;
  readonly status?: WorkflowSuspensionStatus;
  readonly suspendedAt?: string;
  readonly resumeAfter?: string | null;
  readonly expiresAt?: string | null;
  readonly resumableFromStep?: string;
  readonly checkpointArtifactId?: string | null;
  readonly timeoutPolicy?: WorkflowTimeoutPolicy;
  readonly metadata?: Record<string, unknown>;
  readonly wakeAt?: Date;
}

export interface WorkflowResumeWindow {
  readonly suspensionId?: string;
  readonly taskId: string;
  readonly workflowId?: string;
  readonly dueAt?: string | null;
  readonly expiresAt?: string | null;
  readonly due?: boolean;
  readonly expired?: boolean;
  readonly nextAction?: "wait" | "resume" | "expire";
  readonly timeoutPolicy?: WorkflowTimeoutPolicy;
  readonly resumableFromStep?: string;
  readonly windowStart?: Date;
  readonly windowEnd?: Date;
  readonly channel?: string;
}

export function toWorkflowSleepLease(record: WorkflowSuspensionRecord): WorkflowSleepLease;
export function toWorkflowSleepLease(taskId: string, executionId: string, wakeAt: Date): WorkflowSleepLease;
export function toWorkflowSleepLease(
  recordOrTaskId: WorkflowSuspensionRecord | string,
  executionId?: string,
  wakeAt?: Date,
): WorkflowSleepLease {
  if (typeof recordOrTaskId === "string") {
    return {
      taskId: recordOrTaskId,
      executionId: executionId ?? null,
      wakeAt: wakeAt ?? new Date(),
    };
  }
  const record = recordOrTaskId;
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

export function toWorkflowResumeWindow(record: WorkflowSuspensionRecord, now: string): WorkflowResumeWindow;
export function toWorkflowResumeWindow(lease: WorkflowSleepLease, channel: string): WorkflowResumeWindow;
export function toWorkflowResumeWindow(
  recordOrLease: WorkflowSuspensionRecord | WorkflowSleepLease,
  nowOrChannel: string,
): WorkflowResumeWindow {
  if ("wakeAt" in recordOrLease && recordOrLease.wakeAt instanceof Date) {
    const windowStart = recordOrLease.wakeAt;
    return {
      taskId: recordOrLease.taskId,
      windowStart,
      windowEnd: new Date(windowStart.getTime() + 60_000),
      channel: nowOrChannel,
    };
  }
  const record = recordOrLease as WorkflowSuspensionRecord;
  const now = nowOrChannel;
  const expired = record.expiresAt != null && record.expiresAt <= now;
  const resumeWindowLeadMs = 30 * 60 * 1000;
  const due = !expired && record.resumeAfter != null && (
    record.resumeAfter <= now ||
    (record.waitKind === "timer" && Date.parse(record.resumeAfter) - Date.parse(now) <= resumeWindowLeadMs)
  );
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
    channel: nowOrChannel,
  };
}
