import assert from "node:assert/strict";
import test from "node:test";

import { ApprovalFlowEngine, FlowType } from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-flow-engine.js";

test("ApprovalFlowEngine normalizes legacy workflow and step aliases into harness runtime context", () => {
  const engine = new ApprovalFlowEngine();
  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: [{ type: "role", identifier: "admin", can_delegate: true }],
      timeout: {
        warnAfterMs: 1000,
        escalateAfterMs: 2000,
        autoActionAfterMs: 3000,
        autoAction: "deny",
      },
      escalation: {
        escalateTo: { type: "role", identifier: "admin", can_delegate: true },
        maxEscalationDepth: 1,
        notificationChannels: [],
        escalationTimeoutMs: 5000,
      },
      feedbackLoop: {
        maxIterations: 2,
        requireReplanOnReject: true,
      },
    },
    {
      approvalId: "approval-001",
      taskId: "task-approval-001",
      sourceAgentId: "requester-1",
      reason: "Review release",
      riskLevel: "medium",
      options: ["approve", "reject"],
      timeoutPolicy: "reject",
      createdAt: "2026-04-29T00:00:00.000Z",
      context: {},
      executionId: null,
    },
    {
      workflowRunId: "legacy-run-001",
      stepId: "legacy-step-001",
    },
  );

  assert.equal(flow.feedbackLoop?.harnessRunId, "legacy-run-001");
  assert.equal(flow.feedbackLoop?.nodeRunId, "legacy-step-001");
  assert.equal(flow.feedbackLoop?.workflowRunId, "legacy-run-001");
  assert.equal(flow.feedbackLoop?.stepId, "legacy-step-001");
});

test("ApprovalFlowEngine prefers canonical request runtime ids when no override options are provided", () => {
  const engine = new ApprovalFlowEngine();
  const flow = engine.createFlow(
    {
      flowType: FlowType.SINGLE,
      approvers: [{ type: "role", identifier: "admin", can_delegate: true }],
      timeout: {
        warnAfterMs: 1000,
        escalateAfterMs: 2000,
        autoActionAfterMs: 3000,
        autoAction: "deny",
      },
      escalation: {
        escalateTo: { type: "role", identifier: "admin", can_delegate: true },
        maxEscalationDepth: 1,
        notificationChannels: [],
        escalationTimeoutMs: 5000,
      },
      feedbackLoop: {
        maxIterations: 2,
        requireReplanOnReject: true,
      },
    },
    {
      approvalId: "approval-002",
      taskId: "task-approval-002",
      sourceAgentId: "requester-1",
      reason: "Review release",
      riskLevel: "medium",
      options: ["approve", "reject"],
      timeoutPolicy: "reject",
      createdAt: "2026-04-29T00:00:00.000Z",
      context: {},
      executionId: "legacy-run-002",
    },
    {
      harnessRunId: "harness-run-002",
      nodeRunId: "node-run-002",
    },
  );

  assert.equal(flow.feedbackLoop?.harnessRunId, "harness-run-002");
  assert.equal(flow.feedbackLoop?.nodeRunId, "node-run-002");
  assert.equal(flow.feedbackLoop?.workflowRunId, "harness-run-002");
  assert.equal(flow.feedbackLoop?.stepId, "node-run-002");
});
