import assert from "node:assert/strict";
import test from "node:test";

/**
 * Approval Center - Approval Tests
 *
 * Tests for approval request/decision validation and approval flow functionality.
 * Uses mocks for external dependencies to isolate unit tests.
 */

import { describe, mock } from "node:test";

// Import types and functions under test
import {
  validateApprovalDecision,
  type ApprovalRequest,
  type ApprovalDecision,
} from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";

// ============================================
// ApprovalRequest Tests
// ============================================

test("ApprovalRequest requires all mandatory fields", () => {
  const request: ApprovalRequest = {
    approvalId: "approval_test_1",
    taskId: "task_123",
    sourceAgentId: "agent_test",
    reason: "Test approval request",
    riskLevel: "low",
    options: ["option_a", "option_b"] as const,
    context: { testKey: "testValue" },
    timeoutPolicy: "reject",
    createdAt: "2026-04-14T00:00:00.000Z",
  };

  assert.equal(request.approvalId, "approval_test_1");
  assert.equal(request.taskId, "task_123");
  assert.equal(request.sourceAgentId, "agent_test");
  assert.equal(request.riskLevel, "low");
  assert.equal(request.options.length, 2);
  assert.deepEqual(request.context, { testKey: "testValue" });
});

test("ApprovalRequest with optional fields", () => {
  const request: ApprovalRequest = {
    approvalId: "approval_test_2",
    taskId: "task_456",
    executionId: "exec_789",
    sourceAgentId: "agent_test",
    reason: "Test with optionals",
    riskLevel: "high",
    options: ["approve", "reject", "modify"] as const,
    context: {},
    timeoutPolicy: "approve",
    createdAt: "2026-04-14T00:00:00.000Z",
    requiredApprovals: 2,
    approverGroups: ["group_a", "group_b"] as const,
    approvalsReceived: 1,
  };

  assert.equal(request.executionId, "exec_789");
  assert.equal(request.requiredApprovals, 2);
  assert.equal(request.approverGroups?.length, 2);
  assert.equal(request.approvalsReceived, 1);
});

