import assert from "node:assert/strict";
import test from "node:test";

import {
  QuorumConfig,
  QuorumVote,
  QuorumStatus,
  VoteType,
  createInitialQuorumStatus,
  calculateQuorumStatus,
  mergeVotes,
  createVote,
  determineFinalStatus,
  validateVote,
  hasApproverVoted,
  getApproverVote,
  countEffectiveVotes,
} from "../../../../../src/platform/five-plane-control-plane/approval-center/quorum-calculator.js";

import {
  EscalationManager,
  EscalationReason,
  DelegationStatus,
  NotificationChannelType,
  NotificationPriority,
} from "../../../../../src/platform/five-plane-control-plane/approval-center/escalation-manager.js";

import {
  ApprovalFlowEngine,
  FlowType,
  FlowStatus,
  ApprovalFlowConfig,
  ApprovalTimeoutConfig,
  FeedbackLoopConfig,
  HumanFeedback,
} from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-flow-engine.js";
import type { ApprovalRequest } from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";

// ============================================================================
// Quorum Calculator Tests
// ============================================================================

test("createInitialQuorumStatus returns correct initial state", () => {
  const status = createInitialQuorumStatus();

  assert.strictEqual(status.isQuorumMet, false);
  assert.strictEqual(status.isDenied, false);
  assert.strictEqual(status.approvalsReceived, 0);
  assert.strictEqual(status.rejectionsReceived, 0);
  assert.strictEqual(status.abstentionsReceived, 0);
  assert.strictEqual(status.remainingApprovalsNeeded, 0);
  assert.strictEqual(status.remainingRejectionsNeeded, 0);
  assert.strictEqual(status.isVotingWindowExpired, false);
});

test("calculateQuorumStatus detects quorum met", () => {
  const config: QuorumConfig = { minApprovals: 3, minRejectionsToDeny: 2 };
  const votes: QuorumVote[] = [
    { approverId: "user1", voteType: VoteType.APPROVE, votedAt: "2026-04-21T00:00:00.000Z" },
    { approverId: "user2", voteType: VoteType.APPROVE, votedAt: "2026-04-21T00:00:00.000Z" },
    { approverId: "user3", voteType: VoteType.APPROVE, votedAt: "2026-04-21T00:00:00.000Z" },
  ];

  const status = calculateQuorumStatus(votes, config, "2026-04-21T00:00:00.000Z", "2026-04-21T00:00:00.000Z");

  assert.strictEqual(status.isQuorumMet, true);
  assert.strictEqual(status.approvalsReceived, 3);
  assert.strictEqual(status.remainingApprovalsNeeded, 0);
});

test("calculateQuorumStatus detects denial", () => {
  const config: QuorumConfig = { minApprovals: 3, minRejectionsToDeny: 2 };
  const votes: QuorumVote[] = [
    { approverId: "user1", voteType: VoteType.REJECT, votedAt: "2026-04-21T00:00:00.000Z" },
    { approverId: "user2", voteType: VoteType.REJECT, votedAt: "2026-04-21T00:00:00.000Z" },
  ];

  const status = calculateQuorumStatus(votes, config, "2026-04-21T00:00:00.000Z", "2026-04-21T00:00:00.000Z");

  assert.strictEqual(status.isDenied, true);
  assert.strictEqual(status.rejectionsReceived, 2);
  assert.strictEqual(status.remainingRejectionsNeeded, 0);
});

test("calculateQuorumStatus with voting window expired", () => {
  const config: QuorumConfig = { minApprovals: 3, minRejectionsToDeny: 2, votingWindowMs: 1000 };
  const votes: QuorumVote[] = [
    { approverId: "user1", voteType: VoteType.APPROVE, votedAt: "2026-04-21T00:00:00.000Z" },
  ];
  const votingStart = "2026-04-21T00:00:00.000Z";
  // 2 seconds later
  const currentTime = "2026-04-21T00:00:02.000Z";

  const status = calculateQuorumStatus(votes, config, votingStart, currentTime);

  assert.strictEqual(status.isVotingWindowExpired, true);
});

test("mergeVotes updates existing vote", () => {
  const existing: QuorumVote[] = [
    { approverId: "user1", voteType: VoteType.APPROVE, votedAt: "2026-04-21T00:00:00.000Z" },
  ];
  const newVote: QuorumVote = {
    approverId: "user1",
    voteType: VoteType.REJECT,
    votedAt: "2026-04-21T00:00:01.000Z",
  };

  const merged = mergeVotes(existing, newVote);

  assert.strictEqual(merged.length, 1);
  assert.strictEqual(merged[0]!.voteType, VoteType.REJECT);
});

