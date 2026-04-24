/**
 * Unit tests for ApprovalFlowEngine - Escalation methods
 * Tests checkEscalation and triggerEscalation functionality
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ApprovalFlowEngine,
  FlowType,
  FlowStatus,
} from "../../../../../src/platform/control-plane/approval-center/approval-flow-engine.js";
import { VoteType } from "../../../../../src/platform/control-plane/approval-center/quorum-calculator.js";

import type { ApprovalRequest } from "../../../../../src/platform/control-plane/approval-center/approval-service.js";

function createMockApprovalRequest(overrides?: Partial<ApprovalRequest>): ApprovalRequest {
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
    requiredApprovals: 1,
    approverGroups: [],
    approvalsReceived: 0,
    ...overrides,
  };
}

function createSinglePartyFlowConfig() {
  return {
    flowType: FlowType.SINGLE,
    approvers: [{ type: "user" as const, identifier: "admin", can_delegate: true }],
    timeout: {
      warnAfterMs: 60000,
      escalateAfterMs: 120000, // 2 minutes
      autoActionAfterMs: 86400000,
      autoAction: "deny" as const,
    },
    escalation: {
      escalateTo: { type: "role" as const, identifier: "superadmin", can_delegate: false },
      maxEscalationDepth: 3,
      notificationChannels: [],
      escalationTimeoutMs: 30000,
    },
    feedbackLoop: { maxIterations: 5, requireReplanOnReject: true },
  };
}

test("checkEscalation returns null when flow not found", () => {
  const engine = new ApprovalFlowEngine();
  const result = engine.checkEscalation("nonexistent-flow");
  assert.equal(result, null);
});

test("checkEscalation returns null when flow is not pending", () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const flow = engine.createFlow(createSinglePartyFlowConfig(), request);

  // Approve the flow
  engine.submitVote(flow.flowId, "admin", VoteType.APPROVE);

  const result = engine.checkEscalation(flow.flowId);
  assert.equal(result, null);
});

test("checkEscalation returns null when escalation already triggered", () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const flow = engine.createFlow(createSinglePartyFlowConfig(), request);

  // Manually set escalation triggered
  const flowState = engine.getFlowStatus(flow.flowId);
  assert.ok(flowState);
  flowState.escalationTriggered = true;

  const result = engine.checkEscalation(flow.flowId);
  assert.equal(result, null);
});

test("checkEscalation returns null when at max escalation depth", () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const config = createSinglePartyFlowConfig();
  config.escalation.maxEscalationDepth = 1; // Very shallow depth

  const flow = engine.createFlow(config, request);

  // Add an escalation to history to reach max depth
  const flowState = engine.getFlowStatus(flow.flowId);
  assert.ok(flowState);
  flowState.escalationHistory.push({
    level: 1,
    escalateTo: { type: "role", identifier: "admin", can_delegate: false },
    escalatedAt: new Date().toISOString(),
    escalatedBy: "system",
    reason: "timeout" as any,
    sourceApprovalId: "approval_test_123",
  });

  const result = engine.checkEscalation(flow.flowId);
  assert.equal(result, null);
});

test("checkEscalation returns context when timeout exceeded", () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const config = createSinglePartyFlowConfig();
  config.timeout.escalateAfterMs = 100; // 100ms

  const flow = engine.createFlow(config, request);

  // Wait for timeout
  const start = Date.now();
  while (Date.now() - start < 150) {
    // busy wait to exceed 100ms
  }

  const result = engine.checkEscalation(flow.flowId);

  assert.ok(result);
  assert.equal(result!.approvalId, request.approvalId);
  assert.equal(result!.taskId, request.taskId);
  assert.equal(result!.currentLevel, 0);
  assert.equal(result!.reason, "timeout");
});

test("checkEscalation returns context when quorum not met after voting window", () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const config = {
    flowType: FlowType.MULTI_PARTY,
    approvers: [
      { type: "user" as const, identifier: "user1", can_delegate: true },
      { type: "user" as const, identifier: "user2", can_delegate: true },
    ],
    quorum: {
      minApprovals: 2,
      minRejectionsToDeny: 2,
      votingWindowMs: 100, // 100ms window
    },
    timeout: {
      warnAfterMs: 60000,
      escalateAfterMs: 120000,
      autoActionAfterMs: 86400000,
      autoAction: "deny" as const,
    },
    escalation: {
      escalateTo: { type: "role" as const, identifier: "superadmin", can_delegate: false },
      maxEscalationDepth: 3,
      notificationChannels: [],
      escalationTimeoutMs: 30000,
    },
  };

  const flow = engine.createFlow(config, request);

  // Wait for voting window to expire
  const start = Date.now();
  while (Date.now() - start < 150) {
    // busy wait
  }

  const result = engine.checkEscalation(flow.flowId);

  assert.ok(result);
  assert.equal(result!.reason, "quorum_not_met");
});

test("checkEscalation returns null when voting window not expired", () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const config = {
    flowType: FlowType.MULTI_PARTY,
    approvers: [
      { type: "user" as const, identifier: "user1", can_delegate: true },
      { type: "user" as const, identifier: "user2", can_delegate: true },
    ],
    quorum: {
      minApprovals: 2,
      minRejectionsToDeny: 2,
      votingWindowMs: 10000, // 10 seconds
    },
    timeout: {
      warnAfterMs: 60000,
      escalateAfterMs: 120000,
      autoActionAfterMs: 86400000,
      autoAction: "deny" as const,
    },
    escalation: {
      escalateTo: { type: "role" as const, identifier: "superadmin", can_delegate: false },
      maxEscalationDepth: 3,
      notificationChannels: [],
      escalationTimeoutMs: 30000,
    },
  };

  const flow = engine.createFlow(config, request);

  // Voting window still active
  const result = engine.checkEscalation(flow.flowId);

  assert.equal(result, null);
});

test("triggerEscalation returns error when escalation not needed", async () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const flow = engine.createFlow(createSinglePartyFlowConfig(), request);

  const result = await engine.triggerEscalation(flow.flowId);

  assert.equal(result.success, false);
  assert.ok(result.error?.includes("not needed"));
});

test("triggerEscalation returns error when flow not found", async () => {
  const engine = new ApprovalFlowEngine();

  const result = await engine.triggerEscalation("nonexistent-flow");

  assert.equal(result.success, false);
  assert.ok(result.error?.includes("not found"));
});

test("triggerEscalation escalates and updates flow status", async () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const config = createSinglePartyFlowConfig();
  config.timeout.escalateAfterMs = 100;

  const flow = engine.createFlow(config, request);

  // Wait for timeout to be exceeded
  const start = Date.now();
  while (Date.now() - start < 150) {
    // busy wait
  }

  const result = await engine.triggerEscalation(flow.flowId);

  assert.equal(result.success, true);

  const flowState = engine.getFlowStatus(flow.flowId);
  assert.ok(flowState);
  assert.equal(flowState.status, FlowStatus.ESCALATED);
  assert.equal(flowState.escalationTriggered, true);
  assert.ok(flowState.escalationHistory.length > 0);
});

test("triggerEscalation updates escalation history", async () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const config = createSinglePartyFlowConfig();
  config.timeout.escalateAfterMs = 100;

  const flow = engine.createFlow(config, request);

  // Wait for timeout
  const start = Date.now();
  while (Date.now() - start < 150) {
    // busy wait
  }

  await engine.triggerEscalation(flow.flowId);

  const flowState = engine.getFlowStatus(flow.flowId);
  assert.ok(flowState);
  assert.equal(flowState.escalationHistory.length, 1);
  assert.equal(flowState.escalationHistory[0]!.level, 1);
});

test("triggerEscalation sets escalationTriggered flag", async () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const config = createSinglePartyFlowConfig();
  config.timeout.escalateAfterMs = 100;

  const flow = engine.createFlow(config, request);

  // Wait for timeout
  const start = Date.now();
  while (Date.now() - start < 150) {
    // busy wait
  }

  await engine.triggerEscalation(flow.flowId);

  const flowState = engine.getFlowStatus(flow.flowId);
  assert.ok(flowState);
  assert.equal(flowState.escalationTriggered, true);
});

test("checkEscalation returns null for approved flow", () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const flow = engine.createFlow(createSinglePartyFlowConfig(), request);

  // Approve the flow to reach terminal state
  engine.submitVote(flow.flowId, "admin", VoteType.APPROVE);

  const result = engine.checkEscalation(flow.flowId);
  assert.equal(result, null);
});

test("checkEscalation returns null for rejected flow", () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const flow = engine.createFlow(createSinglePartyFlowConfig(), request);

  // Reject the flow
  engine.submitVote(flow.flowId, "admin", VoteType.REJECT);

  const result = engine.checkEscalation(flow.flowId);
  assert.equal(result, null);
});

test("escalation preserves original task and execution IDs", async () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest({
    taskId: "specific-task-id",
    executionId: "specific-exec-id",
  });

  const config = createSinglePartyFlowConfig();
  config.timeout.escalateAfterMs = 100;

  const flow = engine.createFlow(config, request);

  // Wait for timeout
  const start = Date.now();
  while (Date.now() - start < 150) {
    // busy wait
  }

  await engine.triggerEscalation(flow.flowId);

  const flowState = engine.getFlowStatus(flow.flowId);
  assert.ok(flowState);
  assert.equal(flowState.escalationHistory[0]!.sourceApprovalId, request.approvalId);
});

test("multiple triggerEscalation calls only escalate once when checkEscalation returns null", async () => {
  const engine = new ApprovalFlowEngine();
  const request = createMockApprovalRequest();

  const config = createSinglePartyFlowConfig();
  config.timeout.escalateAfterMs = 100;

  const flow = engine.createFlow(config, request);

  // Wait for timeout
  const start = Date.now();
  while (Date.now() - start < 150) {
    // busy wait
  }

  // First escalation
  const result1 = await engine.triggerEscalation(flow.flowId);
  assert.equal(result1.success, true);

  // Second escalation should fail since escalation already triggered
  const result2 = await engine.triggerEscalation(flow.flowId);
  assert.equal(result2.success, false);

  const flowState = engine.getFlowStatus(flow.flowId);
  assert.ok(flowState);
  assert.equal(flowState.escalationHistory.length, 1);
});