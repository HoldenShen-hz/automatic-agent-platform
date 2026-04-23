import assert from "node:assert/strict";
import test from "node:test";

import { validateHitlModeRequest, HITL_MODES, type HitlMode } from "../../../../../src/platform/orchestration/hitl/hitl-modes.js";

test("HITL_MODES exports all expected modes", () => {
  assert.deepEqual(HITL_MODES, [
    "single_approval",
    "multi_party_approval",
    "delegated_approval",
    "iterative_feedback",
    "collaborative_edit",
    "informed_confirmation",
    "circuit_breaker_human",
  ] as const);
});

test("validateHitlModeRequest accepts single_approval with at least one option", () => {
  const result = validateHitlModeRequest({
    mode: "single_approval",
    options: [{ optionId: "opt-1" }],
    riskLevel: "low",
    timeoutPolicy: "reject",
  });
  assert.equal(result.mode, "single_approval");
  assert.ok(result.summary.length > 0);
});

test("validateHitlModeRequest throws for single_approval with no options", () => {
  assert.throws(
    () =>
      validateHitlModeRequest({
        mode: "single_approval",
        options: [],
        riskLevel: "low",
        timeoutPolicy: "reject",
      }),
    /hitl_mode\.single_approval_requires_option/,
  );
});

test("validateHitlModeRequest accepts multi_party_approval with requiredApprovals >= 2", () => {
  const result = validateHitlModeRequest({
    mode: "multi_party_approval",
    options: [{ optionId: "opt-1" }],
    riskLevel: "high",
    timeoutPolicy: "approve",
    context: { requiredApprovals: 3 },
  });
  assert.equal(result.mode, "multi_party_approval");
  assert.ok(result.summary.includes("Multi-party"));
});

test("validateHitlModeRequest throws for multi_party_approval with requiredApprovals < 2", () => {
  assert.throws(
    () =>
      validateHitlModeRequest({
        mode: "multi_party_approval",
        options: [{ optionId: "opt-1" }],
        riskLevel: "high",
        timeoutPolicy: "approve",
        context: { requiredApprovals: 1 },
      }),
    /hitl_mode\.multi_party_required_approvals_invalid/,
  );
});

test("validateHitlModeRequest throws for multi_party_approval with non-integer requiredApprovals", () => {
  assert.throws(
    () =>
      validateHitlModeRequest({
        mode: "multi_party_approval",
        options: [{ optionId: "opt-1" }],
        riskLevel: "high",
        timeoutPolicy: "approve",
        context: { requiredApprovals: "two" },
      }),
    /hitl_mode\.multi_party_required_approvals_invalid/,
  );
});

test("validateHitlModeRequest accepts delegated_approval with valid delegationTarget", () => {
  const result = validateHitlModeRequest({
    mode: "delegated_approval",
    options: [{ optionId: "opt-1" }],
    riskLevel: "medium",
    timeoutPolicy: "remain_pending",
    context: { delegationTarget: "delegate@example.com" },
  });
  assert.equal(result.mode, "delegated_approval");
  assert.ok(result.summary.includes("Delegated"));
});

test("validateHitlModeRequest throws for delegated_approval without delegationTarget", () => {
  assert.throws(
    () =>
      validateHitlModeRequest({
        mode: "delegated_approval",
        options: [{ optionId: "opt-1" }],
        riskLevel: "medium",
        timeoutPolicy: "remain_pending",
        context: {},
      }),
    /hitl_mode\.delegation_target_required/,
  );
});

test("validateHitlModeRequest throws for delegated_approval with empty delegationTarget", () => {
  assert.throws(
    () =>
      validateHitlModeRequest({
        mode: "delegated_approval",
        options: [{ optionId: "opt-1" }],
        riskLevel: "medium",
        timeoutPolicy: "remain_pending",
        context: { delegationTarget: "" },
      }),
    /hitl_mode\.delegation_target_required/,
  );
});

test("validateHitlModeRequest accepts iterative_feedback with at least two options", () => {
  const result = validateHitlModeRequest({
    mode: "iterative_feedback",
    options: [{ optionId: "opt-1" }, { optionId: "opt-2" }],
    riskLevel: "medium",
    timeoutPolicy: "remain_pending",
  });
  assert.equal(result.mode, "iterative_feedback");
  assert.ok(result.summary.includes("Iterative"));
});

test("validateHitlModeRequest throws for iterative_feedback with fewer than two options", () => {
  assert.throws(
    () =>
      validateHitlModeRequest({
        mode: "iterative_feedback",
        options: [{ optionId: "opt-1" }],
        riskLevel: "medium",
        timeoutPolicy: "remain_pending",
      }),
    /hitl_mode\.iterative_feedback_requires_revision_option/,
  );
});

test("validateHitlModeRequest accepts collaborative_edit with valid sharedArtifactRef", () => {
  const result = validateHitlModeRequest({
    mode: "collaborative_edit",
    options: [{ optionId: "opt-1" }],
    riskLevel: "medium",
    timeoutPolicy: "remain_pending",
    context: { sharedArtifactRef: "artifact:doc-123" },
  });
  assert.equal(result.mode, "collaborative_edit");
  assert.ok(result.summary.includes("Collaborative"));
});