test("mergeVotes adds new vote", () => {
  const existing: QuorumVote[] = [
    { approverId: "user1", voteType: VoteType.APPROVE, votedAt: "2026-04-21T00:00:00.000Z" },
  ];
  const newVote: QuorumVote = {
    approverId: "user2",
    voteType: VoteType.APPROVE,
    votedAt: "2026-04-21T00:00:01.000Z",
  };

  const merged = mergeVotes(existing, newVote);

  assert.strictEqual(merged.length, 2);
});

test("determineFinalStatus returns approved when quorum met", () => {
  const status: QuorumStatus = {
    isQuorumMet: true,
    isDenied: false,
    approvalsReceived: 3,
    rejectionsReceived: 0,
    abstentionsReceived: 0,
    remainingApprovalsNeeded: 0,
    remainingRejectionsNeeded: 2,
    isVotingWindowExpired: false,
    uniqueApprovers: new Set(["user1", "user2", "user3"]),
  };
  const config: QuorumConfig = { minApprovals: 3, minRejectionsToDeny: 2 };

  const result = determineFinalStatus(status, config);

  assert.strictEqual(result, "approved");
});

test("determineFinalStatus returns rejected when denied", () => {
  const status: QuorumStatus = {
    isQuorumMet: false,
    isDenied: true,
    approvalsReceived: 0,
    rejectionsReceived: 2,
    abstentionsReceived: 0,
    remainingApprovalsNeeded: 3,
    remainingRejectionsNeeded: 0,
    isVotingWindowExpired: false,
    uniqueApprovers: new Set(["user1", "user2"]),
  };
  const config: QuorumConfig = { minApprovals: 3, minRejectionsToDeny: 2 };

  const result = determineFinalStatus(status, config);

  assert.strictEqual(result, "rejected");
});

test("determineFinalStatus returns pending when neither met", () => {
  const status: QuorumStatus = {
    isQuorumMet: false,
    isDenied: false,
    approvalsReceived: 1,
    rejectionsReceived: 0,
    abstentionsReceived: 0,
    remainingApprovalsNeeded: 2,
    remainingRejectionsNeeded: 2,
    isVotingWindowExpired: false,
    uniqueApprovers: new Set(["user1"]),
  };
  const config: QuorumConfig = { minApprovals: 3, minRejectionsToDeny: 2 };

  const result = determineFinalStatus(status, config);

  assert.strictEqual(result, "pending");
});

test("validateVote throws for invalid vote", () => {
  const invalidVote = { approverId: "", voteType: VoteType.APPROVE, votedAt: "2026-04-21T00:00:00.000Z" } as QuorumVote;

  assert.throws(() => validateVote(invalidVote), /valid approverId/);
});

test("hasApproverVoted returns true when approver has voted", () => {
  const votes: QuorumVote[] = [
    { approverId: "user1", voteType: VoteType.APPROVE, votedAt: "2026-04-21T00:00:00.000Z" },
  ];

  assert.strictEqual(hasApproverVoted(votes, "user1"), true);
  assert.strictEqual(hasApproverVoted(votes, "user2"), false);
});

test("getApproverVote returns vote for approver", () => {
  const votes: QuorumVote[] = [
    { approverId: "user1", voteType: VoteType.APPROVE, votedAt: "2026-04-21T00:00:00.000Z" },
  ];

  const vote = getApproverVote(votes, "user1");
  assert.ok(vote);
  assert.strictEqual(vote!.approverId, "user1");
});

test("countEffectiveVotes counts correctly", () => {
  const votes: QuorumVote[] = [
    { approverId: "user1", voteType: VoteType.APPROVE, votedAt: "2026-04-21T00:00:00.000Z" },
    { approverId: "user2", voteType: VoteType.REJECT, votedAt: "2026-04-21T00:00:00.000Z" },
    { approverId: "user3", voteType: VoteType.ABSTAIN, votedAt: "2026-04-21T00:00:00.000Z" },
  ];

  const counts = countEffectiveVotes(votes);

  assert.strictEqual(counts.approvals, 1);
  assert.strictEqual(counts.rejections, 1);
});

// ============================================================================
// Escalation Manager Tests
// ============================================================================

