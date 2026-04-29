/**
 * Unit tests for ApprovalFlowTypes - additional coverage
 * Tests interfaces, constants, and type relationships
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  FlowType,
  FlowStatus,
  DEFAULT_TIMEOUT_CONFIG,
  DEFAULT_ESCALATION_RULE,
  DEFAULT_FEEDBACK_LOOP_CONFIG,
  type ApprovalFlowConfig,
  type ApprovalFlowState,
  type HumanFeedback,
  type FeedbackLoop,
  type ApprovalTimeoutConfig,
  type FeedbackLoopConfig,
  type FlowEscalationLevel,
  type VoteResult,
  type FeedbackResult,
} from "../../../../../src/platform/control-plane/approval-center/approval-flow-types.js";
import { EscalationReason, DelegationStatus } from "../../../../../src/platform/control-plane/approval-center/escalation-manager.js";

test("ApprovalTimeoutConfig interface structure", () => {
  const config: ApprovalTimeoutConfig = {
    warnAfterMs: 30 * 60 * 1000,
    escalateAfterMs: 60 * 60 * 1000,
    autoActionAfterMs: 2 * 60 * 60 * 1000,
    autoAction: "approve",
  };

  assert.equal(config.warnAfterMs, 1800000);
  assert.equal(config.escalateAfterMs, 3600000);
  assert.equal(config.autoActionAfterMs, 7200000);
  assert.equal(config.autoAction, "approve");
});

test("FeedbackLoopConfig interface structure", () => {
  const config: FeedbackLoopConfig = {
    maxIterations: 3,
    requireReplanOnReject: false,
  };

  assert.equal(config.maxIterations, 3);
  assert.equal(config.requireReplanOnReject, false);
});

test("HumanFeedback interface structure", () => {
  const feedback: HumanFeedback = {
    iteration: 1,
    feedbackType: "approve",
    guidance: "Looks good",
    modifiedArtifactRef: "artifact-123",
    timestamp: "2026-04-24T10:00:00.000Z",
    principal: "admin",
  };

  assert.equal(feedback.iteration, 1);
  assert.equal(feedback.feedbackType, "approve");
  assert.equal(feedback.guidance, "Looks good");
  assert.equal(feedback.modifiedArtifactRef, "artifact-123");
  assert.equal(feedback.timestamp, "2026-04-24T10:00:00.000Z");
  assert.equal(feedback.principal, "admin");
});

test("HumanFeedback with reject_with_guidance type", () => {
  const feedback: HumanFeedback = {
    iteration: 2,
    feedbackType: "reject_with_guidance",
    guidance: "Please fix the security issue",
    timestamp: "2026-04-24T10:00:00.000Z",
    principal: "reviewer",
  };

  assert.equal(feedback.feedbackType, "reject_with_guidance");
  assert.equal(feedback.guidance, "Please fix the security issue");
  assert.equal(feedback.modifiedArtifactRef, undefined);
});

test("HumanFeedback with modify_directly type", () => {
  const feedback: HumanFeedback = {
    iteration: 1,
    feedbackType: "modify_directly",
    modifiedArtifactRef: "artifact-456",
    timestamp: "2026-04-24T10:00:00.000Z",
    principal: "operator",
  };

  assert.equal(feedback.feedbackType, "modify_directly");
  assert.equal(feedback.modifiedArtifactRef, "artifact-456");
});

test("FeedbackLoop interface structure", () => {
  const loop: FeedbackLoop = {
    loopId: "loop-123",
    harnessRunId: "harness-456",
    nodeRunId: "node-789",
    workflowRunId: "wf-456",
    stepId: "step-789",
    maxIterations: 5,
    currentIteration: 2,
    humanFeedback: [],
  };

  assert.equal(loop.loopId, "loop-123");
  assert.equal(loop.harnessRunId, "harness-456");
  assert.equal(loop.nodeRunId, "node-789");
  assert.equal(loop.workflowRunId, "wf-456");
  assert.equal(loop.stepId, "step-789");
  assert.equal(loop.maxIterations, 5);
  assert.equal(loop.currentIteration, 2);
  assert.ok(Array.isArray(loop.humanFeedback));
});

test("FeedbackLoop with feedback items", () => {
  const loop: FeedbackLoop = {
    loopId: "loop-123",
    harnessRunId: "harness-456",
    nodeRunId: "node-789",
    workflowRunId: "wf-456",
    stepId: "step-789",
    maxIterations: 5,
    currentIteration: 3,
    humanFeedback: [
      {
        iteration: 1,
        feedbackType: "reject_with_guidance",
        guidance: "Fix issue 1",
        timestamp: "2026-04-24T10:00:00.000Z",
        principal: "user1",
      },
      {
        iteration: 2,
        feedbackType: "reject_with_guidance",
        guidance: "Fix issue 2",
        timestamp: "2026-04-24T10:05:00.000Z",
        principal: "user2",
      },
      {
        iteration: 3,
        feedbackType: "approve",
        timestamp: "2026-04-24T10:10:00.000Z",
        principal: "user1",
      },
    ],
  };

  assert.equal(loop.humanFeedback.length, 3);
  assert.equal(loop.humanFeedback[0]!.feedbackType, "reject_with_guidance");
  assert.equal(loop.humanFeedback[2]!.feedbackType, "approve");
});

test("FlowEscalationLevel interface structure", () => {
  const level: FlowEscalationLevel = {
    level: 2,
    escalateTo: { type: "role", identifier: "senior-admin", can_delegate: true },
    escalatedAt: "2026-04-24T10:00:00.000Z",
    escalatedBy: "system",
    reason: EscalationReason.TIMEOUT,
    sourceApprovalId: "approval-123",
  };

  assert.equal(level.level, 2);
  assert.equal(level.escalateTo.type, "role");
  assert.equal(level.escalateTo.identifier, "senior-admin");
  assert.equal(level.escalatedBy, "system");
  assert.equal(level.reason, "timeout");
  assert.equal(level.sourceApprovalId, "approval-123");
});

test("VoteResult interface structure", () => {
  const result: VoteResult = {
    success: true,
    quorumStatus: {
      isQuorumMet: true,
      isDenied: false,
      approvalsReceived: 2,
      rejectionsReceived: 0,
      abstentionsReceived: 0,
      remainingApprovalsNeeded: 0,
      remainingRejectionsNeeded: 2,
      isVotingWindowExpired: false,
      uniqueApprovers: new Set(["user1", "user2"]),
    },
    flowStatus: FlowStatus.APPROVED,
  };

  assert.equal(result.success, true);
  assert.equal(result.quorumStatus.isQuorumMet, true);
  assert.equal(result.flowStatus, "approved");
  assert.equal(result.error, undefined);
});

test("VoteResult with error", () => {
  const result: VoteResult = {
    success: false,
    quorumStatus: {
      isQuorumMet: false,
      isDenied: false,
      approvalsReceived: 0,
      rejectionsReceived: 0,
      abstentionsReceived: 0,
      remainingApprovalsNeeded: 2,
      remainingRejectionsNeeded: 2,
      isVotingWindowExpired: false,
      uniqueApprovers: new Set(),
    },
    flowStatus: FlowStatus.PENDING,
    error: "Flow not found",
  };

  assert.equal(result.success, false);
  assert.ok(result.error);
  assert.equal(result.error, "Flow not found");
});

test("FeedbackResult interface structure", () => {
  const result: FeedbackResult = {
    success: true,
    newIteration: 3,
    flowStatus: FlowStatus.PENDING,
    shouldReplan: true,
  };

  assert.equal(result.success, true);
  assert.equal(result.newIteration, 3);
  assert.equal(result.flowStatus, "pending");
  assert.equal(result.shouldReplan, true);
});

test("FeedbackResult without replan", () => {
  const result: FeedbackResult = {
    success: true,
    newIteration: 1,
    flowStatus: FlowStatus.PENDING,
    shouldReplan: false,
  };

  assert.equal(result.shouldReplan, false);
});

test("ApprovalFlowConfig interface structure", () => {
  const config: ApprovalFlowConfig = {
    flowId: "flow-123",
    flowType: FlowType.MULTI_PARTY,
    approvers: [
      { type: "user", identifier: "user1", can_delegate: true },
      { type: "role", identifier: "admins", can_delegate: false },
    ],
    quorum: {
      minApprovals: 2,
      minRejectionsToDeny: 2,
      votingWindowMs: 60000,
    },
    timeout: {
      warnAfterMs: 30000,
      escalateAfterMs: 60000,
      autoActionAfterMs: 3600000,
      autoAction: "deny",
    },
    escalation: {
      escalateTo: { type: "role", identifier: "senior-admin", can_delegate: true },
      maxEscalationDepth: 5,
      notificationChannels: [],
      escalationTimeoutMs: 300000,
    },
    feedbackLoop: {
      maxIterations: 10,
      requireReplanOnReject: true,
    },
  };

  assert.equal(config.flowId, "flow-123");
  assert.equal(config.flowType, "multi_party");
  assert.equal(config.approvers.length, 2);
  assert.ok(config.quorum);
  assert.ok(config.feedbackLoop);
});

test("ApprovalFlowState interface structure", () => {
  const state: ApprovalFlowState = {
    flowId: "flow-123",
    config: {
      flowId: "flow-123",
      flowType: FlowType.SINGLE,
      approvers: [{ type: "user", identifier: "admin", can_delegate: true }],
      timeout: DEFAULT_TIMEOUT_CONFIG,
      escalation: DEFAULT_ESCALATION_RULE,
    },
    request: {
      approvalId: "approval-123",
      taskId: "task-456",
      executionId: null,
      sourceAgentId: "agent-789",
      reason: "Test",
      riskLevel: "high",
      options: [],
      context: {},
      timeoutPolicy: "reject",
      createdAt: "2026-04-24T10:00:00.000Z",
      requiredApprovals: 1,
      approverGroups: [],
      approvalsReceived: 0,
    },
    status: FlowStatus.PENDING,
    currentIteration: 0,
    votes: [],
    votingStartedAt: "2026-04-24T10:00:00.000Z",
    escalationHistory: [],
    delegation: null,
    feedbackLoop: null,
    createdAt: "2026-04-24T10:00:00.000Z",
    updatedAt: "2026-04-24T10:00:00.000Z",
    expiresAt: "2026-04-25T10:00:00.000Z",
    warningsSent: [],
    escalationTriggered: false,
  };

  assert.equal(state.flowId, "flow-123");
  assert.equal(state.status, FlowStatus.PENDING);
  assert.equal(state.currentIteration, 0);
  assert.ok(state.config);
  assert.ok(state.request);
  assert.ok(Array.isArray(state.votes));
  assert.ok(Array.isArray(state.escalationHistory));
});

test("FlowType values match expected strings", () => {
  assert.equal(FlowType.SINGLE, "single");
  assert.equal(FlowType.MULTI_PARTY, "multi_party");
  assert.equal(FlowType.DELEGATED, "delegated");
  assert.equal(FlowType.SEQUENTIAL_CHAIN, "sequential_chain");
});

test("FlowStatus values match expected strings", () => {
  assert.equal(FlowStatus.PENDING, "pending");
  assert.equal(FlowStatus.APPROVED, "approved");
  assert.equal(FlowStatus.REJECTED, "rejected");
  assert.equal(FlowStatus.EXPIRED, "expired");
  assert.equal(FlowStatus.ESCALATED, "escalated");
  assert.equal(FlowStatus.MAX_ITERATIONS_REACHED, "max_iterations_reached");
  assert.equal(FlowStatus.CANCELLED, "cancelled");
});

test("DEFAULT_TIMEOUT_CONFIG values are correct", () => {
  assert.equal(DEFAULT_TIMEOUT_CONFIG.warnAfterMs, 3600000); // 1 hour
  assert.equal(DEFAULT_TIMEOUT_CONFIG.escalateAfterMs, 7200000); // 2 hours
  assert.equal(DEFAULT_TIMEOUT_CONFIG.autoActionAfterMs, 86400000); // 24 hours
  assert.equal(DEFAULT_TIMEOUT_CONFIG.autoAction, "deny");
});

test("DEFAULT_ESCALATION_RULE values are correct", () => {
  assert.equal(DEFAULT_ESCALATION_RULE.escalateTo.type, "role");
  assert.equal(DEFAULT_ESCALATION_RULE.escalateTo.identifier, "admin");
  assert.equal(DEFAULT_ESCALATION_RULE.escalateTo.can_delegate, true);
  assert.equal(DEFAULT_ESCALATION_RULE.maxEscalationDepth, 3);
  assert.deepEqual(DEFAULT_ESCALATION_RULE.notificationChannels, []);
  assert.equal(DEFAULT_ESCALATION_RULE.escalationTimeoutMs, 1800000); // 30 minutes
});

test("DEFAULT_FEEDBACK_LOOP_CONFIG values are correct", () => {
  assert.equal(DEFAULT_FEEDBACK_LOOP_CONFIG.maxIterations, 5);
  assert.equal(DEFAULT_FEEDBACK_LOOP_CONFIG.requireReplanOnReject, true);
});

test("ApprovalFlowConfig without optional quorum", () => {
  const config: ApprovalFlowConfig = {
    flowId: "flow-123",
    flowType: FlowType.SINGLE,
    approvers: [{ type: "user", identifier: "admin", can_delegate: true }],
    timeout: DEFAULT_TIMEOUT_CONFIG,
    escalation: DEFAULT_ESCALATION_RULE,
  };

  assert.equal(config.quorum, undefined);
});

test("ApprovalFlowConfig with notificationChannels", () => {
  const config: ApprovalFlowConfig = {
    flowId: "flow-123",
    flowType: FlowType.MULTI_PARTY,
    approvers: [{ type: "user", identifier: "admin", can_delegate: true }],
    timeout: DEFAULT_TIMEOUT_CONFIG,
    escalation: DEFAULT_ESCALATION_RULE,
    notificationChannels: [
      {
        type: "email" as any,
        address: "admin@example.com",
        enabled: true,
        priority: "high" as any,
      },
    ],
  };

  assert.ok(config.notificationChannels);
  assert.equal(config.notificationChannels!.length, 1);
});

test("ApprovalFlowState with delegation", () => {
  const state: ApprovalFlowState = {
    flowId: "flow-123",
    config: {
      flowId: "flow-123",
      flowType: FlowType.DELEGATED,
      approvers: [{ type: "user", identifier: "admin", can_delegate: true }],
      timeout: DEFAULT_TIMEOUT_CONFIG,
      escalation: DEFAULT_ESCALATION_RULE,
    },
    request: {
      approvalId: "approval-123",
      taskId: "task-456",
      executionId: null,
      sourceAgentId: "agent-789",
      reason: "Test",
      riskLevel: "high",
      options: [],
      context: {},
      timeoutPolicy: "reject",
      createdAt: "2026-04-24T10:00:00.000Z",
      requiredApprovals: 1,
      approverGroups: [],
      approvalsReceived: 0,
    },
    status: FlowStatus.PENDING,
    currentIteration: 0,
    votes: [],
    votingStartedAt: "2026-04-24T10:00:00.000Z",
    escalationHistory: [],
    delegation: {
      delegationId: "delegation-123",
      fromApprover: "user1",
      toApprover: "user2",
      delegatedAt: "2026-04-24T10:00:00.000Z",
      expiresAt: "2026-04-24T12:00:00.000Z",
      originalApprovalId: "approval-123",
      ttlResetCount: 0,
      maxTtlResets: 3,
      status: DelegationStatus.ACTIVE,
    },
    feedbackLoop: null,
    createdAt: "2026-04-24T10:00:00.000Z",
    updatedAt: "2026-04-24T10:00:00.000Z",
    expiresAt: null,
    warningsSent: [],
    escalationTriggered: false,
  };

  assert.ok(state.delegation);
  assert.equal(state.delegation!.delegationId, "delegation-123");
  assert.equal(state.delegation!.fromApprover, "user1");
  assert.equal(state.delegation!.toApprover, "user2");
});

test("ApprovalFlowState with feedbackLoop", () => {
  const state: ApprovalFlowState = {
    flowId: "flow-123",
    config: {
      flowId: "flow-123",
      flowType: FlowType.SINGLE,
      approvers: [{ type: "user", identifier: "admin", can_delegate: true }],
      timeout: DEFAULT_TIMEOUT_CONFIG,
      escalation: DEFAULT_ESCALATION_RULE,
      feedbackLoop: DEFAULT_FEEDBACK_LOOP_CONFIG,
    },
    request: {
      approvalId: "approval-123",
      taskId: "task-456",
      executionId: null,
      sourceAgentId: "agent-789",
      reason: "Test",
      riskLevel: "high",
      options: [],
      context: {},
      timeoutPolicy: "reject",
      createdAt: "2026-04-24T10:00:00.000Z",
      requiredApprovals: 1,
      approverGroups: [],
      approvalsReceived: 0,
    },
    status: FlowStatus.PENDING,
    currentIteration: 2,
    votes: [],
    votingStartedAt: "2026-04-24T10:00:00.000Z",
    escalationHistory: [],
    delegation: null,
    feedbackLoop: {
      loopId: "loop-123",
      harnessRunId: "harness-456",
      nodeRunId: "node-789",
      workflowRunId: "wf-456",
      stepId: "step-789",
      maxIterations: 5,
      currentIteration: 2,
      humanFeedback: [
        {
          iteration: 1,
          feedbackType: "reject_with_guidance",
          guidance: "Fix issue",
          timestamp: "2026-04-24T10:00:00.000Z",
          principal: "user1",
        },
        {
          iteration: 2,
          feedbackType: "reject_with_guidance",
          guidance: "Fix issue 2",
          timestamp: "2026-04-24T10:05:00.000Z",
          principal: "user2",
        },
      ],
    },
    createdAt: "2026-04-24T10:00:00.000Z",
    updatedAt: "2026-04-24T10:10:00.000Z",
    expiresAt: null,
    warningsSent: [],
    escalationTriggered: false,
  };

  assert.ok(state.feedbackLoop);
  assert.equal(state.feedbackLoop!.currentIteration, 2);
  assert.equal(state.feedbackLoop!.humanFeedback.length, 2);
});

test("ApprovalFlowState with warningsSent", () => {
  const state: ApprovalFlowState = {
    flowId: "flow-123",
    config: {
      flowId: "flow-123",
      flowType: FlowType.SINGLE,
      approvers: [{ type: "user", identifier: "admin", can_delegate: true }],
      timeout: DEFAULT_TIMEOUT_CONFIG,
      escalation: DEFAULT_ESCALATION_RULE,
    },
    request: {
      approvalId: "approval-123",
      taskId: "task-456",
      executionId: null,
      sourceAgentId: "agent-789",
      reason: "Test",
      riskLevel: "high",
      options: [],
      context: {},
      timeoutPolicy: "reject",
      createdAt: "2026-04-24T10:00:00.000Z",
      requiredApprovals: 1,
      approverGroups: [],
      approvalsReceived: 0,
    },
    status: FlowStatus.PENDING,
    currentIteration: 0,
    votes: [],
    votingStartedAt: "2026-04-24T10:00:00.000Z",
    escalationHistory: [],
    delegation: null,
    feedbackLoop: null,
    createdAt: "2026-04-24T10:00:00.000Z",
    updatedAt: "2026-04-24T10:00:00.000Z",
    expiresAt: null,
    warningsSent: ["warning-1", "warning-2"],
    escalationTriggered: false,
  };

  assert.equal(state.warningsSent.length, 2);
  assert.equal(state.warningsSent[0], "warning-1");
});

test("ApprovalFlowState with escalationHistory", () => {
  const state: ApprovalFlowState = {
    flowId: "flow-123",
    config: {
      flowId: "flow-123",
      flowType: FlowType.SINGLE,
      approvers: [{ type: "user", identifier: "admin", can_delegate: true }],
      timeout: DEFAULT_TIMEOUT_CONFIG,
      escalation: DEFAULT_ESCALATION_RULE,
    },
    request: {
      approvalId: "approval-123",
      taskId: "task-456",
      executionId: null,
      sourceAgentId: "agent-789",
      reason: "Test",
      riskLevel: "high",
      options: [],
      context: {},
      timeoutPolicy: "reject",
      createdAt: "2026-04-24T10:00:00.000Z",
      requiredApprovals: 1,
      approverGroups: [],
      approvalsReceived: 0,
    },
    status: FlowStatus.ESCALATED,
    currentIteration: 0,
    votes: [],
    votingStartedAt: "2026-04-24T10:00:00.000Z",
    escalationHistory: [
      {
        level: 1,
        escalateTo: { type: "role", identifier: "senior-admin", can_delegate: true },
        escalatedAt: "2026-04-24T10:30:00.000Z",
        escalatedBy: "system",
        reason: EscalationReason.TIMEOUT,
        sourceApprovalId: "approval-123",
      },
    ],
    delegation: null,
    feedbackLoop: null,
    createdAt: "2026-04-24T10:00:00.000Z",
    updatedAt: "2026-04-24T10:30:00.000Z",
    expiresAt: null,
    warningsSent: [],
    escalationTriggered: true,
  };

  assert.equal(state.status, FlowStatus.ESCALATED);
  assert.equal(state.escalationHistory.length, 1);
  assert.equal(state.escalationTriggered, true);
});
