/**
 * Integration Tests: Approval Center
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  validateApprovalDecision,
  type ApprovalDecision,
} from "../../../../../src/platform/five-plane-control-plane/approval-center/index.js";

import {
  QuorumConfig,
  QuorumVote,
  VoteType,
  createInitialQuorumStatus,
  calculateQuorumStatus,
  isQuorumMet,
  mergeVotes,
  createVote,
  determineFinalStatus,
} from "../../../../../src/platform/five-plane-control-plane/approval-center/index.js";

import {
  EscalationManager,
  NotificationPriority,
  DelegationStatus,
} from "../../../../../src/platform/five-plane-control-plane/approval-center/index.js";

import {
  ApprovalFlowEngine,
  FlowType,
  FlowStatus,
} from "../../../../../src/platform/five-plane-control-plane/approval-center/index.js";

// ============================================================================
// Approval Decision Validation Integration
// ============================================================================

test("integration: option_selected followed by quorum check", () => {
  const decision: ApprovalDecision = {
    approvalId: "approval_integ_001",
    decisionType: "option_selected",
    selectedOptionId: "approve_option_1",
    respondedBy: "approver_001",
    respondedAt: "2026-04-29T00:00:00.000Z",
  };

  assert.doesNotThrow(() => validateApprovalDecision(decision));

  const config: QuorumConfig = {
    minApprovals: 1,
    minRejectionsToDeny: 2,
  };

  const vote: QuorumVote = {
    approverId: "approver_001",
    voteType: VoteType.APPROVE,
    votedAt: decision.respondedAt,
  };

  const status = calculateQuorumStatus([vote], config, vote.votedAt, vote.votedAt);

  assert.equal(isQuorumMet(status), true);
});

test("integration: multiple option_selected decisions with quorum", () => {
  const decisions: ApprovalDecision[] = [
    {
      approvalId: "approval_integ_002",
      decisionType: "option_selected",
      selectedOptionId: "option_a",
      respondedBy: "approver_001",
      respondedAt: "2026-04-29T00:00:00.000Z",
    },
    {
      approvalId: "approval_integ_002",
      decisionType: "option_selected",
      selectedOptionId: "option_a",
      respondedBy: "approver_002",
      respondedAt: "2026-04-29T00:01:00.000Z",
    },
  ];

  decisions.forEach((d) => assert.doesNotThrow(() => validateApprovalDecision(d)));

  const config: QuorumConfig = {
    minApprovals: 2,
    minRejectionsToDeny: 2,
  };

  const votes: QuorumVote[] = [
    createVote("approver_001", VoteType.APPROVE),
    createVote("approver_002", VoteType.APPROVE),
  ];

  const merged = votes.reduce((acc, vote) => mergeVotes(acc, vote), [] as QuorumVote[]);
  const status = calculateQuorumStatus(merged, config, votes[0].votedAt, votes[1].votedAt);

  assert.equal(isQuorumMet(status), true);
  assert.equal(determineFinalStatus(status, config), "approved");
});

test("integration: rejected decision cascades to siblings", () => {
  const rejectDecision: ApprovalDecision = {
    approvalId: "approval_sibling_001",
    decisionType: "rejected",
    respondedBy: "approver_001",
    respondedAt: "2026-04-29T00:00:00.000Z",
  };

  assert.doesNotThrow(() => validateApprovalDecision(rejectDecision));

  const pendingDecision: ApprovalDecision = {
    approvalId: "approval_sibling_002",
    decisionType: "option_selected",
    selectedOptionId: "option_a",
    respondedBy: "approver_002",
    respondedAt: "2026-04-29T00:01:00.000Z",
  };

  assert.doesNotThrow(() => validateApprovalDecision(pendingDecision));
});

// ============================================================================
// Escalation Manager Integration
// ============================================================================

test("integration: escalation manager creates notification", () => {
  const manager = new EscalationManager();

  const notification = manager.createNotification({
    channelType: "email",
    priority: NotificationPriority.HIGH,
    recipientId: "approver_001",
    templateId: "approval_required",
    context: {
      approvalId: "approval_escalate_001",
      taskId: "task_001",
      reason: "High-risk operation requires approval",
    },
  });

  assert.equal(notification.channelType, "email");
  assert.equal(notification.priority, NotificationPriority.HIGH);
  assert.ok(notification.notificationId.length > 0);
});

test("integration: escalation manager delegates approval", () => {
  const manager = new EscalationManager();

  const delegation = manager.delegateApproval({
    originalApproverId: "approver_001",
    delegateApproverId: "approver_002",
    reason: "Primary approver unavailable",
    approvalId: "approval_delegate_001",
  });

  assert.equal(delegation.originalApproverId, "approver_001");
  assert.equal(delegation.delegateApproverId, "approver_002");
  assert.equal(delegation.status, DelegationStatus.ACTIVE);
  assert.ok(delegation.delegatedAt.length > 0);
});

// ============================================================================
// Approval Flow Engine Integration
// ============================================================================

test("integration: approval flow engine creates flow", () => {
  const engine = new ApprovalFlowEngine();

  const flow = engine.createFlow({
    flowType: FlowType.HUMAN_REVIEW,
    taskId: "task_flow_001",
    executionId: "exec_flow_001",
    config: {
      timeoutMs: 3600000,
      reminderIntervalMs: 900000,
    },
  });

  assert.equal(flow.flowType, FlowType.HUMAN_REVIEW);
  assert.equal(flow.status, FlowStatus.PENDING);
  assert.ok(flow.flowId.length > 0);
});

test("integration: approval flow transitions through states", () => {
  const engine = new ApprovalFlowEngine();

  const flow = engine.createFlow({
    flowType: FlowType.MULTI_PARTY,
    taskId: "task_flow_002",
    executionId: "exec_flow_002",
    config: {
      timeoutMs: 7200000,
      reminderIntervalMs: 1800000,
    },
  });

  const started = engine.startFlow(flow.flowId);
  assert.equal(started.status, FlowStatus.IN_PROGRESS);

  const completed = engine.completeFlow(flow.flowId, {
    outcome: "approved",
    summary: "All approvers approved",
  });
  assert.equal(completed.status, FlowStatus.COMPLETED);
  assert.ok(completed.completedAt.length > 0);
});

test("integration: approval flow times out", () => {
  const engine = new ApprovalFlowEngine();

  const flow = engine.createFlow({
    flowType: FlowType.SINGLE_APPROVER,
    taskId: "task_flow_003",
    executionId: "exec_flow_003",
    config: {
      timeoutMs: 1000,
      reminderIntervalMs: 500,
    },
  });

  engine.startFlow(flow.flowId);

  const expired = engine.expireFlow(flow.flowId);
  assert.equal(expired.status, FlowStatus.EXPIRED);
});

test("integration: approval flow handles rejection", () => {
  const engine = new ApprovalFlowEngine();

  const flow = engine.createFlow({
    flowType: FlowType.SINGLE_APPROVER,
    taskId: "task_flow_004",
    executionId: "exec_flow_004",
    config: {
      timeoutMs: 3600000,
    },
  });

  engine.startFlow(flow.flowId);

  const rejected = engine.completeFlow(flow.flowId, {
    outcome: "rejected",
    summary: "Operation deemed too risky",
  });
  assert.equal(rejected.status, FlowStatus.COMPLETED);
  assert.equal(rejected.outcome, "rejected");
});