test("EscalationManager canEscalate returns true within depth", () => {
  const manager = new EscalationManager();

  assert.strictEqual(manager.canEscalate(0, 3), true);
  assert.strictEqual(manager.canEscalate(1, 3), true);
  assert.strictEqual(manager.canEscalate(2, 3), true);
});

test("EscalationManager canEscalate returns false at max depth", () => {
  const manager = new EscalationManager();

  assert.strictEqual(manager.canEscalate(3, 3), false);
  assert.strictEqual(manager.canEscalate(4, 3), false);
});

test("EscalationManager createDelegation creates valid delegation", () => {
  const manager = new EscalationManager();

  const delegation = manager.createDelegation("user1", "user2", "approval_123", 3600000);

  assert.ok(delegation);
  assert.strictEqual(delegation.fromApprover, "user1");
  assert.strictEqual(delegation.toApprover, "user2");
  assert.strictEqual(delegation.originalApprovalId, "approval_123");
  assert.strictEqual(delegation.status, DelegationStatus.ACTIVE);
  assert.strictEqual(delegation.ttlResetCount, 0);
});

test("EscalationManager createDelegation throws on self-delegation", () => {
  const manager = new EscalationManager();

  assert.throws(
    () => manager.createDelegation("user1", "user1", "approval_123"),
    /Cannot delegate to yourself/,
  );
});

test("EscalationManager isDelegationExpired detects expired delegation", () => {
  const manager = new EscalationManager();

  const delegation = manager.createDelegation("user1", "user2", "approval_123", 1); // 1ms TTL

  // Wait for expiration
  const start = Date.now();
  while (Date.now() - start < 10) {
    // busy wait
  }

  assert.strictEqual(manager.isDelegationExpired(delegation), true);
});

test("EscalationManager resetDelegationTtl resets TTL", () => {
  const manager = new EscalationManager();

  const delegation = manager.createDelegation("user1", "user2", "approval_123", 1);

  // Reset TTL
  const reset = manager.resetDelegationTtl(delegation, 3600000);

  assert.strictEqual(reset.ttlResetCount, 1);
  assert.strictEqual(reset.status, DelegationStatus.ACTIVE);
});

test("EscalationManager resetDelegationTtl throws on max resets", () => {
  const manager = new EscalationManager();

  const delegation = manager.createDelegation("user1", "user2", "approval_123", 3600000, 1);

  // First reset should succeed
  const updatedDelegation = manager.resetDelegationTtl(delegation, 3600000);

  // Second reset should throw
  assert.throws(
    () => manager.resetDelegationTtl(updatedDelegation, 3600000),
    /Cannot reset TTL more than/,
  );
});

test("EscalationManager getEscalationHistory returns history", () => {
  const manager = new EscalationManager();

  const context = {
    approvalId: "approval_123",
    taskId: "task_456",
    executionId: null,
    currentLevel: 0,
    reason: EscalationReason.TIMEOUT,
  };

  const rule = {
    escalateTo: { type: "role" as const, identifier: "admin", can_delegate: true },
    maxEscalationDepth: 3,
    notificationChannels: [],
    escalationTimeoutMs: 30000,
  };

  manager.createEscalation(context, rule);
  manager.createEscalation({ ...context, currentLevel: 1 }, rule);

  const history = manager.getEscalationHistory("approval_123");

  assert.strictEqual(history.length, 2);
  assert.strictEqual(history[0]!.level, 1);
  assert.strictEqual(history[1]!.level, 2);
});

test("EscalationManager getCurrentEscalationLevel returns correct level", () => {
  const manager = new EscalationManager();

  assert.strictEqual(manager.getCurrentEscalationLevel("nonexistent"), 0);

  const context = {
    approvalId: "approval_123",
    taskId: "task_456",
    executionId: null,
    currentLevel: 0,
    reason: EscalationReason.TIMEOUT,
  };

  const rule = {
    escalateTo: { type: "role" as const, identifier: "admin", can_delegate: true },
    maxEscalationDepth: 3,
    notificationChannels: [],
    escalationTimeoutMs: 30000,
  };

  manager.createEscalation(context, rule);
  manager.createEscalation({ ...context, currentLevel: 1 }, rule);

  assert.strictEqual(manager.getCurrentEscalationLevel("approval_123"), 2);
});

