import assert from "node:assert/strict";
import test from "node:test";

/**
 * Index barrel file tests
 *
 * Tests that all modules are properly re-exported from the index barrel file.
 */

import {
  // From approval-service
  validateApprovalDecision,
  type ApprovalRequest,
  type ApprovalDecision,
  // From quorum-calculator
  createInitialQuorumStatus,
  calculateQuorumStatus,
  createVote,
  mergeVotes,
  isQuorumMet,
  isDenied,
  getRemainingVotes,
  determineFinalStatus,
  validateVote,
  hasApproverVoted,
  getApproverVote,
  countEffectiveVotes,
  VoteType,
  type QuorumConfig,
  type QuorumVote,
  type QuorumStatus,
  // From escalation-manager
  EscalationManager,
  EscalationReason,
  DelegationStatus,
  NotificationChannelType,
  NotificationPriority,
  type NotificationChannel,
  type NotificationMessage,
  type EscalationRule,
  type ApproverRule,
  type EscalationLevel,
  type EscalationContext,
  type Delegation,
  // From approval-flow-engine
  ApprovalFlowEngine,
  FlowType,
  FlowStatus,
  type ApprovalFlowConfig,
  type ApprovalTimeoutConfig,
  type FeedbackLoopConfig,
  type HumanFeedback,
  type FeedbackLoop,
  type ApprovalFlowState,
  type VoteResult,
  type FeedbackResult,
} from "../../../../../src/platform/five-plane-control-plane/approval-center/index.js";

// ============================================
// Quorum Calculator Tests
// ============================================

test("createInitialQuorumStatus returns correct initial state", () => {
  const status = createInitialQuorumStatus();
  assert.equal(status.isQuorumMet, false);
  assert.equal(status.isDenied, false);
  assert.equal(status.approvalsReceived, 0);
  assert.equal(status.rejectionsReceived, 0);
  assert.equal(status.abstentionsReceived, 0);
  assert.equal(status.remainingApprovalsNeeded, 0);
  assert.equal(status.remainingRejectionsNeeded, 0);
  assert.equal(status.isVotingWindowExpired, false);
  assert.ok(status.uniqueApprovers instanceof Set);
  assert.equal(status.uniqueApprovers.size, 0);
});

test("createVote creates a valid vote", () => {
  const vote = createVote("user_1", VoteType.APPROVE);
  assert.equal(vote.approverId, "user_1");
  assert.equal(vote.voteType, VoteType.APPROVE);
  assert.ok(vote.votedAt);
});

test("createVote with delegation source", () => {
  const vote = createVote("user_2", VoteType.REJECT, "original_user");
  assert.equal(vote.approverId, "user_2");
  assert.equal(vote.voteType, VoteType.REJECT);
  assert.equal(vote.delegationSource, "original_user");
});

test("calculateQuorumStatus detects quorum met", () => {
  const votes: QuorumVote[] = [
    { approverId: "user_1", voteType: VoteType.APPROVE, votedAt: "2026-04-14T00:00:00.000Z" },
    { approverId: "user_2", voteType: VoteType.APPROVE, votedAt: "2026-04-14T00:00:00.000Z" },
  ];
  const config: QuorumConfig = { minApprovals: 2, minRejectionsToDeny: 2 };
  const status = calculateQuorumStatus(votes, config, "2026-04-14T00:00:00.000Z", "2026-04-14T00:00:00.000Z");
  assert.equal(status.isQuorumMet, true);
  assert.equal(status.approvalsReceived, 2);
  assert.equal(status.remainingApprovalsNeeded, 0);
});

test("calculateQuorumStatus detects denial", () => {
  const votes: QuorumVote[] = [
    { approverId: "user_1", voteType: VoteType.REJECT, votedAt: "2026-04-14T00:00:00.000Z" },
  ];
  const config: QuorumConfig = { minApprovals: 2, minRejectionsToDeny: 1 };
  const status = calculateQuorumStatus(votes, config, "2026-04-14T00:00:00.000Z", "2026-04-14T00:00:00.000Z");
  assert.equal(status.isDenied, true);
  assert.equal(status.rejectionsReceived, 1);
});

