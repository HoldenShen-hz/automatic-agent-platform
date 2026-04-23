/**
 * @fileoverview Approval Flow Engine
 *
 * Main orchestration for approval flows with FeedbackLoop support.
 * Coordinates quorum-based voting, escalation, delegation, and
 * iterative feedback loops for §21 HITL architecture.
 *
 * @see §21 HITL Architecture - Approval Flow Engine
 */
import { newId, nowIso } from "../../contracts/types/ids.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { ValidationError } from "../../contracts/errors.js";
import { VoteType, createInitialQuorumStatus, calculateQuorumStatus, mergeVotes, createVote, determineFinalStatus, validateVote, hasApproverVoted, getApproverVote, } from "./quorum-calculator.js";
import { EscalationManager, EscalationReason, NotificationPriority, } from "./escalation-manager.js";
/**
 * Flow types supported by the approval engine.
 */
export var FlowType;
(function (FlowType) {
    FlowType["SINGLE"] = "single";
    FlowType["MULTI_PARTY"] = "multi_party";
    FlowType["DELEGATED"] = "delegated";
    FlowType["SEQUENTIAL_CHAIN"] = "sequential_chain";
})(FlowType || (FlowType = {}));
/**
 * Status of an approval flow.
 */
export var FlowStatus;
(function (FlowStatus) {
    FlowStatus["PENDING"] = "pending";
    FlowStatus["APPROVED"] = "approved";
    FlowStatus["REJECTED"] = "rejected";
    FlowStatus["EXPIRED"] = "expired";
    FlowStatus["ESCALATED"] = "escalated";
    FlowStatus["MAX_ITERATIONS_REACHED"] = "max_iterations_reached";
    FlowStatus["CANCELLED"] = "cancelled";
})(FlowStatus || (FlowStatus = {}));
/**
 * Default timeout configuration (1 hour warn, 2 hours escalate, 24 hours auto-action).
 */
const DEFAULT_TIMEOUT_CONFIG = {
    warnAfterMs: 60 * 60 * 1000,
    escalateAfterMs: 2 * 60 * 60 * 1000,
    autoActionAfterMs: 24 * 60 * 60 * 1000,
    autoAction: "deny",
};
/**
 * Default escalation rule.
 */
const DEFAULT_ESCALATION_RULE = {
    escalateTo: { type: "role", identifier: "admin", can_delegate: true },
    maxEscalationDepth: 3,
    notificationChannels: [],
    escalationTimeoutMs: 30 * 60 * 1000,
};
/**
 * Default feedback loop configuration.
 */
const DEFAULT_FEEDBACK_LOOP_CONFIG = {
    maxIterations: 5,
    requireReplanOnReject: true,
};
/**
 * Approval Flow Engine - orchestrates the complete approval lifecycle.
 */
