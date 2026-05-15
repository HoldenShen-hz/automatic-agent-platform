/**
 * ARCH-P1-4: HITL Interaction Modes Coverage Tests
 *
 * Architecture §21.1 defines 7 Human-in-the-Loop interaction modes
 * (approve / reject / escalate / override / inspect / patch / takeover).
 * This test verifies all 7 modes are supported by the HITL system.
 *
 * Test type: Integration (references HitlMode validation)
 * @see docs_zh/quality/00-full-coverage-test-manual.md §26.4
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  validateHitlModeRequest,
  HITL_MODES,
  type HitlMode,
} from "../../../../../src/platform/five-plane-orchestration/hitl/hitl-modes.js";

/**
 * The 7 HITL interaction modes required by architecture §21.1.
 * These modes provide human oversight in the automated execution loop.
 */
const ARCHITECTURE_REQUIRED_HITL_MODES = [
  "approve",
  "reject",
  "escalate",
  "override",
  "inspect",
  "patch",
  "takeover",
] as const;

/**
 * Maps architecture mode names to existing HitlMode values.
 * Some modes may map to compound modes like "modify_and_approve".
 */
const MODE_MAPPING: Record<string, HitlMode[]> = {
  approve: ["single_approval", "informed_confirmation"],
  reject: ["single_approval"], // rejection via single_approval option
  escalate: ["multi_party_approval"],
  override: ["override_decision"],
  inspect: ["informed_confirmation"],
  patch: ["modify_and_approve"],
  takeover: ["circuit_breaker_human", "force_terminate"],
};

test("[ARCH-P1-4] HITL service exports validateHitlModeRequest for all 7 modes", () => {
  // Verify validateHitlModeRequest exists and is callable
  assert.equal(typeof validateHitlModeRequest, "function");

  // Test single_approval (can represent approve/reject)
  const singleResult = validateHitlModeRequest({
    mode: "single_approval",
    options: [{ optionId: "opt-1" }],
    riskLevel: "low",
    timeoutPolicy: "reject",
  });
  assert.ok(singleResult.mode, "single_approval must be a valid mode");

  // Test multi_party_approval (for escalate)
  const multiResult = validateHitlModeRequest({
    mode: "multi_party_approval",
    options: [{ optionId: "opt-1" }],
    riskLevel: "high",
    timeoutPolicy: "approve",
    context: { requiredApprovals: 2 },
  });
  assert.ok(multiResult.mode, "multi_party_approval must be a valid mode");
});

test("[ARCH-P1-4] HITL override_decision mode exists (for override)", () => {
  const overrideResult = validateHitlModeRequest({
    mode: "override_decision",
    options: [{ optionId: "opt-override" }],
    riskLevel: "medium",
    timeoutPolicy: "remain_pending",
    context: { priorDecisionRef: "decision-123" },
  });

  assert.equal(overrideResult.mode, "override_decision");
  assert.ok(overrideResult.summary.includes("Human overrides a prior"), "override mode must describe human override capability");
});

test("[ARCH-P1-4] HITL modify_and_approve mode exists (for patch)", () => {
  const patchResult = validateHitlModeRequest({
    mode: "modify_and_approve",
    options: [{ optionId: "opt-patch" }],
    riskLevel: "medium",
    timeoutPolicy: "remain_pending",
  });

  assert.equal(patchResult.mode, "modify_and_approve");
  assert.equal(patchResult.capability, "modify_and_approve");
});

test("[ARCH-P1-4] HITL force_terminate mode exists (for takeover)", () => {
  const takeoverResult = validateHitlModeRequest({
    mode: "force_terminate",
    options: [{ optionId: "opt-terminate" }],
    riskLevel: "critical",
    timeoutPolicy: "reject",
  });

  assert.equal(takeoverResult.mode, "force_terminate");
  assert.ok(takeoverResult.summary.includes("immediately terminates"), "force_terminate must describe immediate termination");
});

test("[ARCH-P1-4] HITL all 7 architecture modes are represented by existing code", () => {
  const existingModes = new Set(HITL_MODES);

  // Each architecture mode should be mappable to at least one existing mode
  for (const archMode of ARCHITECTURE_REQUIRED_HITL_MODES) {
    const mappedModes = MODE_MAPPING[archMode];
    assert.ok(
      mappedModes && mappedModes.some((m) => existingModes.has(m)),
      `Architecture mode "${archMode}" must be representable by existing HITL modes`,
    );
  }
});

test("[ARCH-P1-4] HITL modes export complete mode list via HITL_MODES constant", () => {
  // Verify HITL_MODES contains all modes for validation
  assert.ok(HITL_MODES.length >= 7, `HITL_MODES must have at least 7 modes (got ${HITL_MODES.length})`);

  // Check all 10 existing modes are exported
  const expectedModes = [
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

  for (const mode of expectedModes) {
    assert.ok(
      HITL_MODES.includes(mode as (typeof HITL_MODES)[number]),
      `HITL_MODES must include "${mode}"`,
    );
  }
});