test("validateHitlModeRequest throws for collaborative_edit without sharedArtifactRef", () => {
  assert.throws(
    () =>
      validateHitlModeRequest({
        mode: "collaborative_edit",
        options: [{ optionId: "opt-1" }],
        riskLevel: "medium",
        timeoutPolicy: "remain_pending",
        context: {},
      }),
    /hitl_mode\.shared_artifact_required/,
  );
});

test("validateHitlModeRequest accepts informed_confirmation with exactly one option", () => {
  const result = validateHitlModeRequest({
    mode: "informed_confirmation",
    options: [{ optionId: "opt-1" }],
    riskLevel: "low",
    timeoutPolicy: "approve",
  });
  assert.equal(result.mode, "informed_confirmation");
  assert.ok(result.summary.includes("Informed confirmation"));
});

test("validateHitlModeRequest throws for informed_confirmation with zero options", () => {
  assert.throws(
    () =>
      validateHitlModeRequest({
        mode: "informed_confirmation",
        options: [],
        riskLevel: "low",
        timeoutPolicy: "approve",
      }),
    /hitl_mode\.informed_confirmation_single_option_required/,
  );
});

test("validateHitlModeRequest throws for informed_confirmation with multiple options", () => {
  assert.throws(
    () =>
      validateHitlModeRequest({
        mode: "informed_confirmation",
        options: [{ optionId: "opt-1" }, { optionId: "opt-2" }],
        riskLevel: "low",
        timeoutPolicy: "approve",
      }),
    /hitl_mode\.informed_confirmation_single_option_required/,
  );
});

test("validateHitlModeRequest accepts circuit_breaker_human with high risk and reject policy", () => {
  const result = validateHitlModeRequest({
    mode: "circuit_breaker_human",
    options: [{ optionId: "opt-1" }],
    riskLevel: "high",
    timeoutPolicy: "reject",
  });
  assert.equal(result.mode, "circuit_breaker_human");
  assert.ok(result.summary.includes("Circuit-breaker"));
});

test("validateHitlModeRequest accepts circuit_breaker_human with critical risk and reject policy", () => {
  const result = validateHitlModeRequest({
    mode: "circuit_breaker_human",
    options: [{ optionId: "opt-1" }],
    riskLevel: "critical",
    timeoutPolicy: "reject",
  });
  assert.equal(result.mode, "circuit_breaker_human");
});

test("validateHitlModeRequest throws for circuit_breaker_human with low risk", () => {
  assert.throws(
    () =>
      validateHitlModeRequest({
        mode: "circuit_breaker_human",
        options: [{ optionId: "opt-1" }],
        riskLevel: "low",
        timeoutPolicy: "reject",
      }),
    /hitl_mode\.circuit_breaker_requires_high_risk/,
  );
});

test("validateHitlModeRequest throws for circuit_breaker_human with medium risk", () => {
  assert.throws(
    () =>
      validateHitlModeRequest({
        mode: "circuit_breaker_human",
        options: [{ optionId: "opt-1" }],
        riskLevel: "medium",
        timeoutPolicy: "reject",
      }),
    /hitl_mode\.circuit_breaker_requires_high_risk/,
  );
});

test("validateHitlModeRequest throws for circuit_breaker_human with approve timeout policy", () => {
  assert.throws(
    () =>
      validateHitlModeRequest({
        mode: "circuit_breaker_human",
        options: [{ optionId: "opt-1" }],
        riskLevel: "high",
        timeoutPolicy: "approve",
      }),
    /hitl_mode\.circuit_breaker_auto_approve_forbidden/,
  );
});

test("validateHitlModeRequest accepts circuit_breaker_human with remain_pending policy", () => {
  const result = validateHitlModeRequest({
    mode: "circuit_breaker_human",
    options: [{ optionId: "opt-1" }],
    riskLevel: "critical",
    timeoutPolicy: "remain_pending",
  });
  assert.equal(result.mode, "circuit_breaker_human");
});

test("validateHitlModeRequest returns HitlModeConstraint with correct mode", () => {
  const modes: HitlMode[] = [
    "single_approval",
    "multi_party_approval",
    "delegated_approval",
    "iterative_feedback",
    "collaborative_edit",
    "informed_confirmation",
    "circuit_breaker_human",
  ];

  for (const mode of modes) {
    const result = validateHitlModeRequest({
      mode,
      options: [{ optionId: "opt-1" }],
      riskLevel: mode === "circuit_breaker_human" ? "high" : "medium",
      timeoutPolicy: mode === "circuit_breaker_human" ? "reject" : "remain_pending",
      context:
        mode === "multi_party_approval"
          ? { requiredApprovals: 2 }
          : mode === "delegated_approval"
            ? { delegationTarget: "delegate@example.com" }
            : mode === "collaborative_edit"
              ? { sharedArtifactRef: "artifact:doc-1" }
              : {},
    });
    assert.equal(result.mode, mode, `Mode ${mode} should be returned correctly`);
  }
});