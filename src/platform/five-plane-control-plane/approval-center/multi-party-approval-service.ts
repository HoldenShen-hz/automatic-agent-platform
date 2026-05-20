/**
 * @fileoverview Multi-Party Approval Service
 *
 * Manages N-of-M approval workflows where multiple approvers must
 * approve before the request is considered approved.
 */

import { newId, nowIso } from "../../contracts/types/ids.js";
import type { ApprovalDecision, ApprovalRequest } from "./approval-service.js";
import { validateApprovalDecision } from "./approval-service.js";
import type { AuthoritativeSqlDatabase } from "../../five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import { createRuntimeLifecycleRepository, type RuntimeLifecycleRepository } from "../../five-plane-state-evidence/truth/repositories/runtime-lifecycle-repository.js";
import { ValidationError } from "../../contracts/errors.js";

export interface MultiPartyApprovalOptions {
  /** Number of approvals required. Default: 1 */
  requiredApprovals?: number;
  /** Groups from which approvers can be selected. Empty means any approver. */
  approverGroups?: readonly string[];
}

export interface PendingApprovalRecord {
  approvalId: string;
  requiredApprovals: number;
  approvalsReceived: number;
  decisions: ApprovalDecision[];
  status: "pending" | "approved" | "rejected" | "expired";
}

