import { newId, nowIso } from "../../contracts/types/ids.js";
import type { WorkflowStateRecord } from "../../contracts/types/domain.js";
import type { WorkflowStatus } from "../../contracts/types/status.js";
import type { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import { toWorkflowResumeWindow, toWorkflowSleepLease, type WorkflowResumeWindow, type WorkflowSleepLease } from "./workflow-sleep-contracts.js";

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

function compareIsoInstant(left: string, right: string, parsedRight = Date.parse(right)): number {
  const parsedLeft = Date.parse(left);
  if (Number.isFinite(parsedLeft) && Number.isFinite(parsedRight)) {
    return parsedLeft - parsedRight;
  }
  return left.localeCompare(right);
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
    this.pruneTerminalSuspensions();
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
    this.pruneTerminalSuspensions();
    const due: WorkflowSuspensionRecord[] = [];
    const nowMs = Date.parse(now);
    for (const record of this.suspensions.values()) {
      if (record.status !== "active" || record.resumeAfter == null || compareIsoInstant(record.resumeAfter, now, nowMs) > 0) {
        continue;
      }
      if (record.expiresAt != null && compareIsoInstant(record.expiresAt, now, nowMs) <= 0) {
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
    this.pruneTerminalSuspensions();
    const record = this.requireSuspension(suspensionId);
    if (record.expiresAt != null && compareIsoInstant(record.expiresAt, now) <= 0) {
      return this.expire(record, now);
    }
    if (record.resumeAfter != null && compareIsoInstant(record.resumeAfter, now) > 0) {
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
    this.pruneTerminalSuspensions();
    const decisions: WorkflowResumeDecision[] = [];
    for (const record of this.suspensions.values()) {
      if (record.status === "active" && record.expiresAt != null && compareIsoInstant(record.expiresAt, now) <= 0) {
        decisions.push(this.expire(record, now));
      }
    }
    return decisions;
  }

  public getSuspension(suspensionId: string): WorkflowSuspensionRecord | null {
    this.pruneTerminalSuspensions();
    return this.suspensions.get(suspensionId) ?? null;
  }

  public listSuspensions(): WorkflowSuspensionRecord[] {
    this.pruneTerminalSuspensions();
    return [...this.suspensions.values()];
  }

  public buildSleepLease(suspensionId: string): WorkflowSleepLease {
    return toWorkflowSleepLease(this.requireSuspension(suspensionId));
  }

  public buildResumeWindow(suspensionId: string, now: string = nowIso()): WorkflowResumeWindow {
    return toWorkflowResumeWindow(this.requireSuspension(suspensionId), now);
  }

  public listResumeWindows(now: string = nowIso()): WorkflowResumeWindow[] {
    return this.listSuspensions().map((record) => toWorkflowResumeWindow(record, now));
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
      this.suspensions.delete(record.suspensionId);
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

  private pruneTerminalSuspensions(): void {
    for (const [suspensionId, record] of this.suspensions.entries()) {
      const workflow = this.store.workflow.getWorkflowState(record.taskId);
      if (workflow == null || isTerminal(workflow.status)) {
        this.suspensions.delete(suspensionId);
      }
    }
  }
}
