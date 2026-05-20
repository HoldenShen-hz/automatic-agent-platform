import { newId, nowIso } from "../../platform/contracts/types/ids.js";

/**
 * R9-38: ComplianceExceptionWorkflow - handles exceptions to compliance requirements
 */
export type ComplianceExceptionStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "expired"
  | "mitigation_required"
  | "withdrawn"
  | "revoked";

export type ComplianceExceptionSeverity = "critical" | "high" | "medium" | "low";

export interface ComplianceExceptionRequest {
  readonly exceptionId: string;
  readonly frameworkId: string;
  readonly controlId: string;
  readonly requesterId: string;
  readonly justification: string;
  readonly riskImpact: string;
  readonly proposedMitigation: string;
  readonly compensatingControls: readonly string[];
  readonly requestedApprovalDuration: string; // ISO duration, e.g., "P90D" for 90 days
  readonly submittedAt: string;
  readonly status: ComplianceExceptionStatus;
}

export interface ComplianceExceptionWorkflow {
  readonly workflowId: string;
  readonly exceptionId: string;
  readonly status: ComplianceExceptionStatus;
  readonly approvalChain: readonly string[];
  readonly currentApproverIndex: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly expiresAt: string | null;
  readonly decisions: readonly ExceptionDecision[];
  readonly remediationTaskIds: readonly string[];
}

export interface ExceptionDecision {
  readonly decisionId: string;
  readonly approverId: string;
  readonly decision: "approved" | "rejected" | "requested_changes";
  readonly reason: string;
  readonly decidedAt: string;
  readonly comments?: string;
}

/**
 * R9-38: ComplianceExceptionWorkflowEngine - manages exception approval workflows
 */
export class ComplianceExceptionWorkflowEngine {
  private readonly workflows = new Map<string, ComplianceExceptionWorkflow>();

  /**
   * Initiate an exception workflow
   */
  public initiateWorkflow(
    exception: ComplianceExceptionRequest,
    approvalChain: readonly string[],
  ): ComplianceExceptionWorkflow {
    const workflowId = newId("compliance_exception_wf");
    const now = nowIso();
    const expiresAt = this.calculateExpiration(exception.requestedApprovalDuration, now);

    const workflow: ComplianceExceptionWorkflow = {
      workflowId,
      exceptionId: exception.exceptionId,
      status: "pending_review",
      approvalChain,
      currentApproverIndex: 0,
      createdAt: now,
      updatedAt: now,
      expiresAt,
      decisions: [],
      remediationTaskIds: [],
    };

    this.workflows.set(workflowId, workflow);
    return workflow;
  }

  /**
   * Record a decision on an exception workflow
   */
  public recordDecision(
    workflowId: string,
    approverId: string,
    decision: ExceptionDecision["decision"],
    reason: string,
    comments?: string,
  ): ComplianceExceptionWorkflow | null {
    const workflow = this.workflows.get(workflowId);
    if (workflow == null) {
      return null;
    }
    if (isTerminalWorkflowStatus(workflow.status)) {
      throw new Error(`compliance_exception.terminal_workflow:${workflow.status}`);
    }

    const currentApprover = workflow.approvalChain[workflow.currentApproverIndex];
    if (approverId !== currentApprover) {
      throw new Error(`compliance_exception.wrong_approver:${approverId}:${currentApprover}`);
    }

    const exceptionDecision: ExceptionDecision = {
      decisionId: newId("exception_decision"),
      approverId,
      decision,
      reason,
      decidedAt: nowIso(),
      ...(comments !== undefined && { comments }),
    };

    let nextStatus: ComplianceExceptionStatus = workflow.status;
    let nextApproverIndex = workflow.currentApproverIndex;

    if (decision === "approved") {
      if (workflow.currentApproverIndex >= workflow.approvalChain.length - 1) {
        // All approvers have approved
        nextStatus = "approved";
        nextApproverIndex = workflow.currentApproverIndex;
      } else {
        // Move to next approver
        nextApproverIndex = workflow.currentApproverIndex + 1;
        nextStatus = "pending_review";
      }
    } else if (decision === "rejected") {
      nextStatus = "rejected";
    } else if (decision === "requested_changes") {
      nextStatus = "mitigation_required";
    }

    const updatedWorkflow: ComplianceExceptionWorkflow = {
      ...workflow,
      status: nextStatus,
      currentApproverIndex: nextApproverIndex,
      updatedAt: nowIso(),
      decisions: [...workflow.decisions, exceptionDecision],
    };

    this.workflows.set(workflowId, updatedWorkflow);
    return updatedWorkflow;
  }

