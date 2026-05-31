/**
 * Unit tests for Approval Center barrel file and exported functionality.
 * Covers exports from:
 * - approval-service.ts
 * - quorum-calculator.ts
 * - escalation-manager.ts
 * - approval-flow-engine.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ApprovalService,
  validateApprovalDecision,
  type ApprovalRequest,
  type ApprovalDecision,
} from "../../../../src/platform/five-plane-control-plane/approval-center/index.js";

import {
  QuorumConfig,
  QuorumVote,
  VoteType,
  createInitialQuorumStatus,
  calculateQuorumStatus,
  isQuorumMet,
  isDenied,
} from "../../../../src/platform/five-plane-control-plane/approval-center/index.js";

import {
  EscalationManager,
  NotificationChannelType,
  NotificationPriority,
  DelegationStatus,
  EscalationReason,
  type NotificationChannel,
  type NotificationMessage,
  type Delegation,
} from "../../../../src/platform/five-plane-control-plane/approval-center/index.js";

import {
  ApprovalFlowEngine,
  FlowType,
  FlowStatus,
  type ApprovalFlowConfig,
  type ApprovalTimeoutConfig,
  type FeedbackLoopConfig,
  type HumanFeedback,
} from "../../../../src/platform/five-plane-control-plane/approval-center/index.js";

// ============================================================================
// Approval Service Tests (via barrel export)
// ============================================================================

test("validateApprovalDecision passes for valid option_selected decision", () => {
  const decision: ApprovalDecision = {
    approvalId: "approval_123",
    decisionType: "option_selected",
    selectedOptionId: "option_1",
    respondedBy: "user_abc",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };

  assert.doesNotThrow(() => validateApprovalDecision(decision));
});

test("validateApprovalDecision passes for valid confirmed decision", () => {
  const decision: ApprovalDecision = {
    approvalId: "approval_123",
    decisionType: "confirmed",
    confirmed: true,
    respondedBy: "user_abc",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };

  assert.doesNotThrow(() => validateApprovalDecision(decision));
});

test("validateApprovalDecision passes for valid text_input decision", () => {
  const decision: ApprovalDecision = {
    approvalId: "approval_123",
    decisionType: "text_input",
    inputText: "User typed this response",
    respondedBy: "user_abc",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };

  assert.doesNotThrow(() => validateApprovalDecision(decision));
});

test("validateApprovalDecision throws for option_selected without selectedOptionId [control-plane-approval-center]", () => {
  const decision = {
    approvalId: "approval_123",
    decisionType: "option_selected" as const,
    respondedBy: "user_abc",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };

  assert.throws(
    () => validateApprovalDecision(decision as any),
    (err: any) => err.code === "approval.invalid_option_selected",
  );
});

test("validateApprovalDecision throws for confirmed without confirmed=true", () => {
  const decision = {
    approvalId: "approval_123",
    decisionType: "confirmed" as const,
    respondedBy: "user_abc",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };

  assert.throws(
    () => validateApprovalDecision(decision as any),
    (err: any) => err.code === "approval.invalid_confirmed",
  );
});

test("validateApprovalDecision throws for text_input without inputText", () => {
  const decision = {
    approvalId: "approval_123",
    decisionType: "text_input" as const,
    respondedBy: "user_abc",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };

  assert.throws(
    () => validateApprovalDecision(decision as any),
    (err: any) => err.code === "approval.invalid_text_input",
  );
});

test("validateApprovalDecision throws for terminal decision with extra fields", () => {
  const decision = {
    approvalId: "approval_123",
    decisionType: "rejected" as const,
    selectedOptionId: "option_1",
    respondedBy: "user_abc",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };

  assert.throws(
    () => validateApprovalDecision(decision as any),
    (err: any) => err.code === "approval.invalid_terminal_payload",
  );
});

// ============================================================================
// Quorum Calculator Tests (via barrel export)
// ============================================================================

test("createInitialQuorumStatus via barrel export", () => {
  const status = createInitialQuorumStatus();

  assert.strictEqual(status.isQuorumMet, false);
  assert.strictEqual(status.isDenied, false);
  assert.strictEqual(status.approvalsReceived, 0);
  assert.strictEqual(status.rejectionsReceived, 0);
});

test("calculateQuorumStatus via barrel export detects quorum met", () => {
  const config: QuorumConfig = { minApprovals: 2, minRejectionsToDeny: 2 };
  const votes: QuorumVote[] = [
    { approverId: "user1", voteType: VoteType.APPROVE, votedAt: "2026-04-21T00:00:00.000Z" },
    { approverId: "user2", voteType: VoteType.APPROVE, votedAt: "2026-04-21T00:00:00.000Z" },
  ];

  const status = calculateQuorumStatus(votes, config, "2026-04-21T00:00:00.000Z", "2026-04-21T00:00:00.000Z");

  assert.strictEqual(status.isQuorumMet, true);
  assert.strictEqual(status.approvalsReceived, 2);
});

test("calculateQuorumStatus via barrel export detects denial", () => {
  const config: QuorumConfig = { minApprovals: 2, minRejectionsToDeny: 2 };
  const votes: QuorumVote[] = [
    { approverId: "user1", voteType: VoteType.REJECT, votedAt: "2026-04-21T00:00:00.000Z" },
    { approverId: "user2", voteType: VoteType.REJECT, votedAt: "2026-04-21T00:00:00.000Z" },
  ];

  const status = calculateQuorumStatus(votes, config, "2026-04-21T00:00:00.000Z", "2026-04-21T00:00:00.000Z");

  assert.strictEqual(status.isDenied, true);
  assert.strictEqual(status.rejectionsReceived, 2);
});

test("isQuorumMet via barrel export", () => {
  const status = createInitialQuorumStatus();
  assert.strictEqual(isQuorumMet(status), false);
});

test("isDenied via barrel export", () => {
  const status = createInitialQuorumStatus();
  assert.strictEqual(isDenied(status), false);
});

// ============================================================================
// Escalation Manager Tests (via barrel export)
// ============================================================================

test("EscalationManager via barrel export - canEscalate", () => {
  const manager = new EscalationManager();

  assert.strictEqual(manager.canEscalate(0, 3), true);
  assert.strictEqual(manager.canEscalate(3, 3), false);
});

test("EscalationManager via barrel export - createDelegation", () => {
  const manager = new EscalationManager();

  const delegation = manager.createDelegation("user1", "user2", "approval_123");

  assert.ok(delegation);
  assert.strictEqual(delegation.fromApprover, "user1");
  assert.strictEqual(delegation.toApprover, "user2");
  assert.strictEqual(delegation.originalApprovalId, "approval_123");
  assert.strictEqual(delegation.status, DelegationStatus.ACTIVE);
});

test("EscalationManager via barrel export - createDelegation throws on self-delegation", () => {
  const manager = new EscalationManager();

  assert.throws(
    () => manager.createDelegation("user1", "user1", "approval_123"),
    /Cannot delegate to yourself/,
  );
});

test("EscalationManager via barrel export - isDelegationExpired", () => {
  const manager = new EscalationManager();
  const delegation: Delegation = {
    delegationId: "delegation-1",
    fromApprover: "approver-1",
    toApprover: "approver-2",
    delegatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    originalApprovalId: "approval-1",
    ttlResetCount: 0,
    maxTtlResets: 3,
    status: DelegationStatus.ACTIVE,
  };

  assert.strictEqual(manager.isDelegationExpired(delegation), false);
});

test("EscalationManager via barrel export - isDelegationExpired detects expired", () => {
  const manager = new EscalationManager();
  const delegation: Delegation = {
    delegationId: "delegation-1",
    fromApprover: "approver-1",
    toApprover: "approver-2",
    delegatedAt: new Date(Date.now() - 7200000).toISOString(),
    expiresAt: new Date(Date.now() - 3600000).toISOString(),
    originalApprovalId: "approval-1",
    ttlResetCount: 0,
    maxTtlResets: 3,
    status: DelegationStatus.ACTIVE,
  };

  assert.strictEqual(manager.isDelegationExpired(delegation), true);
});

test("EscalationManager via barrel export - getDelegation", () => {
  const manager = new EscalationManager();
  const created = manager.createDelegation("user1", "user2", "approval_123");

  const retrieved = manager.getDelegation(created.delegationId);

  assert.ok(retrieved);
  assert.strictEqual(retrieved!.delegationId, created.delegationId);
});

test("EscalationManager via barrel export - revokeDelegation", () => {
  const manager = new EscalationManager();
  const delegation = manager.createDelegation("user1", "user2", "approval_123");

  manager.revokeDelegation(delegation.delegationId);

  const retrieved = manager.getDelegation(delegation.delegationId);
  assert.strictEqual(retrieved?.status, DelegationStatus.REVOKED);
});

test("EscalationManager via barrel export - completeDelegation", () => {
  const manager = new EscalationManager();
  const delegation = manager.createDelegation("user1", "user2", "approval_123");

  manager.completeDelegation(delegation.delegationId);

  const retrieved = manager.getDelegation(delegation.delegationId);
  assert.strictEqual(retrieved?.status, DelegationStatus.COMPLETED);
});

test("EscalationManager via barrel export - getEscalationHistory", () => {
  const manager = new EscalationManager();

  const history = manager.getEscalationHistory("nonexistent-approval");

  assert.deepStrictEqual(history, []);
});

test("EscalationManager via barrel export - getCurrentEscalationLevel", () => {
  const manager = new EscalationManager();

  const level = manager.getCurrentEscalationLevel("nonexistent-approval");

  assert.strictEqual(level, 0);
});

test("EscalationManager via barrel export - createTimeoutContext", () => {
  const manager = new EscalationManager();

  const context = manager.createTimeoutContext("approval_123", "task_456", null, 0);

  assert.strictEqual(context.approvalId, "approval_123");
  assert.strictEqual(context.reason, EscalationReason.TIMEOUT);
});

test("EscalationManager via barrel export - createQuorumNotMetContext", () => {
  const manager = new EscalationManager();

  const context = manager.createQuorumNotMetContext("approval_123", "task_456", null, 0);

  assert.strictEqual(context.approvalId, "approval_123");
  assert.strictEqual(context.reason, EscalationReason.QUORUM_NOT_MET);
});

test("EscalationManager via barrel export - NotificationChannelType enum", () => {
  assert.strictEqual(NotificationChannelType.EMAIL, "email");
  assert.strictEqual(NotificationChannelType.SLACK, "slack");
  assert.strictEqual(NotificationChannelType.FEISHU, "feishu");
  assert.strictEqual(NotificationChannelType.WEBHOOK, "webhook");
});

test("EscalationManager via barrel export - NotificationPriority enum", () => {
  assert.strictEqual(NotificationPriority.HIGH, "high");
  assert.strictEqual(NotificationPriority.NORMAL, "normal");
  assert.strictEqual(NotificationPriority.LOW, "low");
});

test("EscalationManager via barrel export - EscalationReason enum", () => {
  assert.strictEqual(EscalationReason.TIMEOUT, "timeout");
  assert.strictEqual(EscalationReason.QUORUM_NOT_MET, "quorum_not_met");
  assert.strictEqual(EscalationReason.MANUAL, "manual");
  assert.strictEqual(EscalationReason.CRITICAL_RISK, "critical_risk");
});

// ============================================================================
// Approval Flow Engine Tests (via barrel export)
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

test("ApprovalFlowEngine via barrel export - FlowType enum", () => {
  assert.strictEqual(FlowType.SINGLE, "single");
  assert.strictEqual(FlowType.MULTI_PARTY, "multi_party");
  assert.strictEqual(FlowType.DELEGATED, "delegated");
  assert.strictEqual(FlowType.SEQUENTIAL_CHAIN, "sequential_chain");
});

test("ApprovalFlowEngine via barrel export - FlowStatus enum", () => {
  assert.strictEqual(FlowStatus.PENDING, "pending");
  assert.strictEqual(FlowStatus.APPROVED, "approved");
  assert.strictEqual(FlowStatus.REJECTED, "rejected");
  assert.strictEqual(FlowStatus.EXPIRED, "expired");
  assert.strictEqual(FlowStatus.ESCALATED, "escalated");
  assert.strictEqual(FlowStatus.MAX_ITERATIONS_REACHED, "max_iterations_reached");
  assert.strictEqual(FlowStatus.CANCELLED, "cancelled");
});

test("ApprovalFlowEngine via barrel export - createFlow creates single-party flow", () => {
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
});

test("ApprovalFlowEngine via barrel export - submitVote approves single-party flow", () => {
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

test("ApprovalFlowEngine via barrel export - submitVote rejects single-party flow", () => {
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

test("ApprovalFlowEngine via barrel export - submitVote returns error for non-existent flow", () => {
  const engine = new ApprovalFlowEngine();

  const result = engine.submitVote("nonexistent", "user1", VoteType.APPROVE);

  assert.strictEqual(result.success, false);
  assert.ok(result.error?.includes("not found"));
});

test("ApprovalFlowEngine via barrel export - delegateApproval creates delegation", () => {
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

test("ApprovalFlowEngine via barrel export - getFlowStatus returns flow", () => {
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

test("ApprovalFlowEngine via barrel export - getFlowStatus returns null for non-existent", () => {
  const engine = new ApprovalFlowEngine();

  const result = engine.getFlowStatus("nonexistent");

  assert.strictEqual(result, null);
});

test("ApprovalFlowEngine via barrel export - finalizeFlow sets status", () => {
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

test("ApprovalFlowEngine via barrel export - getFlowsForTask returns flows for task", () => {
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

test("ApprovalFlowEngine via barrel export - getPendingFlows returns only pending", () => {
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

test("ApprovalFlowEngine via barrel export - createMultiPartyFlow", () => {
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
});

test("ApprovalFlowEngine via barrel export - createSinglePartyFlow", () => {
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

test("ApprovalFlowEngine via barrel export - checkEscalation returns null for non-pending", () => {
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

  // Check escalation on closed flow
  const context = engine.checkEscalation(flow.flowId);

  assert.strictEqual(context, null);
});

test("ApprovalFlowEngine via barrel export - addFeedback reject_with_guidance increments iteration", () => {
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
    guidance: "Please reconsider",
    principal: "admin",
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.newIteration, 1);
  assert.strictEqual(result.shouldReplan, true);
});

test("ApprovalFlowEngine via barrel export - addFeedback approve finalizes flow", () => {
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

test("ApprovalFlowEngine via barrel export - addFeedback max iterations reached", () => {
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

  // Use all iterations
  engine.addFeedback(flow.flowId, { feedbackType: "reject_with_guidance", guidance: "Iter 1", principal: "admin" });
  engine.addFeedback(flow.flowId, { feedbackType: "reject_with_guidance", guidance: "Iter 2", principal: "admin" });

  // Third iteration should fail
  const result = engine.addFeedback(flow.flowId, { feedbackType: "reject_with_guidance", guidance: "Iter 3", principal: "admin" });

  assert.strictEqual(result.success, false);
  assert.ok(result.error?.includes("Max iterations"));
});

test("ApprovalFlowEngine via barrel export - checkMaxIterations", () => {
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

test("ApprovalFlowEngine via barrel export - getQuorumStatus", () => {
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

test("ApprovalFlowEngine via barrel export - getQuorumStatus returns null for non-quorum flow", () => {
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

  const status = engine.getQuorumStatus(flow.flowId);

  assert.strictEqual(status, null);
});

// ============================================================================
// Type Export Tests
// ============================================================================

test("ApprovalRequest type can be constructed correctly", () => {
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
  const decisionTypes: ApprovalDecision["decisionType"][] = [
    "option_selected",
    "confirmed",
    "text_input",
    "rejected",
    "expired",
  ];

  for (const dt of decisionTypes) {
    const decision: ApprovalDecision = {
      approvalId: "test",
      decisionType: dt,
      respondedBy: "user",
      respondedAt: new Date().toISOString(),
      ...(dt === "option_selected" ? { selectedOptionId: "opt" } : {}),
      ...(dt === "confirmed" ? { confirmed: true } : {}),
      ...(dt === "text_input" ? { inputText: "text" } : {}),
    };
    assert.equal(decision.decisionType, dt);
  }
});

test("ApprovalTimeoutConfig type structure", () => {
  const config: ApprovalTimeoutConfig = {
    warnAfterMs: 60000,
    escalateAfterMs: 120000,
    autoActionAfterMs: 86400000,
    autoAction: "deny",
  };

  assert.equal(config.warnAfterMs, 60000);
  assert.equal(config.autoAction, "deny");
});

test("FeedbackLoopConfig type structure", () => {
  const config: FeedbackLoopConfig = {
    maxIterations: 5,
    requireReplanOnReject: true,
  };

  assert.equal(config.maxIterations, 5);
  assert.equal(config.requireReplanOnReject, true);
});

test("HumanFeedback type structure", () => {
  const feedback: HumanFeedback = {
    iteration: 1,
    feedbackType: "reject_with_guidance",
    guidance: "Please reconsider",
    timestamp: "2026-04-14T00:00:00.000Z",
    principal: "admin",
  };

  assert.equal(feedback.iteration, 1);
  assert.equal(feedback.feedbackType, "reject_with_guidance");
});

test("ApprovalFlowConfig type structure", () => {
  const config: ApprovalFlowConfig = {
    flowId: "flow_1",
    flowType: FlowType.SINGLE,
    approvers: [{ type: "user", identifier: "admin", can_delegate: true }],
    timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
    escalation: {
      escalateTo: { type: "role", identifier: "superadmin", can_delegate: false },
      maxEscalationDepth: 3,
      notificationChannels: [],
      escalationTimeoutMs: 30000,
    },
  };

  assert.equal(config.flowId, "flow_1");
  assert.equal(config.flowType, FlowType.SINGLE);
  assert.equal(config.approvers.length, 1);
});