export class ApprovalFlowEngine {
    logger = new StructuredLogger({ retentionLimit: 50 });
    flows = new Map();
    escalationManager;
    // C-11: TTL-based eviction to prevent memory leaks
    MAX_FLOWS = 500;
    FLOW_TTL_MS = 60 * 60 * 1000; // 1 hour
    lastEvictionTime = 0;
    EVICTION_INTERVAL_MS = 60 * 1000; // Once per minute
    constructor(escalationManager) {
        this.escalationManager = escalationManager ?? new EscalationManager();
    }
    /**
     * C-11: Evict expired approval flows to prevent memory leaks.
     */
    evictExpiredFlows() {
        const now = Date.now();
        if (now - this.lastEvictionTime < this.EVICTION_INTERVAL_MS) {
            return;
        }
        this.lastEvictionTime = now;
        const expiryThreshold = now - this.FLOW_TTL_MS;
        const entriesToDelete = [];
        for (const [flowId, flow] of this.flows) {
            // Evict flows that are in terminal state and older than TTL
            const isTerminal = flow.status === FlowStatus.APPROVED ||
                flow.status === FlowStatus.REJECTED ||
                flow.status === FlowStatus.EXPIRED ||
                flow.status === FlowStatus.CANCELLED ||
                flow.status === FlowStatus.MAX_ITERATIONS_REACHED;
            if (isTerminal) {
                const updatedAt = new Date(flow.updatedAt).getTime();
                if (updatedAt < expiryThreshold) {
                    entriesToDelete.push(flowId);
                }
            }
        }
        for (const flowId of entriesToDelete) {
            this.flows.delete(flowId);
        }
        // If still over capacity, remove oldest terminal flows
        if (this.flows.size > this.MAX_FLOWS) {
            const sortedEntries = [...this.flows.entries()].sort((a, b) => {
                const aTime = new Date(a[1].updatedAt).getTime();
                const bTime = new Date(b[1].updatedAt).getTime();
                return aTime - bTime;
            });
            const toRemove = this.flows.size - this.MAX_FLOWS;
            for (let i = 0; i < toRemove; i++) {
                this.flows.delete(sortedEntries[i][0]);
            }
        }
    }
    /**
     * Creates a new approval flow.
     *
     * @param config - Flow configuration
     * @param request - The approval request
     * @param options - Optional overrides for defaults
     * @returns The created flow state
     */
    createFlow(config, request, options = undefined) {
        // C-11: Evict expired flows before creating new one
        this.evictExpiredFlows();
        const flowId = newId("flow");
        const now = nowIso();
        // Calculate expiration time
        let expiresAt = null;
        if (config.timeout?.autoActionAfterMs) {
            expiresAt = new Date(Date.now() + config.timeout.autoActionAfterMs).toISOString();
        }
        // Build effective config with defaults
        const effectiveConfig = {
            ...config,
            flowId,
            timeout: config.timeout ?? DEFAULT_TIMEOUT_CONFIG,
            escalation: config.escalation ?? DEFAULT_ESCALATION_RULE,
            feedbackLoop: config.feedbackLoop ?? DEFAULT_FEEDBACK_LOOP_CONFIG,
        };
        // Initialize feedback loop if configured
        let feedbackLoop = null;
        if (effectiveConfig.feedbackLoop) {
            feedbackLoop = {
                loopId: newId("feedback"),
                workflowRunId: options?.workflowRunId ?? request.taskId,
                stepId: options?.stepId ?? "",
                maxIterations: effectiveConfig.feedbackLoop.maxIterations,
                currentIteration: 0,
                humanFeedback: [],
            };
        }
        const state = {
            flowId,
            config: effectiveConfig,
            request,
            status: FlowStatus.PENDING,
            currentIteration: 0,
            votes: [],
            votingStartedAt: now,
            escalationHistory: [],
            delegation: null,
            feedbackLoop,
            createdAt: now,
            updatedAt: now,
            expiresAt,
            warningsSent: [],
            escalationTriggered: false,
        };
        this.flows.set(flowId, state);
        this.logger.info("Approval flow created", {
            flowId,
            flowType: effectiveConfig.flowType,
            requestId: request.approvalId,
            taskId: request.taskId,
            approvers: effectiveConfig.approvers.length,
            hasQuorum: !!effectiveConfig.quorum,
        });
        // Notify channels of new approval request
        this.notifyFlowCreated(state);
        return state;
    }
    /**
     * Submits a vote to an approval flow.
     *
     * @param flowId - Flow to vote on
     * @param approverId - ID of the approver
     * @param voteType - Type of vote
     * @param decision - Optional approval decision for single-party flows
     * @returns Result of the vote
     */
    submitVote(flowId, approverId, voteType, decision) {
        const flow = this.flows.get(flowId);
        if (!flow) {
            return { success: false, quorumStatus: createInitialQuorumStatus(), flowStatus: FlowStatus.PENDING, error: "Flow not found" };
        }
        if (flow.status !== FlowStatus.PENDING) {
            return {
                success: false,
                quorumStatus: createInitialQuorumStatus(),
                flowStatus: flow.status,
                error: `Flow is not pending (current status: ${flow.status})`,
            };
        }
        // Check if delegation is active and valid
        if (flow.delegation) {
            const isExpired = this.escalationManager.isDelegationExpired(flow.delegation);
            if (isExpired) {
                return {
                    success: false,
                    quorumStatus: createInitialQuorumStatus(),
                    flowStatus: flow.status,
                    error: "Delegation has expired",
                };
            }
        }
        // Create and validate the vote
        const delegationSource = flow.delegation?.fromApprover;
        const vote = createVote(approverId, voteType, delegationSource);
        try {
            validateVote(vote);
        }
        catch (err) {
            return {
                success: false,
                quorumStatus: createInitialQuorumStatus(),
                flowStatus: flow.status,
                error: err instanceof Error ? err.message : "Invalid vote",
            };
        }
        // For single-party flow, directly apply decision
        if (flow.config.flowType === FlowType.SINGLE) {
            return this.applySinglePartyVote(flow, vote, decision);
        }
        // For multi-party flow, use quorum calculation
        if (flow.config.flowType === FlowType.MULTI_PARTY && flow.config.quorum) {
            return this.applyMultiPartyVote(flow, vote);
        }
        return {
            success: false,
            quorumStatus: createInitialQuorumStatus(),
            flowStatus: flow.status,
            error: "Unsupported flow type or missing quorum config",
        };
    }
    /**
     * Applies a vote to a single-party flow.
     */
    applySinglePartyVote(flow, vote, decision) {
        let flowStatus = flow.status;
        if (vote.voteType === VoteType.APPROVE) {
            flowStatus = FlowStatus.APPROVED;
        }
        else if (vote.voteType === VoteType.REJECT) {
            flowStatus = FlowStatus.REJECTED;
        }
        // Update flow
        flow.votes.push(vote);
        flow.status = flowStatus;
        flow.updatedAt = nowIso();
        this.logger.info("Single-party vote applied", {
            flowId: flow.flowId,
            approverId: vote.approverId,
            voteType: vote.voteType,
            newStatus: flowStatus,
        });
        const quorumStatus = calculateQuorumStatus(flow.votes, { minApprovals: 1, minRejectionsToDeny: 1 }, flow.votingStartedAt, nowIso());
        return { success: true, quorumStatus, flowStatus };
    }
    /**
     * Applies a vote to a multi-party flow using quorum.
     */
    applyMultiPartyVote(flow, vote) {
        if (!flow.config.quorum) {
            return {
                success: false,
                quorumStatus: createInitialQuorumStatus(),
                flowStatus: flow.status,
                error: "Quorum config required for multi-party flow",
            };
        }
        // Check if approver has already voted
        if (hasApproverVoted(flow.votes, vote.approverId)) {
            const existingVote = getApproverVote(flow.votes, vote.approverId);
            if (existingVote?.voteType === vote.voteType) {
                return {
                    success: false,
                    quorumStatus: createInitialQuorumStatus(),
                    flowStatus: flow.status,
                    error: "Approver has already cast the same vote",
                };
            }
        }
        // Merge vote and calculate status
        const mergedVotes = mergeVotes(flow.votes, vote);
        const quorumStatus = calculateQuorumStatus(mergedVotes, flow.config.quorum, flow.votingStartedAt, nowIso());
        // Update flow
        flow.votes = mergedVotes;
        flow.updatedAt = nowIso();
        // Determine if flow should be finalized
        const finalStatus = determineFinalStatus(quorumStatus, flow.config.quorum);
        if (finalStatus !== "pending") {
            flow.status = finalStatus === "approved" ? FlowStatus.APPROVED : FlowStatus.REJECTED;
        }
        this.logger.info("Multi-party vote applied", {
            flowId: flow.flowId,
            approverId: vote.approverId,
            voteType: vote.voteType,
            quorumStatus,
            newFlowStatus: flow.status,
        });
        return { success: true, quorumStatus, flowStatus: flow.status };
    }
    /**
     * Delegates approval from one approver to another.
     * Resets the TTL for the delegation.
     *
     * @param flowId - Flow to delegate
     * @param fromApprover - Current approver
     * @param toApprover - New approver to delegate to
     * @param ttlMs - Optional TTL override
     * @returns The created delegation or error
     */
    delegateApproval(flowId, fromApprover, toApprover, ttlMs) {
        const flow = this.flows.get(flowId);
        if (!flow) {
            return { success: false, error: "Flow not found" };
        }
        if (flow.status !== FlowStatus.PENDING) {
            return { success: false, error: "Flow is not pending" };
        }
        // Check if approver can delegate
        const approverRule = flow.config.approvers.find((a) => a.identifier === fromApprover || a.type === "user");
        if (approverRule && !approverRule.can_delegate) {
            return { success: false, error: "Approver cannot delegate" };
        }
        // Create or update delegation
        let delegation;
        if (flow.delegation) {
            // Reset TTL on existing delegation
            try {
                delegation = this.escalationManager.resetDelegationTtl(flow.delegation, ttlMs);
                flow.delegation = delegation;
            }
            catch (err) {
                return {
                    success: false,
                    error: err instanceof Error ? err.message : "Failed to reset delegation TTL",
                };
            }
        }
        else {
            // Create new delegation
            try {
                delegation = this.escalationManager.createDelegation(fromApprover, toApprover, flow.request.approvalId, ttlMs);
                flow.delegation = delegation;
            }
            catch (err) {
                return {
                    success: false,
                    error: err instanceof Error ? err.message : "Failed to create delegation",
                };
            }
        }
        flow.updatedAt = nowIso();
        this.logger.info("Approval delegated", {
            flowId,
            fromApprover,
            toApprover,
            delegationId: delegation.delegationId,
        });
        return { success: true, delegation };
    }
    /**
     * Checks if an approval flow should be escalated.
     *
     * @param flowId - Flow to check
     * @returns Escalation context if escalation is needed, null otherwise
     */
    checkEscalation(flowId) {
        const flow = this.flows.get(flowId);
        if (!flow) {
            return null;
        }
        if (flow.status !== FlowStatus.PENDING) {
            return null;
        }
        if (flow.escalationTriggered) {
            return null;
        }
        const currentLevel = flow.escalationHistory.length;
        if (!this.escalationManager.canEscalate(currentLevel, flow.config.escalation.maxEscalationDepth)) {
            return null;
        }
        // Check if timeout has exceeded escalate threshold
        const createdAtMs = new Date(flow.createdAt).getTime();
        const nowMs = Date.now();
        const elapsedMs = nowMs - createdAtMs;
        if (elapsedMs >= flow.config.timeout.escalateAfterMs) {
            return {
                approvalId: flow.request.approvalId,
                taskId: flow.request.taskId,
                executionId: flow.request.executionId ?? null,
                currentLevel,
                reason: EscalationReason.TIMEOUT,
            };
        }
        // Check quorum not met after voting window
        if (flow.config.quorum && flow.config.quorum.votingWindowMs) {
            const votingStartedMs = new Date(flow.votingStartedAt).getTime();
            const votingElapsed = nowMs - votingStartedMs;
            if (votingElapsed >= flow.config.quorum.votingWindowMs) {
                const quorumStatus = calculateQuorumStatus(flow.votes, flow.config.quorum, flow.votingStartedAt, nowIso());
                if (!quorumStatus.isQuorumMet && !quorumStatus.isDenied) {
                    return {
                        approvalId: flow.request.approvalId,
                        taskId: flow.request.taskId,
                        executionId: flow.request.executionId ?? null,
                        currentLevel,
                        reason: EscalationReason.QUORUM_NOT_MET,
                    };
                }
            }
        }
        return null;
    }
    /**
     * Triggers escalation for an approval flow.
     *
     * @param flowId - Flow to escalate
     * @returns Escalation result
     */
    async triggerEscalation(flowId) {
        const context = this.checkEscalation(flowId);
        if (!context) {
            return { success: false, error: "Escalation not needed" };
        }
        const flow = this.flows.get(flowId);
        if (!flow) {
            return { success: false, error: "Flow not found" };
        }
        const result = await this.escalationManager.escalate(context, flow.config.escalation);
        if (!result.success || !result.newLevel) {
            return { success: false, error: result.error ?? "Escalation failed" };
        }
        flow.escalationHistory.push({
            level: result.newLevel.level,
            escalateTo: result.newLevel.escalateTo,
            escalatedAt: result.newLevel.escalatedAt,
            escalatedBy: result.newLevel.escalatedBy,
            reason: result.newLevel.reason,
            sourceApprovalId: result.newLevel.sourceApprovalId,
        });
        flow.status = FlowStatus.ESCALATED;
        flow.escalationTriggered = true;
        flow.updatedAt = nowIso();
        return { success: true };
    }
    /**
     * Adds feedback to a feedback loop.
     *
     * @param flowId - Flow to add feedback to
     * @param feedback - Human feedback
     * @returns Feedback result
     */
    addFeedback(flowId, feedback) {
        const flow = this.flows.get(flowId);
        if (!flow) {
            return {
                success: false,
                newIteration: 0,
                flowStatus: FlowStatus.PENDING,
                shouldReplan: false,
                error: "Flow not found",
            };
        }
        if (!flow.feedbackLoop) {
            return {
                success: false,
                newIteration: 0,
                flowStatus: flow.status,
                shouldReplan: false,
                error: "Feedback loop not configured",
            };
        }
        if (flow.status !== FlowStatus.PENDING) {
            return {
                success: false,
                newIteration: flow.feedbackLoop.currentIteration,
                flowStatus: flow.status,
                shouldReplan: false,
                error: `Flow is not pending (status: ${flow.status})`,
            };
        }
        // Check max iterations
        if (flow.feedbackLoop.currentIteration >= flow.feedbackLoop.maxIterations) {
            flow.status = FlowStatus.MAX_ITERATIONS_REACHED;
            flow.updatedAt = nowIso();
            return {
                success: false,
                newIteration: flow.feedbackLoop.currentIteration,
                flowStatus: flow.status,
                shouldReplan: false,
                error: "Max iterations reached",
            };
        }
        const newIteration = flow.feedbackLoop.currentIteration + 1;
        const fullFeedback = {
            ...feedback,
            iteration: newIteration,
            timestamp: nowIso(),
        };
        flow.feedbackLoop.humanFeedback.push(fullFeedback);
        flow.feedbackLoop.currentIteration = newIteration;
        flow.updatedAt = nowIso();
        this.logger.info("Feedback added", {
            flowId,
            iteration: newIteration,
            feedbackType: feedback.feedbackType,
            principal: feedback.principal,
        });
        // If approved or modify_directly, finalize flow
        if (feedback.feedbackType === "approve") {
            flow.status = FlowStatus.APPROVED;
            return {
                success: true,
                newIteration,
                flowStatus: flow.status,
                shouldReplan: false,
            };
        }
        // Check if replan is needed
        const shouldReplan = feedback.feedbackType === "reject_with_guidance" &&
            (flow.config.feedbackLoop?.requireReplanOnReject ?? false);
        return {
            success: true,
            newIteration,
            flowStatus: flow.status,
            shouldReplan,
        };
    }
    /**
     * Checks if max iterations has been reached for a flow.
     *
     * @param flowId - Flow to check
     * @returns True if max iterations reached
     */
    checkMaxIterations(flowId) {
        const flow = this.flows.get(flowId);
        if (!flow || !flow.feedbackLoop) {
            return false;
        }
        return flow.feedbackLoop.currentIteration >= flow.feedbackLoop.maxIterations;
    }
    /**
     * Finalizes a flow with a specific status.
     *
     * @param flowId - Flow to finalize
     * @param finalStatus - Status to set
     */
    finalizeFlow(flowId, finalStatus) {
        const flow = this.flows.get(flowId);
        if (!flow) {
            throw new ValidationError("flow.not_found", `Flow not found: ${flowId}`);
        }
        flow.status = finalStatus;
        flow.updatedAt = nowIso();
        this.logger.info("Flow finalized", { flowId, finalStatus });
        // Notify channels of finalization
        this.notifyFlowFinalized(flow);
    }
    /**
     * Gets the current state of a flow.
     *
     * @param flowId - Flow to get
     * @returns Flow state or undefined
     */
    getFlowStatus(flowId) {
        return this.flows.get(flowId) ?? null;
    }
    /**
     * Gets the quorum status for a flow.
     *
     * @param flowId - Flow to check
     * @returns Quorum status or undefined
     */
    getQuorumStatus(flowId) {
        const flow = this.flows.get(flowId);
        if (!flow || !flow.config.quorum) {
            return null;
        }
        return calculateQuorumStatus(flow.votes, flow.config.quorum, flow.votingStartedAt, nowIso());
    }
    /**
     * Gets all flows for a task.
     *
     * @param taskId - Task to find flows for
     * @returns Array of flow states
     */
    getFlowsForTask(taskId) {
        const flows = [];
        for (const flow of this.flows.values()) {
            if (flow.request.taskId === taskId) {
                flows.push(flow);
            }
        }
        return flows;
    }
    /**
     * Gets all pending flows.
     *
     * @returns Array of pending flow states
     */
    getPendingFlows() {
        const pending = [];
        for (const flow of this.flows.values()) {
            if (flow.status === FlowStatus.PENDING) {
                pending.push(flow);
            }
        }
        return pending;
    }
    /**
     * Notifies channels that a flow was created.
     */
    notifyFlowCreated(flow) {
        const channels = flow.config.notificationChannels ?? flow.config.escalation.notificationChannels;
        if (channels.length === 0)
            return;
        this.escalationManager.notifyChannels(channels, {
            title: `Approval Request - ${flow.request.reason}`,
            body: `Task: ${flow.request.taskId}\nRisk Level: ${flow.request.riskLevel}\nApprovers: ${flow.config.approvers.map((a) => a.identifier).join(", ")}`,
            metadata: {
                flowId: flow.flowId,
                taskId: flow.request.taskId,
                approvalId: flow.request.approvalId,
                flowType: flow.config.flowType,
            },
            priority: NotificationPriority.NORMAL,
        });
    }
    /**
     * Notifies channels that a flow was finalized.
     */
    notifyFlowFinalized(flow) {
        const channels = flow.config.notificationChannels ?? flow.config.escalation.notificationChannels;
        if (channels.length === 0)
            return;
        const title = flow.status === FlowStatus.APPROVED
            ? `Approval Approved - ${flow.request.reason}`
            : flow.status === FlowStatus.REJECTED
                ? `Approval Rejected - ${flow.request.reason}`
                : `Approval ${flow.status} - ${flow.request.reason}`;
        this.escalationManager.notifyChannels(channels, {
            title,
            body: `Task: ${flow.request.taskId}\nStatus: ${flow.status}\nFlow ID: ${flow.flowId}`,
            metadata: {
                flowId: flow.flowId,
                taskId: flow.request.taskId,
                approvalId: flow.request.approvalId,
                finalStatus: flow.status,
            },
            priority: NotificationPriority.HIGH,
        });
    }
    /**
     * Creates a multi-party flow with quorum configuration.
     *
     * @param request - Approval request
     * @param requiredApprovals - Number of approvals required
     * @param approvers - List of approver rules
     * @param options - Optional configuration
     * @returns The created flow state
     */
    createMultiPartyFlow(request, requiredApprovals, approvers, options) {
        const quorumConfig = {
            minApprovals: requiredApprovals,
            minRejectionsToDeny: options?.minRejectionsToDeny ?? requiredApprovals,
        };
        if (options?.votingWindowMs !== undefined) {
            quorumConfig.votingWindowMs = options.votingWindowMs;
        }
        return this.createFlow({
            flowType: FlowType.MULTI_PARTY,
            approvers,
            quorum: quorumConfig,
            timeout: DEFAULT_TIMEOUT_CONFIG,
            escalation: DEFAULT_ESCALATION_RULE,
            feedbackLoop: DEFAULT_FEEDBACK_LOOP_CONFIG,
        }, request, options);
    }
    /**
     * Creates a single-party flow.
     *
     * @param request - Approval request
     * @param approver - Single approver rule
     * @param options - Optional configuration
     * @returns The created flow state
     */
    createSinglePartyFlow(request, approver, options) {
        return this.createFlow({
            flowType: FlowType.SINGLE,
            approvers: [approver],
            timeout: DEFAULT_TIMEOUT_CONFIG,
            escalation: DEFAULT_ESCALATION_RULE,
            feedbackLoop: DEFAULT_FEEDBACK_LOOP_CONFIG,
        }, request, options);
    }
}
//# sourceMappingURL=approval-flow-engine.js.map