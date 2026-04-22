import { newId, nowIso } from "../../contracts/types/ids.js";
import type { WorkflowStateRecord } from "../../contracts/types/domain.js";
import type { WorkflowStatus } from "../../contracts/types/status.js";
import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";

export type WorkflowWaitKind = "timer" | "human_input" | "external_event" | "throttled" | "deployment_window";
export type WorkflowSuspensionStatus = "active" | "resumable" | "expired" | "cancelled";
export type WorkflowTimeoutPolicy = "fail_workflow" | "remain_pending";

export interface WorkflowSuspensionRequest {
  readonly taskId: string;
  readonly executionId?: string | null;
  readonly reasonCode: string;
  readonly waitKind: WorkflowWaitKind;
  readonly resumableFromStep: string;
  readonly resumeAfter?: string | null;
  readonly expiresAt?: string | null;
  readonly checkpointArtifactId?: string | null;
  readonly timeoutPolicy: WorkflowTimeoutPolicy;
  readonly metadata?: Record<string, unknown>;
}

export interface WorkflowSuspensionRecord {
  readonly suspensionId: string;
  readonly taskId: string;
  readonly executionId: string | null;
  readonly workflowId: string;
  readonly divisionId: string;
  readonly reasonCode: string;
  readonly waitKind: WorkflowWaitKind;
  readonly status: WorkflowSuspensionStatus;
  readonly suspendedAt: string;
  readonly resumeAfter: string | null;
  readonly expiresAt: string | null;
  readonly checkpointArtifactId: string | null;
  readonly resumableFromStep: string;
  readonly timeoutPolicy: WorkflowTimeoutPolicy;
  readonly metadata: Record<string, unknown>;
}

export interface WorkflowResumeDecision {
  readonly suspensionId: string;
  readonly taskId: string;
  readonly workflowId: string;
  readonly allowed: boolean;
  readonly reasonCode: string;
  readonly nextWorkflowStatus: WorkflowStatus | null;
  readonly resumableFromStep: string;
}

