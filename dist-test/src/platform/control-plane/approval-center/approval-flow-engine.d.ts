/**
 * @fileoverview Approval Flow Engine
 *
 * Main orchestration for approval flows with FeedbackLoop support.
 * Coordinates quorum-based voting, escalation, delegation, and
 * iterative feedback loops for §21 HITL architecture.
 *
 * @see §21 HITL Architecture - Approval Flow Engine
 */
import type { ApprovalRequest, ApprovalDecision } from "./approval-service.js";
import { QuorumConfig, QuorumVote, QuorumStatus, VoteType } from "./quorum-calculator.js";
import { EscalationManager, EscalationRule, EscalationContext, EscalationReason, Delegation, NotificationChannel, ApproverRule } from "./escalation-manager.js";
/**
 * Flow types supported by the approval engine.
 */
export declare enum FlowType {
    SINGLE = "single",
    MULTI_PARTY = "multi_party",
    DELEGATED = "delegated",
    SEQUENTIAL_CHAIN = "sequential_chain"
}
/**
 * Status of an approval flow.
 */
export declare enum FlowStatus {
    PENDING = "pending",
    APPROVED = "approved",
    REJECTED = "rejected",
    EXPIRED = "expired",
    ESCALATED = "escalated",
    MAX_ITERATIONS_REACHED = "max_iterations_reached",
    CANCELLED = "cancelled"
}
/**
 * Configuration for approval timeout.
 */
export interface ApprovalTimeoutConfig {
    warnAfterMs: number;
    escalateAfterMs: number;
    autoActionAfterMs: number;
    autoAction: "approve" | "deny" | "escalate";
}
/**
 * Configuration for feedback loop.
 */
export interface FeedbackLoopConfig {
    maxIterations: number;
    requireReplanOnReject: boolean;
}
/**
 * Configuration for an approval flow.
 */
export interface ApprovalFlowConfig {
    flowId: string;
    flowType: FlowType;
    approvers: ApproverRule[];
    quorum?: QuorumConfig;
    timeout: ApprovalTimeoutConfig;
    escalation: EscalationRule;
    feedbackLoop?: FeedbackLoopConfig;
    /** Notification channels to use */
    notificationChannels?: NotificationChannel[];
}
/**
 * Human feedback in a feedback loop.
 */
export interface HumanFeedback {
    iteration: number;
    feedbackType: "approve" | "reject_with_guidance" | "modify_directly";
    guidance?: string;
    modifiedArtifactRef?: string;
    timestamp: string;
    principal: string;
}
/**
 * Feedback loop state.
 */
export interface FeedbackLoop {
    loopId: string;
    workflowRunId: string;
    stepId: string;
    maxIterations: number;
    currentIteration: number;
    humanFeedback: HumanFeedback[];
}
/**
 * State of an approval flow.
 */
export interface ApprovalFlowState {
    flowId: string;
    config: ApprovalFlowConfig;
    request: ApprovalRequest;
    status: FlowStatus;
    currentIteration: number;
    votes: QuorumVote[];
    votingStartedAt: string;
    escalationHistory: FlowEscalationLevel[];
    delegation: Delegation | null;
    feedbackLoop: FeedbackLoop | null;
    createdAt: string;
    updatedAt: string;
    expiresAt: string | null;
    /** Warnings sent */
    warningsSent: string[];
    /** Whether escalation has been triggered */
    escalationTriggered: boolean;
}
/**
 * A single escalation level in the flow history.
 * This is a simplified version for flow tracking.
 */
export interface FlowEscalationLevel {
    level: number;
    escalateTo: ApproverRule;
    escalatedAt: string;
    escalatedBy: string;
    reason: EscalationReason;
    /** Source approval that triggered this escalation */
    sourceApprovalId: string;
}
/**
 * Result of submitting a vote.
 */
export interface VoteResult {
    success: boolean;
    quorumStatus: QuorumStatus;
    flowStatus: FlowStatus;
    error?: string;
}
/**
 * Result of adding feedback.
 */
export interface FeedbackResult {
    success: boolean;
    newIteration: number;
    flowStatus: FlowStatus;
    shouldReplan: boolean;
    error?: string;
}
/**
 * Approval Flow Engine - orchestrates the complete approval lifecycle.
 */
