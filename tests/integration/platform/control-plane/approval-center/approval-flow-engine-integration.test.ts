/**
 * Integration Test: Approval Flow Engine
 *
 * Verifies the complete approval flow orchestration with quorum voting,
 * escalation, delegation, and feedback loop support.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ApprovalFlowEngine, FlowType, FlowStatus } from "../../../../../src/platform/control-plane/approval-center/approval-flow-engine.js";
import { VoteType } from "../../../../../src/platform/control-plane/approval-center/quorum-calculator.js";
import { nowIso, newId } from "../../../../../src/platform/contracts/types/ids.js";
import type { ApprovalRequest } from "../../../../../src/platform/control-plane/approval-center/approval-service.js";

function createTestApprovalRequest(approvalId: string, taskId: string): ApprovalRequest {
  return {
    approvalId,
    taskId,
    executionId: null,
    sourceAgentId: "test-agent",
    reason: "Test approval flow",
    riskLevel: "high",
    options: ["approve", "reject"] as const,
    context: {},
    timeoutPolicy: "remain_pending",
    createdAt: nowIso(),
    requiredApprovals: 1,
    approverGroups: [],
    approvalsReceived: 0,
  };
}

function createTestApproverRules() {
  return [
    { type: "user" as const, identifier: "approver-1", can_delegate: true },
    { type: "user" as const, identifier: "approver-2", can_delegate: true },
    { type: "role" as const, identifier: "admin", can_delegate: false },
  ];
}

test("approval flow engine: createFlow creates single-party flow", () => {
  const engine = new ApprovalFlowEngine();
  const request = createTestApprovalRequest("approval-flow-1", "task-1");

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: createTestApproverRules().slice(0, 1),
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "admin", can_delegate: true },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 1800000,
      },
    },
    request,
  );

  assert.ok(flow.flowId.startsWith("flow_"));
  assert.strictEqual(flow.status, FlowStatus.PENDING);
  assert.strictEqual(flow.config.flowType, FlowType.SINGLE);
  assert.strictEqual(flow.votes.length, 0);
});

test("approval flow engine: createMultiPartyFlow creates flow with quorum", () => {
  const engine = new ApprovalFlowEngine();
  const request = createTestApprovalRequest("approval-flow-2", "task-2");
  const approvers = createTestApproverRules();

  const flow = engine.createMultiPartyFlow(request, 2, approvers);

  assert.strictEqual(flow.config.flowType, FlowType.MULTI_PARTY);
  assert.ok(flow.config.quorum);
  assert.strictEqual(flow.config.quorum!.minApprovals, 2);
  assert.strictEqual(flow.config.quorum!.minRejectionsToDeny, 2);
});

test("approval flow engine: submitVote approves single-party flow", () => {
  const engine = new ApprovalFlowEngine();
  const request = createTestApprovalRequest("approval-flow-3", "task-3");

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: createTestApproverRules().slice(0, 1),
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "admin", can_delegate: true },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 1800000,
      },
    },
    request,
  );

  const result = engine.submitVote(flow.flowId, "approver-1", VoteType.APPROVE);

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.flowStatus, FlowStatus.APPROVED);
  assert.strictEqual(result.quorumStatus.approvalsReceived, 1);
});

test("approval flow engine: submitVote rejects single-party flow", () => {
  const engine = new ApprovalFlowEngine();
  const request = createTestApprovalRequest("approval-flow-4", "task-4");

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: createTestApproverRules().slice(0, 1),
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "admin", can_delegate: true },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 1800000,
      },
    },
    request,
  );

  const result = engine.submitVote(flow.flowId, "approver-1", VoteType.REJECT);

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.flowStatus, FlowStatus.REJECTED);
});

test("approval flow engine: submitVote returns error for unknown flow", () => {
  const engine = new ApprovalFlowEngine();

  const result = engine.submitVote("unknown-flow", "approver-1", VoteType.APPROVE);

  assert.strictEqual(result.success, false);
  assert.ok(result.error!.includes("not found"));
});

test("approval flow engine: submitVote returns error for non-pending flow", () => {
  const engine = new ApprovalFlowEngine();
  const request = createTestApprovalRequest("approval-flow-5", "task-5");

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: createTestApproverRules().slice(0, 1),
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "admin", can_delegate: true },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 1800000,
      },
    },
    request,
  );

  // First vote approves
  engine.submitVote(flow.flowId, "approver-1", VoteType.APPROVE);

  // Second vote should fail - flow is no longer pending
  const result = engine.submitVote(flow.flowId, "approver-1", VoteType.REJECT);

  assert.strictEqual(result.success, false);
  assert.ok(result.error!.includes("not pending"));
});

test("approval flow engine: multi-party quorum requires multiple approvals", () => {
  const engine = new ApprovalFlowEngine();
  const request = createTestApprovalRequest("approval-flow-6", "task-6");
  const approvers = createTestApproverRules();

  const flow = engine.createMultiPartyFlow(request, 2, approvers);

  // First approval
  const result1 = engine.submitVote(flow.flowId, "approver-1", VoteType.APPROVE);
  assert.strictEqual(result1.flowStatus, FlowStatus.PENDING);
  assert.strictEqual(result1.quorumStatus.approvalsReceived, 1);

  // Second approval - quorum reached
  const result2 = engine.submitVote(flow.flowId, "approver-2", VoteType.APPROVE);
  assert.strictEqual(result2.flowStatus, FlowStatus.APPROVED);
  assert.strictEqual(result2.quorumStatus.approvalsReceived, 2);
});

test("approval flow engine: multi-party rejection by one approver denies with threshold", () => {
  const engine = new ApprovalFlowEngine();
  const request = createTestApprovalRequest("approval-flow-7", "task-7");
  const approvers = createTestApproverRules();

  const flow = engine.createMultiPartyFlow(request, 2, approvers, { minRejectionsToDeny: 1 });

  const result = engine.submitVote(flow.flowId, "approver-1", VoteType.REJECT);

  assert.strictEqual(result.flowStatus, FlowStatus.REJECTED);
  assert.strictEqual(result.quorumStatus.rejectionsReceived, 1);
});

test("approval flow engine: checkEscalation returns context when timeout exceeded", () => {
  const engine = new ApprovalFlowEngine();
  const request = createTestApprovalRequest("approval-flow-8", "task-8");

  // Create flow with very short escalate threshold
  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: createTestApproverRules().slice(0, 1),
      timeout: { warnAfterMs: 1, escalateAfterMs: 1, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "admin", can_delegate: true },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 1800000,
      },
    },
    request,
  );

  // Wait for timeout
  const start = Date.now();
  while (Date.now() - start < 10) {
    // busy wait
  }

  const escalationContext = engine.checkEscalation(flow.flowId);

  assert.ok(escalationContext);
  assert.strictEqual(escalationContext!.approvalId, request.approvalId);
  assert.strictEqual(escalationContext!.reason, "timeout");
});

test("approval flow engine: checkEscalation returns null for pending flow within threshold", () => {
  const engine = new ApprovalFlowEngine();
  const request = createTestApprovalRequest("approval-flow-9", "task-9");

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: createTestApproverRules().slice(0, 1),
      timeout: { warnAfterMs: 86400000, escalateAfterMs: 86400000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "admin", can_delegate: true },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 1800000,
      },
    },
    request,
  );

  const escalationContext = engine.checkEscalation(flow.flowId);

  assert.strictEqual(escalationContext, null);
});

test("approval flow engine: delegateApproval creates delegation", () => {
  const engine = new ApprovalFlowEngine();
  const request = createTestApprovalRequest("approval-flow-10", "task-10");

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: createTestApproverRules(),
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "admin", can_delegate: true },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 1800000,
      },
    },
    request,
  );

  const result = engine.delegateApproval(flow.flowId, "approver-1", "approver-2");

  assert.strictEqual(result.success, true);
  assert.ok(result.delegation);
  assert.strictEqual(result.delegation!.fromApprover, "approver-1");
  assert.strictEqual(result.delegation!.toApprover, "approver-2");
});

test("approval flow engine: delegateApproval fails for non-pending flow", () => {
  const engine = new ApprovalFlowEngine();
  const request = createTestApprovalRequest("approval-flow-11", "task-11");

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: createTestApproverRules().slice(0, 1),
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "admin", can_delegate: true },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 1800000,
      },
    },
    request,
  );

  // Approve the flow first
  engine.submitVote(flow.flowId, "approver-1", VoteType.APPROVE);

  // Try to delegate after flow is no longer pending
  const result = engine.delegateApproval(flow.flowId, "approver-1", "approver-2");

  assert.strictEqual(result.success, false);
  assert.ok(result.error!.includes("not pending"));
});

test("approval flow engine: addFeedback adds feedback to loop", () => {
  const engine = new ApprovalFlowEngine();
  const request = createTestApprovalRequest("approval-flow-12", "task-12");

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: createTestApproverRules().slice(0, 1),
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "admin", can_delegate: true },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 1800000,
      },
      feedbackLoop: { maxIterations: 5, requireReplanOnReject: true },
    },
    request,
  );

  const result = engine.addFeedback(flow.flowId, {
    feedbackType: "approve",
    principal: "operator-1",
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.newIteration, 1);
  assert.strictEqual(result.flowStatus, FlowStatus.APPROVED);
  assert.strictEqual(result.shouldReplan, false);
});

test("approval flow engine: addFeedback requires configured feedback loop to have iterations left", () => {
  const engine = new ApprovalFlowEngine();
  const request = createTestApprovalRequest("approval-flow-13", "task-13");

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: createTestApproverRules().slice(0, 1),
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "admin", can_delegate: true },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 1800000,
      },
      feedbackLoop: { maxIterations: 1, requireReplanOnReject: true },
    },
    request,
  );

  // First feedback uses up the only iteration
  const firstResult = engine.addFeedback(flow.flowId, {
    feedbackType: "reject_with_guidance",
    guidance: "Try again",
    principal: "operator-1",
  });

  // Second feedback should fail since max iterations reached
  const result = engine.addFeedback(flow.flowId, {
    feedbackType: "approve",
    principal: "operator-1",
  });

  assert.strictEqual(result.success, false);
  assert.ok(result.error!.includes("Max iterations"));
});

test("approval flow engine: reject_with_guidance sets shouldReplan flag", () => {
  const engine = new ApprovalFlowEngine();
  const request = createTestApprovalRequest("approval-flow-14", "task-14");

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: createTestApproverRules().slice(0, 1),
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "admin", can_delegate: true },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 1800000,
      },
      feedbackLoop: { maxIterations: 5, requireReplanOnReject: true },
    },
    request,
  );

  const result = engine.addFeedback(flow.flowId, {
    feedbackType: "reject_with_guidance",
    guidance: "Please reconsider the approach",
    principal: "operator-1",
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.newIteration, 1);
  assert.strictEqual(result.shouldReplan, true);
  assert.strictEqual(result.flowStatus, FlowStatus.PENDING);
});

test("approval flow engine: checkMaxIterations detects limit reached", () => {
  const engine = new ApprovalFlowEngine();
  const request = createTestApprovalRequest("approval-flow-15", "task-15");

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: createTestApproverRules().slice(0, 1),
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "admin", can_delegate: true },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 1800000,
      },
      feedbackLoop: { maxIterations: 2, requireReplanOnReject: true },
    },
    request,
  );

  // Add feedback twice to reach max iterations
  engine.addFeedback(flow.flowId, { feedbackType: "reject_with_guidance", guidance: "Try again 1", principal: "operator-1" });
  engine.addFeedback(flow.flowId, { feedbackType: "reject_with_guidance", guidance: "Try again 2", principal: "operator-1" });

  const result = engine.checkMaxIterations(flow.flowId);

  assert.strictEqual(result, true);
});

test("approval flow engine: finalizeFlow sets final status", () => {
  const engine = new ApprovalFlowEngine();
  const request = createTestApprovalRequest("approval-flow-16", "task-16");

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: createTestApproverRules().slice(0, 1),
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "admin", can_delegate: true },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 1800000,
      },
    },
    request,
  );

  engine.finalizeFlow(flow.flowId, FlowStatus.CANCELLED);

  const flowState = engine.getFlowStatus(flow.flowId);
  assert.strictEqual(flowState!.status, FlowStatus.CANCELLED);
});

test("approval flow engine: getFlowsForTask returns flows for task", () => {
  const engine = new ApprovalFlowEngine();
  const request = createTestApprovalRequest("approval-flow-17", "task-17");

  engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: createTestApproverRules().slice(0, 1),
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "admin", can_delegate: true },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 1800000,
      },
    },
    request,
  );

  const flows = engine.getFlowsForTask("task-17");

  assert.strictEqual(flows.length, 1);
  assert.strictEqual(flows[0]!.request.taskId, "task-17");
});

test("approval flow engine: getPendingFlows returns only pending flows", () => {
  const engine = new ApprovalFlowEngine();

  const flow1 = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: createTestApproverRules().slice(0, 1),
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "admin", can_delegate: true },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 1800000,
      },
    },
    createTestApprovalRequest("approval-flow-18a", "task-18a"),
  );

  engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: createTestApproverRules().slice(0, 1),
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "admin", can_delegate: true },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 1800000,
      },
    },
    createTestApprovalRequest("approval-flow-18b", "task-18b"),
  );

  // Approve one flow
  engine.submitVote(flow1.flowId, "approver-1", VoteType.APPROVE);

  const pending = engine.getPendingFlows();

  assert.strictEqual(pending.length, 1);
  assert.strictEqual(pending[0]!.request.taskId, "task-18b");
});

test("approval flow engine: getQuorumStatus returns quorum info for multi-party flow", () => {
  const engine = new ApprovalFlowEngine();
  const request = createTestApprovalRequest("approval-flow-19", "task-19");
  const approvers = createTestApproverRules();

  const flow = engine.createMultiPartyFlow(request, 2, approvers);

  engine.submitVote(flow.flowId, "approver-1", VoteType.APPROVE);

  const quorumStatus = engine.getQuorumStatus(flow.flowId);

  assert.ok(quorumStatus);
  assert.strictEqual(quorumStatus!.approvalsReceived, 1);
  assert.strictEqual(quorumStatus!.isQuorumMet, false);
});

test("approval flow engine: getQuorumStatus returns null for single-party flow", () => {
  const engine = new ApprovalFlowEngine();
  const request = createTestApprovalRequest("approval-flow-20", "task-20");

  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: createTestApproverRules().slice(0, 1),
      timeout: { warnAfterMs: 60000, escalateAfterMs: 120000, autoActionAfterMs: 86400000, autoAction: "deny" },
      escalation: {
        escalateTo: { type: "role", identifier: "admin", can_delegate: true },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 1800000,
      },
    },
    request,
  );

  const quorumStatus = engine.getQuorumStatus(flow.flowId);

  assert.strictEqual(quorumStatus, null);
});