test("EscalationManager createTimeoutContext creates valid context", () => {
  const manager = new EscalationManager();

  const context = manager.createTimeoutContext("approval_123", "task_456", null, 0);

  assert.strictEqual(context.approvalId, "approval_123");
  assert.strictEqual(context.reason, EscalationReason.TIMEOUT);
});

// ============================================================================
// Approval Flow Engine Tests
// ============================================================================

function createMockApprovalRequest(): ApprovalRequest {
  return {
    approvalId: "approval_test_123",
    taskId: "task_test_456",
    executionId: null,
    sourceAgentId: "agent_789",
    reason: "Test approval request",
    riskLevel: "high",
    options: ["option1", "option2"],
    context: {},
    timeoutPolicy: "reject",
    createdAt: new Date().toISOString(),
  };
}

test("ApprovalFlowEngine createFlow creates single-party flow", () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: [{ type: "user", identifier: "admin", can_delegate: true }],
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "superadmin", can_delegate: false },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 30000,
      },
    },
    request,
  );

  assert.ok(flow);
  assert.strictEqual(flow.config.flowType, FlowType.SINGLE);
  assert.strictEqual(flow.status, FlowStatus.PENDING);
  assert.strictEqual(flow.currentIteration, 0);
});

test("ApprovalFlowEngine createFlow creates multi-party flow with quorum", () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const flow = engine.createFlow(
    {
      flowType: FlowType.MULTI_PARTY,
      approvers: [
        { type: "user", identifier: "user1", can_delegate: true },
        { type: "user", identifier: "user2", can_delegate: true },
        { type: "user", identifier: "user3", can_delegate: true },
      ],
      quorum: { minApprovals: 2, minRejectionsToDeny: 2 },
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "superadmin", can_delegate: false },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 30000,
      },
    },
    request,
  );

  assert.ok(flow);
  assert.strictEqual(flow.config.quorum?.minApprovals, 2);
  assert.strictEqual(flow.status, FlowStatus.PENDING);
});

test("ApprovalFlowEngine submitVote approves single-party flow", () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: [{ type: "user", identifier: "admin", can_delegate: true }],
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "superadmin", can_delegate: false },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 30000,
      },
    },
    request,
  );

  const result = engine.submitVote(flow.flowId, "admin", VoteType.APPROVE);

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.flowStatus, FlowStatus.APPROVED);
});

test("ApprovalFlowEngine submitVote rejects single-party flow", () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: [{ type: "user", identifier: "admin", can_delegate: true }],
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "superadmin", can_delegate: false },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 30000,
      },
    },
    request,
  );

  const result = engine.submitVote(flow.flowId, "admin", VoteType.REJECT);

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.flowStatus, FlowStatus.REJECTED);
});

test("ApprovalFlowEngine submitVote accumulates approvals for multi-party", () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const flow = engine.createFlow(
    {
      flowType: FlowType.MULTI_PARTY,
      approvers: [
        { type: "user", identifier: "user1", can_delegate: true },
        { type: "user", identifier: "user2", can_delegate: true },
        { type: "user", identifier: "user3", can_delegate: true },
      ],
      quorum: { minApprovals: 2, minRejectionsToDeny: 2 },
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "superadmin", can_delegate: false },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 30000,
      },
    },
    request,
  );

  const result1 = engine.submitVote(flow.flowId, "user1", VoteType.APPROVE);
  assert.strictEqual(result1.success, true);
  assert.strictEqual(result1.flowStatus, FlowStatus.PENDING);
  assert.strictEqual(result1.quorumStatus.approvalsReceived, 1);

  const result2 = engine.submitVote(flow.flowId, "user2", VoteType.APPROVE);
  assert.strictEqual(result2.success, true);
  assert.strictEqual(result2.flowStatus, FlowStatus.APPROVED);
  assert.strictEqual(result2.quorumStatus.isQuorumMet, true);
});

test("ApprovalFlowEngine submitVote denies on enough rejections", () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const flow = engine.createFlow(
    {
      flowType: FlowType.MULTI_PARTY,
      approvers: [
        { type: "user", identifier: "user1", can_delegate: true },
        { type: "user", identifier: "user2", can_delegate: true },
      ],
      quorum: { minApprovals: 2, minRejectionsToDeny: 2 },
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "superadmin", can_delegate: false },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 30000,
      },
    },
    request,
  );

  const result1 = engine.submitVote(flow.flowId, "user1", VoteType.REJECT);
  assert.strictEqual(result1.flowStatus, FlowStatus.PENDING);

  const result2 = engine.submitVote(flow.flowId, "user2", VoteType.REJECT);
  assert.strictEqual(result2.flowStatus, FlowStatus.REJECTED);
  assert.strictEqual(result2.quorumStatus.isDenied, true);
});