  /**
   * Link a remediation task to an exception workflow
   */
  public linkRemediationTask(workflowId: string, taskId: string): boolean {
    const workflow = this.workflows.get(workflowId);
    if (workflow == null) {
      return false;
    }

    const updatedWorkflow: ComplianceExceptionWorkflow = {
      ...workflow,
      updatedAt: nowIso(),
      remediationTaskIds: Array.from(new Set([...workflow.remediationTaskIds, taskId])),
    };

    this.workflows.set(workflowId, updatedWorkflow);
    return true;
  }

  /**
   * Check if a workflow has expired
   */
  public checkExpiration(workflowId: string): boolean {
    const workflow = this.workflows.get(workflowId);
    if (workflow == null || workflow.expiresAt == null) {
      return false;
    }

    if (readIsoTimestampMs(workflow.expiresAt) < Date.now()) {
      const updatedWorkflow: ComplianceExceptionWorkflow = {
        ...workflow,
        status: "expired",
        updatedAt: nowIso(),
      };
      this.workflows.set(workflowId, updatedWorkflow);
      return true;
    }

    return false;
  }

  public expireDueWorkflows(now = nowIso()): readonly string[] {
    const expiredWorkflowIds: string[] = [];
    const nowMs = readIsoTimestampMs(now);
    for (const workflow of this.workflows.values()) {
      if (
        workflow.expiresAt == null
        || isTerminalWorkflowStatus(workflow.status)
        || readIsoTimestampMs(workflow.expiresAt) > nowMs
      ) {
        continue;
      }
      this.workflows.set(workflow.workflowId, {
        ...workflow,
        status: "expired",
        updatedAt: now,
      });
      expiredWorkflowIds.push(workflow.workflowId);
    }
    return expiredWorkflowIds;
  }

  public withdrawWorkflow(workflowId: string, actorId: string): ComplianceExceptionWorkflow | null {
    return this.transitionWorkflow(workflowId, "withdrawn", actorId);
  }

  public revokeWorkflow(workflowId: string, actorId: string): ComplianceExceptionWorkflow | null {
    return this.transitionWorkflow(workflowId, "revoked", actorId);
  }

  /**
   * Get workflow by ID
   */
  public getWorkflow(workflowId: string): ComplianceExceptionWorkflow | null {
    return this.workflows.get(workflowId) ?? null;
  }

  /**
   * List workflows by status
   */
  public listByStatus(status: ComplianceExceptionStatus): ComplianceExceptionWorkflow[] {
    return [...this.workflows.values()].filter((w) => w.status === status);
  }

  private calculateExpiration(requestedDuration: string, fromDate: string): string | null {
    const baseDate = new Date(fromDate);
    const parsedDurationMs = parseIsoDurationMs(requestedDuration);
    if (parsedDurationMs != null) {
      return new Date(baseDate.getTime() + parsedDurationMs).toISOString();
    }
    return new Date(baseDate.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
  }

  private transitionWorkflow(
    workflowId: string,
    nextStatus: Extract<ComplianceExceptionStatus, "withdrawn" | "revoked">,
    actorId: string,
  ): ComplianceExceptionWorkflow | null {
    const workflow = this.workflows.get(workflowId);
    if (workflow == null) {
      return null;
    }
    if (nextStatus === "withdrawn" && workflow.status !== "pending_review" && workflow.status !== "mitigation_required") {
      throw new Error(`compliance_exception.withdraw_not_allowed:${workflow.status}:${actorId}`);
    }
    if (nextStatus === "revoked" && workflow.status !== "approved") {
      throw new Error(`compliance_exception.revoke_not_allowed:${workflow.status}:${actorId}`);
    }
    const updatedWorkflow: ComplianceExceptionWorkflow = {
      ...workflow,
      status: nextStatus,
      updatedAt: nowIso(),
    };
    this.workflows.set(workflowId, updatedWorkflow);
    return updatedWorkflow;
  }
}

function isTerminalWorkflowStatus(status: ComplianceExceptionStatus): boolean {
  return status === "approved" || status === "rejected" || status === "expired" || status === "withdrawn" || status === "revoked";
}

function readIsoTimestampMs(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`compliance_exception.invalid_timestamp:${value}`);
  }
  return parsed;
}

function parseIsoDurationMs(value: string): number | null {
  const match = /^P(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/i.exec(value.trim());
  if (!match) {
    return null;
  }
  const months = Number(match[1] ?? 0);
  const weeks = Number(match[2] ?? 0);
  const days = Number(match[3] ?? 0);
  const hours = Number(match[4] ?? 0);
  const minutes = Number(match[5] ?? 0);
  const totalMs = (
    months * 30 * 24 * 60 * 60 * 1000
    + weeks * 7 * 24 * 60 * 60 * 1000
    + days * 24 * 60 * 60 * 1000
    + hours * 60 * 60 * 1000
    + minutes * 60 * 1000
  );
  return totalMs > 0 ? totalMs : null;
}