test("calculateQuorumStatus tracks voting window expiration", () => {
  const votes: QuorumVote[] = [];
  const config: QuorumConfig = { minApprovals: 2, minRejectionsToDeny: 2, votingWindowMs: 1000 };
  const startTime = "2026-04-14T00:00:00.000Z";
  const expiredTime = "2026-04-14T00:00:02.000Z"; // 2 seconds later
  const status = calculateQuorumStatus(votes, config, startTime, expiredTime);
  assert.equal(status.isVotingWindowExpired, true);
});

test("mergeVotes updates existing vote", () => {
  const existing: QuorumVote[] = [
    { approverId: "user_1", voteType: VoteType.APPROVE, votedAt: "2026-04-14T00:00:00.000Z" },
  ];
  const updated = mergeVotes(existing, { approverId: "user_1", voteType: VoteType.REJECT, votedAt: "2026-04-14T00:01:00.000Z" });
  assert.equal(updated.length, 1);
  assert.equal(updated[0]!.voteType, VoteType.REJECT);
});

test("mergeVotes adds new vote", () => {
  const existing: QuorumVote[] = [
    { approverId: "user_1", voteType: VoteType.APPROVE, votedAt: "2026-04-14T00:00:00.000Z" },
  ];
  const updated = mergeVotes(existing, { approverId: "user_2", voteType: VoteType.REJECT, votedAt: "2026-04-14T00:01:00.000Z" });
  assert.equal(updated.length, 2);
});

test("isQuorumMet helper returns correct value", () => {
  const status: QuorumStatus = { ...createInitialQuorumStatus(), isQuorumMet: true };
  assert.equal(isQuorumMet(status), true);
  assert.equal(isQuorumMet({ ...status, isQuorumMet: false }), false);
});

test("isDenied helper returns correct value", () => {
  const status: QuorumStatus = { ...createInitialQuorumStatus(), isDenied: true };
  assert.equal(isDenied(status), true);
  assert.equal(isDenied({ ...status, isDenied: false }), false);
});

test("getRemainingVotes helper returns correct values", () => {
  const status: QuorumStatus = { ...createInitialQuorumStatus(), remainingApprovalsNeeded: 2, remainingRejectionsNeeded: 1 };
  const remaining = getRemainingVotes(status);
  assert.equal(remaining.approvals, 2);
  assert.equal(remaining.rejections, 1);
});

test("determineFinalStatus returns correct status", () => {
  assert.equal(determineFinalStatus({ ...createInitialQuorumStatus(), isQuorumMet: true }, { minApprovals: 1, minRejectionsToDeny: 1 }), "approved");
  assert.equal(determineFinalStatus({ ...createInitialQuorumStatus(), isDenied: true }, { minApprovals: 1, minRejectionsToDeny: 1 }), "rejected");
  assert.equal(determineFinalStatus(createInitialQuorumStatus(), { minApprovals: 1, minRejectionsToDeny: 1 }), "pending");
});

test("validateVote throws for invalid vote", () => {
  assert.throws(() => validateVote({ approverId: "", voteType: VoteType.APPROVE, votedAt: "2026-04-14T00:00:00.000Z" as any }), /valid approverId/);
  assert.throws(() => validateVote({ approverId: "user_1", voteType: "invalid" as any, votedAt: "2026-04-14T00:00:00.000Z" as any }), /Invalid vote type/);
});

test("hasApproverVoted returns correct value", () => {
  const votes: QuorumVote[] = [
    { approverId: "user_1", voteType: VoteType.APPROVE, votedAt: "2026-04-14T00:00:00.000Z" },
  ];
  assert.equal(hasApproverVoted(votes, "user_1"), true);
  assert.equal(hasApproverVoted(votes, "user_2"), false);
});