export class MultiPartyApprovalService {
  private readonly repository: RuntimeLifecycleRepository;
  private readonly pendingApprovals = new Map<string, PendingApprovalRecord>();

  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    store: AuthoritativeTaskStore,
  ) {
    this.repository = createRuntimeLifecycleRepository(store);
  }

  public createMultiPartyRequest(
    request: Omit<ApprovalRequest, "approvalId" | "createdAt" | "requiredApprovals" | "approverGroups" | "approvalsReceived">,
    options: MultiPartyApprovalOptions = {},
  ): ApprovalRequest {
    const requiredApprovals = options.requiredApprovals ?? 1;
    const approverGroups = options.approverGroups ?? [];

    const approval: ApprovalRequest = {
      approvalId: newId("approval"),
      taskId: request.taskId,
      executionId: request.executionId ?? null,
      sourceAgentId: request.sourceAgentId,
      reason: request.reason,
      riskLevel: request.riskLevel,
      options: request.options,
      context: {
        ...request.context,
        multiPartyEnabled: true,
        originalRequiredApprovals: requiredApprovals,
      },
      timeoutPolicy: request.timeoutPolicy,
      createdAt: nowIso(),
      requiredApprovals,
      approverGroups,
      approvalsReceived: 0,
    };

    this.db.transaction(() => {
      this.repository.insertApproval({
        id: approval.approvalId,
        taskId: approval.taskId,
        executionId: approval.executionId ?? null,
        status: "requested",
        requestJson: JSON.stringify(approval),
        responseJson: null,
        timeoutPolicy: approval.timeoutPolicy,
        createdAt: approval.createdAt,
        respondedAt: null,
      });
      this.repository.insertEvent({
        id: newId("evt"),
        taskId: approval.taskId,
        executionId: approval.executionId ?? null,
        eventType: "decision:requested",
        eventTier: "tier_1",
        payloadJson: JSON.stringify(approval),
        traceId: null,
        createdAt: approval.createdAt,
      });
    });

    this.pendingApprovals.set(approval.approvalId, {
      approvalId: approval.approvalId,
      requiredApprovals,
      approvalsReceived: 0,
      decisions: [],
      status: "pending",
    });

    return approval;
  }

  public applyDecision(decision: ApprovalDecision): void {
    validateApprovalDecision(decision);

    const existing = this.repository.getApproval(decision.approvalId);
    if (!existing) {
      throw new ValidationError("approval.not_found", `Approval not found: ${decision.approvalId}`, {
        details: { approvalId: decision.approvalId },
      });
    }

    if (existing.status !== "requested") {
      return;
    }

    const pending = this.pendingApprovals.get(decision.approvalId);
    const existingRequest = JSON.parse(existing.requestJson) as ApprovalRequest;
    const requiredApprovals = existingRequest.requiredApprovals ?? 1;

    if (pending) {
      pending.decisions.push(decision);
    }

    if (decision.decisionType === "rejected" || decision.decisionType === "expired") {
      this.finalizeApproval(decision.approvalId, existing, decision, "rejected");
      if (pending) {
        pending.status = "rejected";
      }
      return;
    }

    const newCount = (pending?.approvalsReceived ?? 0) + 1;
    if (pending) {
      pending.approvalsReceived = newCount;
    }

    this.db.transaction(() => {
      this.repository.updateApprovalRequest({
        id: decision.approvalId,
        requestJson: JSON.stringify({
          ...existingRequest,
          approvalsReceived: newCount,
        }),
      });
    });

    if (newCount >= requiredApprovals) {
      this.finalizeApproval(decision.approvalId, existing, decision, "approved");
      if (pending) {
        pending.status = "approved";
      }
    } else {
      const remaining = requiredApprovals - newCount;
      this.repository.insertEvent({
        id: newId("evt"),
        taskId: existing.taskId,
        executionId: existing.executionId,
        eventType: "decision:partial_approval",
        eventTier: "tier_1",
        payloadJson: JSON.stringify({
          approvalId: decision.approvalId,
          approvalsReceived: newCount,
          requiredApprovals,
          remaining,
          latestDecision: decision,
        }),
        traceId: null,
        createdAt: nowIso(),
      });
    }
  }

  private finalizeApproval(
    approvalId: string,
    existing: { id: string; taskId: string; executionId: string | null; status: string },
    decision: ApprovalDecision,
    finalStatus: "approved" | "rejected",
  ): void {
    const affected = this.repository.updateApprovalDecisionCas({
      approvalId,
      expectedStatus: existing.status as "approved" | "rejected" | "requested" | "expired" | "cancelled",
      status: finalStatus,
      responseJson: JSON.stringify(decision),
      respondedAt: decision.respondedAt,
    });
    if (affected === 0) {
      throw new ValidationError(
        "approval.transition_cas_failed",
        `Approval transition CAS failed: ${approvalId}:${existing.status}->${finalStatus}`,
        {
          details: {
            approvalId,
            fromStatus: existing.status,
            toStatus: finalStatus,
          },
        },
      );
    }

    this.repository.insertEvent({
      id: newId("evt"),
      taskId: existing.taskId,
      executionId: existing.executionId,
      eventType: finalStatus === "approved" ? "decision:approved" : "decision:rejected",
      eventTier: "tier_1",
      payloadJson: JSON.stringify(decision),
      traceId: null,
      createdAt: nowIso(),
    });
  }

  public getPendingApproval(approvalId: string): PendingApprovalRecord | null {
    return this.pendingApprovals.get(approvalId) ?? null;
  }

  public getApprovalProgress(approvalId: string): { received: number; required: number; remaining: number } | null {
    const pending = this.pendingApprovals.get(approvalId);
    if (!pending) {
      const existing = this.repository.getApproval(approvalId);
      if (!existing) {
        return null;
      }
      const request = JSON.parse(existing.requestJson) as ApprovalRequest;
      return {
        received: request.approvalsReceived ?? 0,
        required: request.requiredApprovals ?? 1,
        remaining: (request.requiredApprovals ?? 1) - (request.approvalsReceived ?? 0),
      };
    }
    return {
      received: pending.approvalsReceived,
      required: pending.requiredApprovals,
      remaining: pending.requiredApprovals - pending.approvalsReceived,
    };
  }

  public isApproverInGroups(approverId: string, groups: readonly string[]): boolean {
    if (groups.length === 0) {
      return true;
    }
    return groups.includes(approverId);
  }
}