export declare class ApprovalFlowEngine {
    private readonly logger;
    private readonly flows;
    private readonly escalationManager;
    private readonly MAX_FLOWS;
    private readonly FLOW_TTL_MS;
    private lastEvictionTime;
    private readonly EVICTION_INTERVAL_MS;
    constructor(escalationManager?: EscalationManager);
    /**
     * C-11: Evict expired approval flows to prevent memory leaks.
     */
    private evictExpiredFlows;
    /**
     * Creates a new approval flow.
     *
     * @param config - Flow configuration
     * @param request - The approval request
     * @param options - Optional overrides for defaults
     * @returns The created flow state
     */
    createFlow(config: Omit<ApprovalFlowConfig, "flowId">, request: ApprovalRequest, options?: {
        workflowRunId?: string;
        stepId?: string;
        initialDelegationTtlMs?: number;
    } | undefined): ApprovalFlowState;
    /**
     * Submits a vote to an approval flow.
     *
     * @param flowId - Flow to vote on
     * @param approverId - ID of the approver
     * @param voteType - Type of vote
     * @param decision - Optional approval decision for single-party flows
     * @returns Result of the vote
     */
    submitVote(flowId: string, approverId: string, voteType: VoteType, decision?: ApprovalDecision): VoteResult;
    /**
     * Applies a vote to a single-party flow.
     */
    private applySinglePartyVote;
    /**
     * Applies a vote to a multi-party flow using quorum.
     */
    private applyMultiPartyVote;
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
    delegateApproval(flowId: string, fromApprover: string, toApprover: string, ttlMs?: number): {
        success: boolean;
        delegation?: Delegation;
        error?: string;
    };
    /**
     * Checks if an approval flow should be escalated.
     *
     * @param flowId - Flow to check
     * @returns Escalation context if escalation is needed, null otherwise
     */
    checkEscalation(flowId: string): EscalationContext | null;
    /**
     * Triggers escalation for an approval flow.
     *
     * @param flowId - Flow to escalate
     * @returns Escalation result
     */
    triggerEscalation(flowId: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Adds feedback to a feedback loop.
     *
     * @param flowId - Flow to add feedback to
     * @param feedback - Human feedback
     * @returns Feedback result
     */
    addFeedback(flowId: string, feedback: Omit<HumanFeedback, "iteration" | "timestamp">): FeedbackResult;
    /**
     * Checks if max iterations has been reached for a flow.
     *
     * @param flowId - Flow to check
     * @returns True if max iterations reached
     */
    checkMaxIterations(flowId: string): boolean;
    /**
     * Finalizes a flow with a specific status.
     *
     * @param flowId - Flow to finalize
     * @param finalStatus - Status to set
     */
    finalizeFlow(flowId: string, finalStatus: FlowStatus): void;
    /**
     * Gets the current state of a flow.
     *
     * @param flowId - Flow to get
     * @returns Flow state or undefined
     */
    getFlowStatus(flowId: string): ApprovalFlowState | null;
    /**
     * Gets the quorum status for a flow.
     *
     * @param flowId - Flow to check
     * @returns Quorum status or undefined
     */
    getQuorumStatus(flowId: string): QuorumStatus | null;
    /**
     * Gets all flows for a task.
     *
     * @param taskId - Task to find flows for
     * @returns Array of flow states
     */
    getFlowsForTask(taskId: string): ApprovalFlowState[];
    /**
     * Gets all pending flows.
     *
     * @returns Array of pending flow states
     */
    getPendingFlows(): ApprovalFlowState[];
    /**
     * Notifies channels that a flow was created.
     */
    private notifyFlowCreated;
    /**
     * Notifies channels that a flow was finalized.
     */
    private notifyFlowFinalized;
    /**
     * Creates a multi-party flow with quorum configuration.
     *
     * @param request - Approval request
     * @param requiredApprovals - Number of approvals required
     * @param approvers - List of approver rules
     * @param options - Optional configuration
     * @returns The created flow state
     */
    createMultiPartyFlow(request: ApprovalRequest, requiredApprovals: number, approvers: ApproverRule[], options?: {
        minRejectionsToDeny?: number;
        votingWindowMs?: number;
        workflowRunId?: string;
        stepId?: string;
    }): ApprovalFlowState;
    /**
     * Creates a single-party flow.
     *
     * @param request - Approval request
     * @param approver - Single approver rule
     * @param options - Optional configuration
     * @returns The created flow state
     */
    createSinglePartyFlow(request: ApprovalRequest, approver: ApproverRule, options?: {
        workflowRunId?: string;
        stepId?: string;
    }): ApprovalFlowState;
}