test("ApprovalRequest riskLevel accepts all valid values", () => {
  const riskLevels: ApprovalRequest["riskLevel"][] = ["low", "medium", "high", "critical"];
  for (const level of riskLevels) {
    const request: ApprovalRequest = {
      approvalId: `approval_${level}`,
      taskId: "task_test",
      sourceAgentId: "agent_test",
      reason: "Risk level test",
      riskLevel: level,
      options: ["yes", "no"] as const,
      context: {},
      timeoutPolicy: "reject",
      createdAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(request.riskLevel, level);
  }
});

test("ApprovalRequest timeoutPolicy accepts all valid values", () => {
  const policies: ApprovalRequest["timeoutPolicy"][] = ["reject", "approve", "remain_pending"];
  for (const policy of policies) {
    const request: ApprovalRequest = {
      approvalId: `approval_policy_${policy}`,
      taskId: "task_test",
      sourceAgentId: "agent_test",
      reason: "Policy test",
      riskLevel: "low",
      options: ["yes", "no"] as const,
      context: {},
      timeoutPolicy: policy,
      createdAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(request.timeoutPolicy, policy);
  }
});

// ============================================
// ApprovalDecision Validation Tests
// ============================================

test("ApprovalDecision option_selected validation", () => {
  const validDecision: ApprovalDecision = {
    approvalId: "approval_1",
    decisionType: "option_selected",
    selectedOptionId: "option_a",
    respondedBy: "user_test",
    respondedAt: "2026-04-14T10:00:00.000Z",
  };
  assert.doesNotThrow(() => validateApprovalDecision(validDecision));
});

test("ApprovalDecision confirmed validation", () => {
  const validDecision: ApprovalDecision = {
    approvalId: "approval_1",
    decisionType: "confirmed",
    confirmed: true,
    respondedBy: "user_test",
    respondedAt: "2026-04-14T10:00:00.000Z",
  };
  assert.doesNotThrow(() => validateApprovalDecision(validDecision));
});

test("ApprovalDecision text_input validation", () => {
  const validDecision: ApprovalDecision = {
    approvalId: "approval_1",
    decisionType: "text_input",
    inputText: "This is my feedback on the proposed changes",
    respondedBy: "user_test",
    respondedAt: "2026-04-14T10:00:00.000Z",
  };
  assert.doesNotThrow(() => validateApprovalDecision(validDecision));
});

test("ApprovalDecision rejected validation", () => {
  const validDecision: ApprovalDecision = {
    approvalId: "approval_1",
    decisionType: "rejected",
    respondedBy: "user_test",
    respondedAt: "2026-04-14T10:00:00.000Z",
  };
  assert.doesNotThrow(() => validateApprovalDecision(validDecision));
});

test("ApprovalDecision expired validation", () => {
  const validDecision: ApprovalDecision = {
    approvalId: "approval_1",
    decisionType: "expired",
    respondedBy: "system",
    respondedAt: "2026-04-14T10:00:00.000Z",
  };
  assert.doesNotThrow(() => validateApprovalDecision(validDecision));
});

// ============================================
// ApprovalDecision Invalid Payload Tests
// ============================================

test("validateApprovalDecision throws for option_selected without selectedOptionId", () => {
  const invalidDecision = {
    approvalId: "approval_1",
    decisionType: "option_selected" as const,
    respondedBy: "user_test",
    respondedAt: "2026-04-14T10:00:00.000Z",
  };
  assert.throws(
    () => validateApprovalDecision(invalidDecision as ApprovalDecision),
    (err: any) => {
      return err.code === "approval.invalid_option_selected";
    }
  );
});

test("validateApprovalDecision throws for option_selected with extra fields", () => {
  const invalidDecision = {
    approvalId: "approval_1",
    decisionType: "option_selected" as const,
    selectedOptionId: "option_a",
    confirmed: true,
    respondedBy: "user_test",
    respondedAt: "2026-04-14T10:00:00.000Z",
  };
  assert.throws(
    () => validateApprovalDecision(invalidDecision as ApprovalDecision),
    (err: any) => {
      return err.code === "approval.invalid_option_selected";
    }
  );
});

test("validateApprovalDecision throws for option_selected with inputText", () => {
  const invalidDecision = {
    approvalId: "approval_1",
    decisionType: "option_selected" as const,
    selectedOptionId: "option_a",
    inputText: "Some text",
    respondedBy: "user_test",
    respondedAt: "2026-04-14T10:00:00.000Z",
  };
  assert.throws(
    () => validateApprovalDecision(invalidDecision as ApprovalDecision),
    (err: any) => {
      return err.code === "approval.invalid_option_selected";
    }
  );
});

test("validateApprovalDecision throws for confirmed without confirmed=true", () => {
  const invalidDecision = {
    approvalId: "approval_1",
    decisionType: "confirmed" as const,
    respondedBy: "user_test",
    respondedAt: "2026-04-14T10:00:00.000Z",
  };
  assert.throws(
    () => validateApprovalDecision(invalidDecision as ApprovalDecision),
    (err: any) => {
      return err.code === "approval.invalid_confirmed";
    }
  );
});

test("validateApprovalDecision throws for confirmed with confirmed=false", () => {
  const invalidDecision = {
    approvalId: "approval_1",
    decisionType: "confirmed" as const,
    confirmed: false,
    respondedBy: "user_test",
    respondedAt: "2026-04-14T10:00:00.000Z",
  };
  assert.throws(
    () => validateApprovalDecision(invalidDecision as ApprovalDecision),
    (err: any) => {
      return err.code === "approval.invalid_confirmed";
    }
  );
});

test("validateApprovalDecision throws for confirmed with extra fields", () => {
  const invalidDecision = {
    approvalId: "approval_1",
    decisionType: "confirmed" as const,
    confirmed: true,
    selectedOptionId: "option_a",
    respondedBy: "user_test",
    respondedAt: "2026-04-14T10:00:00.000Z",
  };
  assert.throws(
    () => validateApprovalDecision(invalidDecision as ApprovalDecision),
    (err: any) => {
      return err.code === "approval.invalid_confirmed";
    }
  );
});

test("validateApprovalDecision throws for text_input without inputText", () => {
  const invalidDecision = {
    approvalId: "approval_1",
    decisionType: "text_input" as const,
    respondedBy: "user_test",
    respondedAt: "2026-04-14T10:00:00.000Z",
  };
  assert.throws(
    () => validateApprovalDecision(invalidDecision as ApprovalDecision),
    (err: any) => {
      return err.code === "approval.invalid_text_input";
    }
  );
});

test("validateApprovalDecision throws for text_input with extra fields", () => {
  const invalidDecision = {
    approvalId: "approval_1",
    decisionType: "text_input" as const,
    inputText: "Valid input",
    selectedOptionId: "option_a",
    respondedBy: "user_test",
    respondedAt: "2026-04-14T10:00:00.000Z",
  };
  assert.throws(
    () => validateApprovalDecision(invalidDecision as ApprovalDecision),
    (err: any) => {
      return err.code === "approval.invalid_text_input";
    }
  );
});

test("validateApprovalDecision throws for rejected with extra fields", () => {
  const invalidDecision = {
    approvalId: "approval_1",
    decisionType: "rejected" as const,
    selectedOptionId: "option_a",
    respondedBy: "user_test",
    respondedAt: "2026-04-14T10:00:00.000Z",
  };
  assert.throws(
    () => validateApprovalDecision(invalidDecision as ApprovalDecision),
    (err: any) => {
      return err.code === "approval.invalid_terminal_payload";
    }
  );
});

test("validateApprovalDecision throws for rejected with confirmed=true", () => {
  const invalidDecision = {
    approvalId: "approval_1",
    decisionType: "rejected" as const,
    confirmed: true,
    respondedBy: "user_test",
    respondedAt: "2026-04-14T10:00:00.000Z",
  };
  assert.throws(
    () => validateApprovalDecision(invalidDecision as ApprovalDecision),
    (err: any) => {
      return err.code === "approval.invalid_terminal_payload";
    }
  );
});

test("validateApprovalDecision throws for rejected with inputText", () => {
  const invalidDecision = {
    approvalId: "approval_1",
    decisionType: "rejected" as const,
    inputText: "Reason for rejection",
    respondedBy: "user_test",
    respondedAt: "2026-04-14T10:00:00.000Z",
  };
  assert.throws(
    () => validateApprovalDecision(invalidDecision as ApprovalDecision),
    (err: any) => {
      return err.code === "approval.invalid_terminal_payload";
    }
  );
});

test("validateApprovalDecision throws for expired with extra fields", () => {
  const invalidDecision = {
    approvalId: "approval_1",
    decisionType: "expired" as const,
    inputText: "Expired but with text",
    respondedBy: "system",
    respondedAt: "2026-04-14T10:00:00.000Z",
  };
  assert.throws(
    () => validateApprovalDecision(invalidDecision as ApprovalDecision),
    (err: any) => {
      return err.code === "approval.invalid_terminal_payload";
    }
  );
});

// ============================================
// ApprovalDecision respondedBy Tests
// ============================================

test("ApprovalDecision respondedBy can be user", () => {
  const decision: ApprovalDecision = {
    approvalId: "approval_1",
    decisionType: "rejected",
    respondedBy: "user_123",
    respondedAt: "2026-04-14T10:00:00.000Z",
  };
  assert.equal(decision.respondedBy, "user_123");
});

test("ApprovalDecision respondedBy can be system", () => {
  const decision: ApprovalDecision = {
    approvalId: "approval_1",
    decisionType: "expired",
    respondedBy: "system",
    respondedAt: "2026-04-14T10:00:00.000Z",
  };
  assert.equal(decision.respondedBy, "system");
});

test("ApprovalDecision respondedBy can be agent", () => {
  const decision: ApprovalDecision = {
    approvalId: "approval_1",
    decisionType: "confirmed",
    confirmed: true,
    respondedBy: "agent_automated_approver",
    respondedAt: "2026-04-14T10:00:00.000Z",
  };
  assert.equal(decision.respondedBy, "agent_automated_approver");
});

// ============================================
// Error Code Tests
// ============================================

test("validateApprovalDecision error codes are correct", () => {
  // option_selected errors
  const optErr = {
    approvalId: "a",
    decisionType: "option_selected" as const,
    respondedBy: "u",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };
  try {
    validateApprovalDecision(optErr as ApprovalDecision);
    assert.fail("Should have thrown");
  } catch (e: any) {
    assert.equal(e.code, "approval.invalid_option_selected");
  }

  // confirmed errors
  const confErr = {
    approvalId: "a",
    decisionType: "confirmed" as const,
    respondedBy: "u",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };
  try {
    validateApprovalDecision(confErr as ApprovalDecision);
    assert.fail("Should have thrown");
  } catch (e: any) {
    assert.equal(e.code, "approval.invalid_confirmed");
  }

  // text_input errors
  const txtErr = {
    approvalId: "a",
    decisionType: "text_input" as const,
    respondedBy: "u",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };
  try {
    validateApprovalDecision(txtErr as ApprovalDecision);
    assert.fail("Should have thrown");
  } catch (e: any) {
    assert.equal(e.code, "approval.invalid_text_input");
  }

  // terminal payload errors
  const termErr = {
    approvalId: "a",
    decisionType: "rejected" as const,
    selectedOptionId: "x",
    respondedBy: "u",
    respondedAt: "2026-04-14T00:00:00.000Z",
  };
  try {
    validateApprovalDecision(termErr as ApprovalDecision);
    assert.fail("Should have thrown");
  } catch (e: any) {
    assert.equal(e.code, "approval.invalid_terminal_payload");
  }
});