test("ApprovalFlowEngine submitVote returns error for non-existent flow", () => {
  const engine = new ApprovalFlowEngine();

  const result = engine.submitVote("nonexistent", "user1", VoteType.APPROVE);

  assert.strictEqual(result.success, false);
  assert.ok(result.error?.includes("not found"));
});

test("ApprovalFlowEngine submitVote returns error for non-pending flow", () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: [{ type: "user", identifier: "admin", can_delegate: true }],
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "superadmin", can_delegate: false },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 30000,
      },
    },
    request,
  );

  // Approve to close the flow
  engine.submitVote(flow.flowId, "admin", VoteType.APPROVE);

  // Try to vote again
  const result = engine.submitVote(flow.flowId, "admin", VoteType.REJECT);

  assert.strictEqual(result.success, false);
  assert.ok(result.error?.includes("not pending"));
});

test("ApprovalFlowEngine delegateApproval creates delegation", () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: [{ type: "user", identifier: "user1", can_delegate: true }],
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "superadmin", can_delegate: false },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 30000,
      },
    },
    request,
  );

  const result = engine.delegateApproval(flow.flowId, "user1", "user2");

  assert.strictEqual(result.success, true);
  assert.ok(result.delegation);
  assert.strictEqual(result.delegation!.fromApprover, "user1");
  assert.strictEqual(result.delegation!.toApprover, "user2");
});

test("ApprovalFlowEngine delegateApproval resets TTL on existing delegation", () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: [{ type: "user", identifier: "user1", can_delegate: true }],
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "superadmin", can_delegate: false },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 30000,
      },
    },
    request,
  );

  // First delegation
  engine.delegateApproval(flow.flowId, "user1", "user2");

  // Delegate again to reset TTL
  const result = engine.delegateApproval(flow.flowId, "user1", "user3");

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.delegation!.toApprover, "user2");
  assert.strictEqual(result.delegation!.ttlResetCount, 1);
});

test("ApprovalFlowEngine addFeedback increments iteration", () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: [{ type: "user", identifier: "admin", can_delegate: true }],
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "superadmin", can_delegate: false },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 30000,
      },
      feedbackLoop: { maxIterations: 5, requireReplanOnReject: true },
    },
    request,
  );

  const result = engine.addFeedback(flow.flowId, {
    feedbackType: "reject_with_guidance",
    guidance: "Please reconsider the approach",
    principal: "admin",
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.newIteration, 1);
  assert.strictEqual(result.shouldReplan, true);
});

test("ApprovalFlowEngine addFeedback approves when feedback type is approve", () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: [{ type: "user", identifier: "admin", can_delegate: true }],
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "superadmin", can_delegate: false },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 30000,
      },
      feedbackLoop: { maxIterations: 5, requireReplanOnReject: true },
    },
    request,
  );

  const result = engine.addFeedback(flow.flowId, {
    feedbackType: "approve",
    principal: "admin",
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.flowStatus, FlowStatus.APPROVED);
});

test("ApprovalFlowEngine addFeedback rejects at max iterations", () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: [{ type: "user", identifier: "admin", can_delegate: true }],
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "superadmin", can_delegate: false },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 30000,
      },
      feedbackLoop: { maxIterations: 2, requireReplanOnReject: true },
    },
    request,
  );

  // Add max iterations worth of feedback
  engine.addFeedback(flow.flowId, { feedbackType: "reject_with_guidance", guidance: "Iter 1", principal: "admin" });
  engine.addFeedback(flow.flowId, { feedbackType: "reject_with_guidance", guidance: "Iter 2", principal: "admin" });

  // Third iteration should fail
  const result = engine.addFeedback(flow.flowId, { feedbackType: "reject_with_guidance", guidance: "Iter 3", principal: "admin" });

  assert.strictEqual(result.success, false);
  assert.ok(result.error?.includes("Max iterations"));
});

test("ApprovalFlowEngine checkMaxIterations detects max reached", () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: [{ type: "user", identifier: "admin", can_delegate: true }],
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "superadmin", can_delegate: false },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 30000,
      },
      feedbackLoop: { maxIterations: 1, requireReplanOnReject: true },
    },
    request,
  );

  engine.addFeedback(flow.flowId, { feedbackType: "reject_with_guidance", guidance: "Iter 1", principal: "admin" });

  assert.strictEqual(engine.checkMaxIterations(flow.flowId), true);
});