test("getApproverVote returns correct vote", () => {
  const votes: QuorumVote[] = [
    { approverId: "user_1", voteType: VoteType.APPROVE, votedAt: "2026-04-14T00:00:00.000Z" },
  ];
  assert.equal(getApproverVote(votes, "user_1")?.voteType, VoteType.APPROVE);
  assert.equal(getApproverVote(votes, "user_2"), undefined);
});

test("countEffectiveVotes counts correctly", () => {
  const votes: QuorumVote[] = [
    { approverId: "user_1", voteType: VoteType.APPROVE, votedAt: "2026-04-14T00:00:00.000Z" },
    { approverId: "user_2", voteType: VoteType.REJECT, votedAt: "2026-04-14T00:00:00.000Z" },
    { approverId: "user_3", voteType: VoteType.ABSTAIN, votedAt: "2026-04-14T00:00:00.000Z" },
  ];
  const counts = countEffectiveVotes(votes);
  assert.equal(counts.approvals, 1);
  assert.equal(counts.rejections, 1);
});

// ============================================
// Escalation Manager Tests
// ============================================

test("EscalationManager canEscalate returns correct value", () => {
  const manager = new EscalationManager();
  assert.equal(manager.canEscalate(0, 3), true);
  assert.equal(manager.canEscalate(3, 3), false);
  assert.equal(manager.canEscalate(2, 3), true);
});

test("EscalationManager createDelegation creates valid delegation", () => {
  const manager = new EscalationManager();
  const delegation = manager.createDelegation("user_1", "user_2", "approval_1");
  assert.equal(delegation.fromApprover, "user_1");
  assert.equal(delegation.toApprover, "user_2");
  assert.equal(delegation.originalApprovalId, "approval_1");
  assert.equal(delegation.status, DelegationStatus.ACTIVE);
  assert.ok(delegation.delegationId);
  assert.ok(delegation.expiresAt);
});

test("EscalationManager createDelegation throws for self-delegation", () => {
  const manager = new EscalationManager();
  assert.throws(() => manager.createDelegation("user_1", "user_1", "approval_1"), /Cannot delegate to yourself/);
});

test("EscalationManager isDelegationExpired detects expired", () => {
  const manager = new EscalationManager();
  const delegation: Delegation = {
    delegationId: "del_1",
    fromApprover: "user_1",
    toApprover: "user_2",
    delegatedAt: "2026-04-14T00:00:00.000Z",
    expiresAt: "2026-04-13T00:00:00.000Z", // Before now
    originalApprovalId: "approval_1",
    ttlResetCount: 0,
    maxTtlResets: 3,
    status: DelegationStatus.ACTIVE,
  };
  assert.equal(manager.isDelegationExpired(delegation), true);
});

test("EscalationManager getDelegation returns stored delegation", () => {
  const manager = new EscalationManager();
  const created = manager.createDelegation("user_1", "user_2", "approval_1");
  const retrieved = manager.getDelegation(created.delegationId);
  assert.ok(retrieved);
  assert.equal(retrieved!.delegationId, created.delegationId);
});

test("EscalationManager getEscalationHistory returns history", () => {
  const manager = new EscalationManager();
  const context: EscalationContext = {
    approvalId: "approval_1",
    taskId: "task_1",
    currentLevel: 0,
    reason: EscalationReason.TIMEOUT,
  };
  const rule: EscalationRule = {
    escalateTo: { type: "role", identifier: "admin", can_delegate: true },
    maxEscalationDepth: 3,
    notificationChannels: [],
    escalationTimeoutMs: 30000,
  };
  manager.createEscalation(context, rule);
  const history = manager.getEscalationHistory("approval_1");
  assert.equal(history.length, 1);
  assert.equal(history[0]!.level, 1);
});

