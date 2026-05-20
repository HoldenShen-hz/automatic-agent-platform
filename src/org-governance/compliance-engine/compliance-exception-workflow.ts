import { newId, nowIso } from "../../platform/contracts/types/ids.js";

/**
 * R9-38: ComplianceExceptionWorkflow - handles exceptions to compliance requirements
 */
export type ComplianceExceptionStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "expired"
  | "mitigation_required";

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

    if (new Date(workflow.expiresAt).getTime() < Date.now()) {
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
    try {
      // Parse ISO 8601 duration (e.g., "P90D" for 90 days)
      const match = /^P(\d+)D$/.exec(requestedDuration);
      if (match) {
        const days = parseInt(match[1]!, 10);
        const expiresAt = new Date(fromDate);
        expiresAt.setDate(expiresAt.getDate() + days);
        return expiresAt.toISOString();
      }
    } catch {
      // Invalid duration format
    }
    // Default to 90 days if no valid duration specified
    const defaultExpires = new Date(fromDate);
    defaultExpires.setDate(defaultExpires.getDate() + 90);
    return defaultExpires.toISOString();
  }
}