test("ApprovalFlowEngine finalizeFlow sets status", () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: [{ type: "user", identifier: "admin", can_delegate: true }],
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "superadmin", can_delegate: false },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 30000,
      },
    },
    request,
  );

  engine.finalizeFlow(flow.flowId, FlowStatus.CANCELLED);

  const finalFlow = engine.getFlowStatus(flow.flowId);
  assert.strictEqual(finalFlow?.status, FlowStatus.CANCELLED);
});

test("ApprovalFlowEngine getFlowStatus returns flow", () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: [{ type: "user", identifier: "admin", can_delegate: true }],
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "superadmin", can_delegate: false },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 30000,
      },
    },
    request,
  );

  const retrieved = engine.getFlowStatus(flow.flowId);

  assert.ok(retrieved);
  assert.strictEqual(retrieved!.flowId, flow.flowId);
});

test("ApprovalFlowEngine getFlowStatus returns null for non-existent", () => {
  const engine = new ApprovalFlowEngine();

  const result = engine.getFlowStatus("nonexistent");

  assert.strictEqual(result, null);
});

test("ApprovalFlowEngine getFlowsForTask returns flows for task", () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: [{ type: "user", identifier: "admin", can_delegate: true }],
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "superadmin", can_delegate: false },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 30000,
      },
    },
    request,
  );

  const flows = engine.getFlowsForTask("task_test_456");

  assert.strictEqual(flows.length, 1);
  assert.strictEqual(flows[0]!.request.taskId, "task_test_456");
});

test("ApprovalFlowEngine getPendingFlows returns only pending", () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: [{ type: "user", identifier: "admin", can_delegate: true }],
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "superadmin", can_delegate: false },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 30000,
      },
    },
    request,
  );

  // Approve to close
  engine.submitVote(flow.flowId, "admin", VoteType.APPROVE);

  // Create another pending flow
  const request2 = createMockApprovalRequest();
  request2.approvalId = "approval_test_789";
  engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: [{ type: "user", identifier: "admin", can_delegate: true }],
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "superadmin", can_delegate: false },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 30000,
      },
    },
    request2,
  );

  const pending = engine.getPendingFlows();

  assert.strictEqual(pending.length, 1);
});

test("ApprovalFlowEngine createMultiPartyFlow creates properly configured flow", () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const flow = engine.createMultiPartyFlow(
    request,
    2,
    [
      { type: "user", identifier: "user1", can_delegate: true },
      { type: "user", identifier: "user2", can_delegate: true },
      { type: "user", identifier: "user3", can_delegate: true },
    ],
  );

  assert.strictEqual(flow.config.flowType, FlowType.MULTI_PARTY);
  assert.strictEqual(flow.config.quorum?.minApprovals, 2);
  assert.ok(flow.feedbackLoop);
  assert.strictEqual(flow.feedbackLoop!.maxIterations, 5);
});

test("ApprovalFlowEngine createSinglePartyFlow creates properly configured flow", () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const flow = engine.createSinglePartyFlow(request, {
    type: "user",
    identifier: "admin",
    can_delegate: true,
  });

  assert.strictEqual(flow.config.flowType, FlowType.SINGLE);
  assert.strictEqual(flow.config.approvers.length, 1);
});

test("ApprovalFlowEngine getQuorumStatus returns correct status", () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const flow = engine.createFlow(
    {
      flowType: FlowType.MULTI_PARTY,
      approvers: [
        { type: "user", identifier: "user1", can_delegate: true },
        { type: "user", identifier: "user2", can_delegate: true },
      ],
      quorum: { minApprovals: 2, minRejectionsToDeny: 2 },
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "superadmin", can_delegate: false },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 30000,
      },
    },
    request,
  );

  const status = engine.getQuorumStatus(flow.flowId);

  assert.ok(status);
  assert.strictEqual(status!.approvalsReceived, 0);

  engine.submitVote(flow.flowId, "user1", VoteType.APPROVE);

  const updatedStatus = engine.getQuorumStatus(flow.flowId);
  assert.ok(updatedStatus);
  assert.strictEqual(updatedStatus!.approvalsReceived, 1);
});