test("EscalationManager getCurrentEscalationLevel returns correct level", () => {
  const manager = new EscalationManager();
  assert.equal(manager.getCurrentEscalationLevel("approval_1"), 0);
  const context: EscalationContext = {
    approvalId: "approval_1",
    taskId: "task_1",
    currentLevel: 0,
    reason: EscalationReason.TIMEOUT,
  };
  const rule: EscalationRule = {
    escalateTo: { type: "role", identifier: "admin", can_delegate: true },
    maxEscalationDepth: 3,
    notificationChannels: [],
    escalationTimeoutMs: 30000,
  };
  manager.createEscalation(context, rule);
  assert.equal(manager.getCurrentEscalationLevel("approval_1"), 1);
});

test("EscalationManager createTimeoutContext creates valid context", () => {
  const manager = new EscalationManager();
  const context = manager.createTimeoutContext("approval_1", "task_1", "exec_1", 0);
  assert.equal(context.approvalId, "approval_1");
  assert.equal(context.taskId, "task_1");
  assert.equal(context.executionId, "exec_1");
  assert.equal(context.currentLevel, 0);
  assert.equal(context.reason, EscalationReason.TIMEOUT);
});

test("EscalationManager createQuorumNotMetContext creates valid context", () => {
  const manager = new EscalationManager();
  const context = manager.createQuorumNotMetContext("approval_1", "task_1", "exec_1", 1);
  assert.equal(context.approvalId, "approval_1");
  assert.equal(context.reason, EscalationReason.QUORUM_NOT_MET);
});

// ============================================
// Approval Flow Engine Tests
// ============================================

test("ApprovalFlowEngine FlowType enum has correct values", () => {
  assert.equal(FlowType.SINGLE, "single");
  assert.equal(FlowType.MULTI_PARTY, "multi_party");
  assert.equal(FlowType.DELEGATED, "delegated");
  assert.equal(FlowType.SEQUENTIAL_CHAIN, "sequential_chain");
});

test("ApprovalFlowEngine FlowStatus enum has correct values", () => {
  assert.equal(FlowStatus.PENDING, "pending");
  assert.equal(FlowStatus.APPROVED, "approved");
  assert.equal(FlowStatus.REJECTED, "rejected");
  assert.equal(FlowStatus.EXPIRED, "expired");
  assert.equal(FlowStatus.ESCALATED, "escalated");
  assert.equal(FlowStatus.MAX_ITERATIONS_REACHED, "max_iterations_reached");
  assert.equal(FlowStatus.CANCELLED, "cancelled");
});

test("ApprovalFlowEngine can be instantiated", () => {
  const engine = new ApprovalFlowEngine();
  assert.ok(engine);
});

test("ApprovalFlowEngine can be instantiated with EscalationManager", () => {
  const escalationManager = new EscalationManager();
  const engine = new ApprovalFlowEngine(escalationManager);
  assert.ok(engine);
});

// ============================================
// Approval Service Validation Tests
// ============================================

