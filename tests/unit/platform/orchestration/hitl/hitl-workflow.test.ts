/**
 * Unit tests for HITL Workflow modes
 * Tests workflow transitions and multi-step HITL orchestration
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  HITL_MODES,
  validateHitlModeRequest,
  type HitlMode,
  type HitlCapability,
} from "../../../../../src/platform/five-plane-orchestration/hitl/hitl-modes.js";

test("HITL_MODES contains all required modes", () => {
  assert.ok(HITL_MODES.includes("single_approval"));
  assert.ok(HITL_MODES.includes("multi_party_approval"));
  assert.ok(HITL_MODES.includes("delegated_approval"));
  assert.ok(HITL_MODES.includes("iterative_feedback"));
  assert.ok(HITL_MODES.includes("collaborative_edit"));
  assert.ok(HITL_MODES.includes("informed_confirmation"));
  assert.ok(HITL_MODES.includes("circuit_breaker_human"));
  assert.ok(HITL_MODES.includes("modify_and_approve"));
  assert.ok(HITL_MODES.includes("override_decision"));
  assert.ok(HITL_MODES.includes("force_terminate"));
});

test("HITL_MODES length matches expected 10 modes", () => {
  assert.equal(HITL_MODES.length, 10);
});

test("validateHitlModeRequest accepts valid single_approval request", () => {
  const result = validateHitlModeRequest({
    mode: "single_approval",
    options: [{ optionId: "approve" }],
    riskLevel: "low",
    timeoutPolicy: "remain_pending",
  });
  assert.equal(result.mode, "single_approval");
  assert.equal(result.capability, "approve");
  assert.ok(result.summary.includes("Single approval"));
});

test("validateHitlModeRequest rejects single_approval without options", () => {
  assert.throws(() => {
    validateHitlModeRequest({
      mode: "single_approval",
      options: [],
      riskLevel: "low",
      timeoutPolicy: "remain_pending",
    });
  }, /hitl_mode\.single_approval_requires_option/);
});

test("validateHitlModeRequest accepts valid multi_party_approval", () => {
  const result = validateHitlModeRequest({
    mode: "multi_party_approval",
    options: [{ optionId: "approve" }],
    riskLevel: "medium",
    timeoutPolicy: "remain_pending",
    context: { requiredApprovals: 3 },
  });
  assert.equal(result.mode, "multi_party_approval");
  assert.equal(result.capability, "escalate");
});

test("validateHitlModeRequest rejects multi_party_approval with insufficient approvers", () => {
  assert.throws(() => {
    validateHitlModeRequest({
      mode: "multi_party_approval",
      options: [{ optionId: "approve" }],
      riskLevel: "medium",
      timeoutPolicy: "remain_pending",
      context: { requiredApprovals: 1 },
    });
  }, /hitl_mode\.multi_party_required_approvals_invalid/);
});

test("validateHitlModeRequest accepts valid delegated_approval", () => {
  const result = validateHitlModeRequest({
    mode: "delegated_approval",
    options: [{ optionId: "delegate" }],
    riskLevel: "medium",
    timeoutPolicy: "remain_pending",
    context: { delegationTarget: "senior-reviewer@example.com" },
  });
  assert.equal(result.mode, "delegated_approval");
  assert.equal(result.capability, "delegate");
});

test("validateHitlModeRequest rejects delegated_approval without target", () => {
  assert.throws(() => {
    validateHitlModeRequest({
      mode: "delegated_approval",
      options: [{ optionId: "delegate" }],
      riskLevel: "medium",
      timeoutPolicy: "remain_pending",
      context: {},
    });
  }, /hitl_mode\.delegation_target_required/);
});

test("validateHitlModeRequest accepts valid iterative_feedback", () => {
  const result = validateHitlModeRequest({
    mode: "iterative_feedback",
    options: [{ optionId: "approve" }, { optionId: "revise" }],
    riskLevel: "medium",
    timeoutPolicy: "remain_pending",
  });
  assert.equal(result.mode, "iterative_feedback");
  assert.equal(result.capability, "revise");
});

test("validateHitlModeRequest rejects iterative_feedback with single option", () => {
  assert.throws(() => {
    validateHitlModeRequest({
      mode: "iterative_feedback",
      options: [{ optionId: "approve" }],
      riskLevel: "medium",
      timeoutPolicy: "remain_pending",
    });
  }, /hitl_mode\.iterative_feedback_requires_revision_option/);
});

test("validateHitlModeRequest accepts valid collaborative_edit", () => {
  const result = validateHitlModeRequest({
    mode: "collaborative_edit",
    options: [{ optionId: "approve" }],
    riskLevel: "medium",
    timeoutPolicy: "remain_pending",
    context: { sharedArtifactRef: "artifact:shared-patch-001" },
  });
  assert.equal(result.mode, "collaborative_edit");
  assert.equal(result.capability, "collaborate");
});

test("validateHitlModeRequest rejects collaborative_edit without sharedArtifactRef", () => {
  assert.throws(() => {
    validateHitlModeRequest({
      mode: "collaborative_edit",
      options: [{ optionId: "approve" }],
      riskLevel: "medium",
      timeoutPolicy: "remain_pending",
      context: {},
    });
  }, /hitl_mode\.shared_artifact_required/);
});

test("validateHitlModeRequest accepts valid informed_confirmation", () => {
  const result = validateHitlModeRequest({
    mode: "informed_confirmation",
    options: [{ optionId: "confirm" }],
    riskLevel: "low",
    timeoutPolicy: "remain_pending",
  });
  assert.equal(result.mode, "informed_confirmation");
  assert.equal(result.capability, "confirm");
});

test("validateHitlModeRequest rejects informed_confirmation with multiple options", () => {
  assert.throws(() => {
    validateHitlModeRequest({
      mode: "informed_confirmation",
      options: [{ optionId: "confirm" }, { optionId: "reject" }],
      riskLevel: "low",
      timeoutPolicy: "remain_pending",
    });
  }, /hitl_mode\.informed_confirmation_single_option_required/);
});

test("validateHitlModeRequest accepts circuit_breaker_human for high risk", () => {
  const result = validateHitlModeRequest({
    mode: "circuit_breaker_human",
    options: [{ optionId: "approve" }],
    riskLevel: "high",
    timeoutPolicy: "reject",
  });
  assert.equal(result.mode, "circuit_breaker_human");
  assert.equal(result.capability, "circuit_breaker");
});

test("validateHitlModeRequest accepts circuit_breaker_human for critical risk with breakGlass", () => {
  const result = validateHitlModeRequest({
    mode: "circuit_breaker_human",
    options: [{ optionId: "approve" }],
    riskLevel: "critical",
    timeoutPolicy: "approve",
    context: { breakGlassApproved: true },
  });
  assert.equal(result.mode, "circuit_breaker_human");
  assert.equal(result.capability, "circuit_breaker");
});

test("validateHitlModeRequest rejects circuit_breaker_human for low risk", () => {
  assert.throws(() => {
    validateHitlModeRequest({
      mode: "circuit_breaker_human",
      options: [{ optionId: "approve" }],
      riskLevel: "low",
      timeoutPolicy: "reject",
    });
  }, /hitl_mode\.circuit_breaker_requires_high_risk/);
});

test("validateHitlModeRequest rejects circuit_breaker_human auto-approve without breakGlass", () => {
  assert.throws(() => {
    validateHitlModeRequest({
      mode: "circuit_breaker_human",
      options: [{ optionId: "approve" }],
      riskLevel: "high",
      timeoutPolicy: "approve",
      context: { breakGlassApproved: false },
    });
  }, /hitl_mode\.circuit_breaker_auto_approve_forbidden/);
});

test("validateHitlModeRequest accepts modify_and_approve", () => {
  const result = validateHitlModeRequest({
    mode: "modify_and_approve",
    options: [{ optionId: "approve" }],
    riskLevel: "high",
    timeoutPolicy: "remain_pending",
  });
  assert.equal(result.mode, "modify_and_approve");
  assert.equal(result.capability, "modify_and_approve");
});

test("validateHitlModeRequest rejects modify_and_approve without options", () => {
  assert.throws(() => {
    validateHitlModeRequest({
      mode: "modify_and_approve",
      options: [],
      riskLevel: "high",
      timeoutPolicy: "remain_pending",
    });
  }, /hitl_mode\.modify_and_approve_requires_option/);
});

test("validateHitlModeRequest accepts override_decision", () => {
  const result = validateHitlModeRequest({
    mode: "override_decision",
    options: [{ optionId: "override" }],
    riskLevel: "critical",
    timeoutPolicy: "remain_pending",
  });
  assert.equal(result.mode, "override_decision");
  assert.equal(result.capability, "override_decision");
});

test("validateHitlModeRequest rejects override_decision without options", () => {
  assert.throws(() => {
    validateHitlModeRequest({
      mode: "override_decision",
      options: [],
      riskLevel: "critical",
      timeoutPolicy: "remain_pending",
    });
  }, /hitl_mode\.override_decision_requires_option/);
});

test("validateHitlModeRequest accepts force_terminate for high risk", () => {
  const result = validateHitlModeRequest({
    mode: "force_terminate",
    options: [{ optionId: "terminate" }],
    riskLevel: "high",
    timeoutPolicy: "reject",
  });
  assert.equal(result.mode, "force_terminate");
  assert.equal(result.capability, "force_terminate");
});

test("validateHitlModeRequest accepts force_terminate for critical risk", () => {
  const result = validateHitlModeRequest({
    mode: "force_terminate",
    options: [{ optionId: "terminate" }],
    riskLevel: "critical",
    timeoutPolicy: "reject",
  });
  assert.equal(result.mode, "force_terminate");
  assert.equal(result.capability, "force_terminate");
});

test("validateHitlModeRequest rejects force_terminate for low risk", () => {
  assert.throws(() => {
    validateHitlModeRequest({
      mode: "force_terminate",
      options: [{ optionId: "terminate" }],
      riskLevel: "low",
      timeoutPolicy: "reject",
    });
  }, /hitl_mode\.force_terminate_requires_high_risk/);
});

test("HitlMode type accepts all valid mode strings", () => {
  const modes: HitlMode[] = [
    "single_approval",
    "multi_party_approval",
    "delegated_approval",
    "iterative_feedback",
    "collaborative_edit",
    "informed_confirmation",
    "circuit_breaker_human",
    "modify_and_approve",
    "override_decision",
    "force_terminate",
  ];
  for (const mode of modes) {
    const result = validateHitlModeRequest({
      mode,
      options: [{ optionId: "test" }],
      riskLevel: "high",
      timeoutPolicy: "remain_pending",
    });
    assert.ok(result.mode === mode);
  }
});

test("HitlCapability includes all expected capabilities", () => {
  const capabilities: HitlCapability[] = [
    "approve",
    "escalate",
    "delegate",
    "revise",
    "collaborate",
    "confirm",
    "circuit_breaker",
    "modify_and_approve",
    "override_decision",
    "force_terminate",
  ];
  assert.equal(capabilities.length, 10);
});