function parseOutputs(outputsJson: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(outputsJson) as unknown;
    return parsed != null && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function isTerminal(status: WorkflowStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

export class LongRunningWorkflowService {
  private readonly suspensions = new Map<string, WorkflowSuspensionRecord>();

  public constructor(private readonly store: AuthoritativeTaskStore) {}

  public suspend(request: WorkflowSuspensionRequest): WorkflowSuspensionRecord {
    const workflow = this.requireWorkflow(request.taskId);
    if (isTerminal(workflow.status)) {
      throw new Error(`workflow_sleep.terminal_workflow:${request.taskId}`);
    }

    const suspendedAt = nowIso();
    const record: WorkflowSuspensionRecord = {
      suspensionId: newId("workflow_sleep"),
      taskId: request.taskId,
      executionId: request.executionId ?? null,
      workflowId: workflow.workflowId,
      divisionId: workflow.divisionId,
      reasonCode: request.reasonCode,
      waitKind: request.waitKind,
      status: "active",
      suspendedAt,
      resumeAfter: request.resumeAfter ?? null,
      expiresAt: request.expiresAt ?? null,
      checkpointArtifactId: request.checkpointArtifactId ?? null,
      resumableFromStep: request.resumableFromStep,
      timeoutPolicy: request.timeoutPolicy,
      metadata: request.metadata ?? {},
    };

    this.suspensions.set(record.suspensionId, record);
    this.writeWorkflowStatus(workflow, "paused", record.resumableFromStep, {
      __workflow_suspension: record,
    }, suspendedAt);
    this.emitWorkflowEvent("workflow:suspended", record.taskId, record.executionId, record);
    return record;
  }

  public markDue(now: string = nowIso()): WorkflowSuspensionRecord[] {
    const due: WorkflowSuspensionRecord[] = [];
    for (const record of this.suspensions.values()) {
      if (record.status !== "active" || record.resumeAfter == null || record.resumeAfter > now) {
        continue;
      }
      const updated = { ...record, status: "resumable" as const };
      this.suspensions.set(record.suspensionId, updated);
      this.emitWorkflowEvent("workflow:resume_due", updated.taskId, updated.executionId, updated);
      due.push(updated);
    }
    return due;
  }

  public resume(suspensionId: string, now: string = nowIso()): WorkflowResumeDecision {
    const record = this.requireSuspension(suspensionId);
    if (record.expiresAt != null && record.expiresAt <= now) {
      return this.expire(record, now);
    }
    if (record.resumeAfter != null && record.resumeAfter > now) {
      return {
        suspensionId,
        taskId: record.taskId,
        workflowId: record.workflowId,
        allowed: false,
        reasonCode: "workflow_sleep.resume_not_due",
        nextWorkflowStatus: null,
        resumableFromStep: record.resumableFromStep,
      };
    }

    const workflow = this.requireWorkflow(record.taskId);
    const updated = { ...record, status: "resumable" as const };
    this.suspensions.set(suspensionId, updated);
    this.writeWorkflowStatus(workflow, "resuming", record.resumableFromStep, {
      __workflow_resume: {
        suspensionId,
        resumedAt: now,
      },
    }, now);
    this.emitWorkflowEvent("workflow:resume_requested", record.taskId, record.executionId, updated);

    return {
      suspensionId,
      taskId: record.taskId,
      workflowId: record.workflowId,
      allowed: true,
      reasonCode: "workflow_sleep.resume_allowed",
      nextWorkflowStatus: "resuming",
      resumableFromStep: record.resumableFromStep,
    };
  }

  public sweepExpired(now: string = nowIso()): WorkflowResumeDecision[] {
    const decisions: WorkflowResumeDecision[] = [];
    for (const record of this.suspensions.values()) {
      if (record.status === "active" && record.expiresAt != null && record.expiresAt <= now) {
        decisions.push(this.expire(record, now));
      }
    }
    return decisions;
  }

  public getSuspension(suspensionId: string): WorkflowSuspensionRecord | null {
    return this.suspensions.get(suspensionId) ?? null;
  }

  private expire(record: WorkflowSuspensionRecord, now: string): WorkflowResumeDecision {
    const workflow = this.requireWorkflow(record.taskId);
    const expired = { ...record, status: "expired" as const };
    this.suspensions.set(record.suspensionId, expired);
    const nextStatus: WorkflowStatus | null = record.timeoutPolicy === "fail_workflow" ? "failed" : null;
    if (nextStatus != null) {
      this.writeWorkflowStatus(workflow, nextStatus, record.resumableFromStep, {
        __workflow_timeout: {
          suspensionId: record.suspensionId,
          expiredAt: now,
          reasonCode: record.reasonCode,
        },
      }, now);
    }
    this.emitWorkflowEvent("workflow:suspension_expired", record.taskId, record.executionId, expired);
    return {
      suspensionId: record.suspensionId,
      taskId: record.taskId,
      workflowId: record.workflowId,
      allowed: false,
      reasonCode: record.timeoutPolicy === "fail_workflow"
        ? "workflow_sleep.expired_failed"
        : "workflow_sleep.expired_remain_pending",
      nextWorkflowStatus: nextStatus,
      resumableFromStep: record.resumableFromStep,
    };
  }

  private writeWorkflowStatus(
    workflow: WorkflowStateRecord,
    status: WorkflowStatus,
    resumableFromStep: string | null,
    outputPatch: Record<string, unknown>,
    updatedAt: string,
  ): void {
    this.store.workflow.updateWorkflowState(
      workflow.taskId,
      status,
      workflow.currentStepIndex,
      JSON.stringify({
        ...parseOutputs(workflow.outputsJson),
        ...outputPatch,
      }),
      updatedAt,
      resumableFromStep,
    );
  }

  private requireWorkflow(taskId: string): WorkflowStateRecord {
    const workflow = this.store.workflow.getWorkflowState(taskId);
    if (workflow == null) {
      throw new Error(`workflow_sleep.workflow_not_found:${taskId}`);
    }
    return workflow;
  }

  private requireSuspension(suspensionId: string): WorkflowSuspensionRecord {
    const suspension = this.suspensions.get(suspensionId);
    if (suspension == null) {
      throw new Error(`workflow_sleep.suspension_not_found:${suspensionId}`);
    }
    return suspension;
  }

  private emitWorkflowEvent(
    eventType: string,
    taskId: string,
    executionId: string | null,
    payload: WorkflowSuspensionRecord,
  ): void {
    this.store.event.insertEvent({
      id: newId("evt"),
      taskId,
      executionId,
      eventType,
      eventTier: "tier_1",
      payloadJson: JSON.stringify(payload),
      traceId: null,
      createdAt: nowIso(),
    });
  }
}
