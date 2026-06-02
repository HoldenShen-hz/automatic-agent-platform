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
  /** Total eligible approvers, used to derive the rejection threshold. */
  totalApprovers?: number;
  /** Optional membership map keyed by group ID. */
  groupMembers?: Readonly<Record<string, readonly string[]>>;
}

export interface PendingApprovalRecord {
  approvalId: string;
  requiredApprovals: number;
  approvalsReceived: number;
  rejectionsReceived: number;
  rejectionsRequired: number;
  decisions: ApprovalDecision[];
  status: "pending" | "approved" | "rejected" | "expired";
}

export class MultiPartyApprovalService {
  private readonly repository: RuntimeLifecycleRepository;
  private readonly pendingApprovals = new Map<string, PendingApprovalRecord>();
  private readonly groupMembers: Readonly<Record<string, readonly string[]>>;

  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    store: AuthoritativeTaskStore,
    repository: RuntimeLifecycleRepository = createRuntimeLifecycleRepository(store),
    options: Pick<MultiPartyApprovalOptions, "groupMembers"> = {},
  ) {
    this.repository = repository;
    this.groupMembers = options.groupMembers ?? {};
  }

  public createMultiPartyRequest(
    request: Omit<ApprovalRequest, "approvalId" | "createdAt" | "requiredApprovals" | "approverGroups" | "approvalsReceived" | "rejectionsReceived" | "rejectionsRequired">,
    options: MultiPartyApprovalOptions = {},
  ): ApprovalRequest {
    const requiredApprovals = options.requiredApprovals ?? 1;
    const approverGroups = options.approverGroups ?? [];
    const totalApprovers = Math.max(options.totalApprovers ?? requiredApprovals, requiredApprovals);
    const rejectionsRequired = Math.max(1, totalApprovers - requiredApprovals + 1);

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
      rejectionsReceived: 0,
      rejectionsRequired,
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
      rejectionsReceived: 0,
      rejectionsRequired,
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
    const existingRequest = this.parseApprovalRequest(existing.requestJson);
    const requiredApprovals = existingRequest.requiredApprovals ?? 1;
    const rejectionsRequired = existingRequest.rejectionsRequired ?? requiredApprovals;
    const knownDecisions = pending?.decisions ?? [];
    if (knownDecisions.some((entry) => entry.respondedBy === decision.respondedBy)) {
      throw new ValidationError("approval.duplicate_approver", `Approver already responded: ${decision.respondedBy}`, {
        details: {
          approvalId: decision.approvalId,
          respondedBy: decision.respondedBy,
        },
      });
    }

    if (pending) {
      pending.decisions.push(decision);
    }

    if (decision.decisionType === "rejected" || decision.decisionType === "expired") {
      const newRejections = (existingRequest.rejectionsReceived ?? pending?.rejectionsReceived ?? 0) + 1;
      if (pending) {
        pending.rejectionsReceived = newRejections;
      }
      this.db.transaction(() => {
        this.repository.updateApprovalRequest({
          id: decision.approvalId,
          requestJson: JSON.stringify({
            ...existingRequest,
            rejectionsReceived: newRejections,
            rejectionsRequired,
          }),
        });
      });
      if (newRejections >= rejectionsRequired) {
        this.finalizeApproval(decision.approvalId, existing, decision, "rejected");
      } else {
        this.repository.insertEvent({
          id: newId("evt"),
          taskId: existing.taskId,
          executionId: existing.executionId,
          eventType: "decision:partial_rejection",
          eventTier: "tier_1",
          payloadJson: JSON.stringify({
            approvalId: decision.approvalId,
            rejectionsReceived: newRejections,
            rejectionsRequired,
            latestDecision: decision,
          }),
          traceId: null,
          createdAt: nowIso(),
        });
      }
      if (pending) {
        pending.status = newRejections >= rejectionsRequired ? "rejected" : "pending";
      }
      return;
    }

    const newCount = (existingRequest.approvalsReceived ?? pending?.approvalsReceived ?? 0) + 1;
    if (pending) {
      pending.approvalsReceived = newCount;
    }

    this.db.transaction(() => {
      this.repository.updateApprovalRequest({
        id: decision.approvalId,
        requestJson: JSON.stringify({
          ...existingRequest,
          approvalsReceived: newCount,
          rejectionsRequired,
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
      const request = this.parseApprovalRequest(existing.requestJson);
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

  public isApproverInGroups(
    approverId: string,
    groups: readonly string[],
    groupMembers: Readonly<Record<string, readonly string[]>> = this.groupMembers,
  ): boolean {
    if (groups.length === 0) {
      return true;
    }
    return groups.some((groupId) => groupMembers[groupId]?.includes(approverId) === true);
  }

  private parseApprovalRequest(requestJson: string): ApprovalRequest {
    try {
      return JSON.parse(requestJson) as ApprovalRequest;
    } catch (error) {
      throw new ValidationError("approval.request_json_invalid", "Stored approval request JSON is invalid", {
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
}