test("validateApprovalDecision passes for option_selected", () => {
  const decision: ApprovalDecision = {
    approvalId: "approval_1",
    decisionType: "option_selected",
    selectedOptionId: "option_1",
    respondedBy: "user_1",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.doesNotThrow(() => validateApprovalDecision(decision));
});

test("validateApprovalDecision passes for confirmed", () => {
  const decision: ApprovalDecision = {
    approvalId: "approval_1",
    decisionType: "confirmed",
    confirmed: true,
    respondedBy: "user_1",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.doesNotThrow(() => validateApprovalDecision(decision));
});

test("validateApprovalDecision passes for text_input", () => {
  const decision: ApprovalDecision = {
    approvalId: "approval_1",
    decisionType: "text_input",
    inputText: "User response",
    respondedBy: "user_1",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.doesNotThrow(() => validateApprovalDecision(decision));
});

test("validateApprovalDecision passes for rejected", () => {
  const decision: ApprovalDecision = {
    approvalId: "approval_1",
    decisionType: "rejected",
    respondedBy: "user_1",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.doesNotThrow(() => validateApprovalDecision(decision));
});

test("validateApprovalDecision throws for option_selected without selectedOptionId", () => {
  const decision = {
    approvalId: "approval_1",
    decisionType: "option_selected",
    respondedBy: "user_1",
    respondedAt: "2026-04-14T00:00:00.000Z",
  } as ApprovalDecision;
  assert.throws(() => validateApprovalDecision(decision), { code: "approval.invalid_option_selected" });
});

test("validateApprovalDecision throws for confirmed without confirmed=true", () => {
  const decision = {
    approvalId: "approval_1",
    decisionType: "confirmed",
    respondedBy: "user_1",
    respondedAt: "2026-04-14T00:00:00.000Z",
  } as ApprovalDecision;
  assert.throws(() => validateApprovalDecision(decision), { code: "approval.invalid_confirmed" });
});

test("validateApprovalDecision throws for text_input without inputText", () => {
  const decision = {
    approvalId: "approval_1",
    decisionType: "text_input",
    respondedBy: "user_1",
    respondedAt: "2026-04-14T00:00:00.000Z",
  } as ApprovalDecision;
  assert.throws(() => validateApprovalDecision(decision), { code: "approval.invalid_text_input" });
});

test("validateApprovalDecision throws for terminal decision with extra fields", () => {
  const decision = {
    approvalId: "approval_1",
    decisionType: "rejected",
    selectedOptionId: "option_1",
    respondedBy: "user_1",
    respondedAt: "2026-04-14T00:00:00.000Z",
  } as ApprovalDecision;
  assert.throws(() => validateApprovalDecision(decision), { code: "approval.invalid_terminal_payload" });
});

// ============================================
// Type structure tests
// ============================================

test("ApprovalRequest structure is correct", () => {
  const request: ApprovalRequest = {
    approvalId: "approval_1",
    taskId: "task_1",
    sourceAgentId: "agent_1",
    reason: "Needs human review",
    riskLevel: "medium",
    options: ["approve", "reject"],
    context: {},
    timeoutPolicy: "reject",
    createdAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(request.approvalId, "approval_1");
  assert.equal(request.taskId, "task_1");
  assert.equal(request.options.length, 2);
  assert.equal(request.riskLevel, "medium");
});

test("ApprovalDecision type accepts all valid decision types", () => {
  const decisions: ApprovalDecision["decisionType"][] = [
    "option_selected",
    "confirmed",
    "text_input",
    "rejected",
    "expired",
  ];
  assert.equal(decisions.length, 5);
});

test("EscalationReason enum has correct values", () => {
  assert.equal(EscalationReason.TIMEOUT, "timeout");
  assert.equal(EscalationReason.QUORUM_NOT_MET, "quorum_not_met");
  assert.equal(EscalationReason.MANUAL, "manual");
  assert.equal(EscalationReason.CRITICAL_RISK, "critical_risk");
});

test("DelegationStatus enum has correct values", () => {
  assert.equal(DelegationStatus.ACTIVE, "active");
  assert.equal(DelegationStatus.EXPIRED, "expired");
  assert.equal(DelegationStatus.REVOKED, "revoked");
  assert.equal(DelegationStatus.COMPLETED, "completed");
});

test("NotificationChannelType enum has correct values", () => {
  assert.equal(NotificationChannelType.EMAIL, "email");
  assert.equal(NotificationChannelType.SLACK, "slack");
  assert.equal(NotificationChannelType.FEISHU, "feishu");
  assert.equal(NotificationChannelType.WEBHOOK, "webhook");
});

test("NotificationPriority enum has correct values", () => {
  assert.equal(NotificationPriority.HIGH, "high");
  assert.equal(NotificationPriority.NORMAL, "normal");
  assert.equal(NotificationPriority.LOW, "low");
});
