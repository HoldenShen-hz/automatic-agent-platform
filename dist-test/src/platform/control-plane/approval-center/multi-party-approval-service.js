/**
 * @fileoverview Multi-Party Approval Service
 *
 * Manages N-of-M approval workflows where multiple approvers must
 * approve before the request is considered approved.
 */
import { newId, nowIso } from "../../contracts/types/ids.js";
import { validateApprovalDecision } from "./approval-service.js";
import { createRuntimeLifecycleRepository } from "../../state-evidence/truth/repositories/runtime-lifecycle-repository.js";
import { TransitionService } from "../../execution/state-transition/transition-service.js";
import { ValidationError } from "../../contracts/errors.js";
export class MultiPartyApprovalService {
    db;
    repository;
    transitions;
    pendingApprovals = new Map();
    constructor(db, store) {
        this.db = db;
        this.repository = createRuntimeLifecycleRepository(store);
        this.transitions = new TransitionService(db, store, this.repository);
    }
    createMultiPartyRequest(request, options = {}) {
        const requiredApprovals = options.requiredApprovals ?? 1;
        const approverGroups = options.approverGroups ?? [];
        const approval = {
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
    applyDecision(decision) {
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
        const existingRequest = JSON.parse(existing.requestJson);
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
        }
        else {
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
    finalizeApproval(approvalId, existing, decision, finalStatus) {
        this.transitions.transitionApprovalStatus({
            entityKind: "approval",
            entityId: approvalId,
            fromStatus: existing.status,
            toStatus: finalStatus,
            responseJson: JSON.stringify(decision),
            reasonCode: `approval.multi_party_${finalStatus}`,
            traceId: existing.executionId ?? existing.taskId,
            actorType: decision.respondedBy === "system" ? "system" : "user",
            actorId: decision.respondedBy,
            occurredAt: decision.respondedAt,
        });
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
    getPendingApproval(approvalId) {
        return this.pendingApprovals.get(approvalId) ?? null;
    }
    getApprovalProgress(approvalId) {
        const pending = this.pendingApprovals.get(approvalId);
        if (!pending) {
            const existing = this.repository.getApproval(approvalId);
            if (!existing) {
                return null;
            }
            const request = JSON.parse(existing.requestJson);
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
    isApproverInGroups(approverId, groups) {
        if (groups.length === 0) {
            return true;
        }
        return groups.includes(approverId);
    }
}
//# sourceMappingURL=multi-party-approval-service.js.map