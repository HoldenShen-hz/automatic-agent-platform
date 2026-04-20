import assert from "node:assert/strict";
import test from "node:test";

// Re-export test for barrel file
import type {
  ApprovalRequest,
  ApprovalDecision,
} from "../../../../../src/platform/control-plane/approval-center/index.js";

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

test("ApprovalDecision type accepts valid decision types", () => {
  const decisions: ApprovalDecision["decisionType"][] = [
    "option_selected",
    "confirmed",
    "text_input",
    "rejected",
    "expired",
  ];
  assert.equal(decisions.length, 5);
});

test("ApprovalDecision with option_selected", () => {
  const decision: ApprovalDecision = {
    approvalId: "approval_1",
    decisionType: "option_selected",
    selectedOptionId: "opt_1",
    respondedBy: "user_1",
    respondedAt: "2026-04-14T00:30:00.000Z",
  };
  assert.equal(decision.decisionType, "option_selected");
  assert.equal(decision.selectedOptionId, "opt_1");
});

test("ApprovalDecision with text_input", () => {
  const decision: ApprovalDecision = {
    approvalId: "approval_1",
    decisionType: "text_input",
    inputText: "This is my response",
    respondedBy: "user_1",
    respondedAt: "2026-04-14T00:30:00.000Z",
  };
  assert.equal(decision.decisionType, "text_input");
  assert.equal(decision.inputText, "This is my response");
});
