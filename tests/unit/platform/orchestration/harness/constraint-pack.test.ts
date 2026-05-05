/**
 * Unit Tests: Constraint Pack Extended Coverage
 *
 * Extended tests for ConstraintPack normalization, helpers,
 * and edge cases not covered by existing tests.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  getConstraintOutputPolicy,
  getConstraintRiskPolicy,
  normalizeConstraintPack,
  type ConstraintPack,
  type ConstraintRiskPolicy,
  type ConstraintOutputPolicy,
  type ConstraintBudgetEnvelope,
} from "../../../../../../src/platform/orchestration/harness/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────────────────────

function createMinimalPack(): ConstraintPack {
  return {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "auto",
    tool_policy: { allowedTools: ["read", "write"] },
    risk_policy: { maxRiskScore: 10, escalationThreshold: 8 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getConstraintRiskPolicy Tests
// ─────────────────────────────────────────────────────────────────────────────

test("getConstraintRiskPolicy returns riskPolicy when present", () => {
  const pack: ConstraintPack = {
    ...createMinimalPack(),
    riskPolicy: { maxRiskScore: 50, escalationThreshold: 40 },
  };

  const riskPolicy = getConstraintRiskPolicy(pack);
  assert.equal(riskPolicy.maxRiskScore, 50);
  assert.equal(riskPolicy.escalationThreshold, 40);
});

test("getConstraintRiskPolicy falls back to risk_policy (legacy)", () => {
  const pack: ConstraintPack = {
    ...createMinimalPack(),
    risk_policy: { maxRiskScore: 75, escalationThreshold: 60 },
  };

  const riskPolicy = getConstraintRiskPolicy(pack);
  assert.equal(riskPolicy.maxRiskScore, 75);
  assert.equal(riskPolicy.escalationThreshold, 60);
});

test("getConstraintRiskPolicy prefers riskPolicy over risk_policy", () => {
  const pack: ConstraintPack = {
    ...createMinimalPack(),
    riskPolicy: { maxRiskScore: 50, escalationThreshold: 40 },
    risk_policy: { maxRiskScore: 75, escalationThreshold: 60 },
  };

  const riskPolicy = getConstraintRiskPolicy(pack);
  assert.equal(riskPolicy.maxRiskScore, 50);
  assert.equal(riskPolicy.escalationThreshold, 40);
});

test("getConstraintRiskPolicy throws when neither policy is present", () => {
  const pack: ConstraintPack = {
    ...createMinimalPack(),
    riskPolicy: undefined,
    risk_policy: undefined,
  } as unknown as ConstraintPack;

  assert.throws(
    () => getConstraintRiskPolicy(pack),
    /harness\.constraint_pack\.missing_risk_policy/,
  );
});

test("getConstraintRiskPolicy throws with correct error message", () => {
  const pack: ConstraintPack = {
    ...createMinimalPack(),
    riskPolicy: undefined,
    risk_policy: undefined,
  } as unknown as ConstraintPack;

  try {
    getConstraintRiskPolicy(pack);
    assert.fail("expected error to be thrown");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.equal((err as Error).message, "harness.constraint_pack.missing_risk_policy");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// getConstraintOutputPolicy Tests
// ─────────────────────────────────────────────────────────────────────────────

test("getConstraintOutputPolicy returns outputPolicy when present", () => {
  const pack: ConstraintPack = {
    ...createMinimalPack(),
    outputPolicy: { requiredEvidence: ["scan"], redactSensitiveData: true },
  };

  const outputPolicy = getConstraintOutputPolicy(pack);
  assert.deepEqual(outputPolicy.requiredEvidence, ["scan"]);
  assert.equal(outputPolicy.redactSensitiveData, true);
});

test("getConstraintOutputPolicy falls back to output_policy (legacy)", () => {
  const pack: ConstraintPack = {
    ...createMinimalPack(),
    output_policy: { requiredEvidence: ["review"], redactSensitiveData: true },
  };

  const outputPolicy = getConstraintOutputPolicy(pack);
  assert.deepEqual(outputPolicy.requiredEvidence, ["review"]);
  assert.equal(outputPolicy.redactSensitiveData, true);
});

test("getConstraintOutputPolicy prefers outputPolicy over output_policy", () => {
  const pack: ConstraintPack = {
    ...createMinimalPack(),
    outputPolicy: { requiredEvidence: ["scan"], redactSensitiveData: true },
    output_policy: { requiredEvidence: ["review"], redactSensitiveData: false },
  };

  const outputPolicy = getConstraintOutputPolicy(pack);
  assert.deepEqual(outputPolicy.requiredEvidence, ["scan"]);
  assert.equal(outputPolicy.redactSensitiveData, true);
});

test("getConstraintOutputPolicy throws when neither policy is present", () => {
  const pack: ConstraintPack = {
    ...createMinimalPack(),
    outputPolicy: undefined,
    output_policy: undefined,
  } as unknown as ConstraintPack;

  assert.throws(
    () => getConstraintOutputPolicy(pack),
    /harness\.constraint_pack\.missing_output_policy/,
  );
});

test("getConstraintOutputPolicy throws with correct error message", () => {
  const pack: ConstraintPack = {
    ...createMinimalPack(),
    outputPolicy: undefined,
    output_policy: undefined,
  } as unknown as ConstraintPack;

  try {
    getConstraintOutputPolicy(pack);
    assert.fail("expected error to be thrown");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.equal((err as Error).message, "harness.constraint_pack.missing_output_policy");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeConstraintPack Tests
// ─────────────────────────────────────────────────────────────────────────────

test("normalizeConstraintPack preserves canonical fields", () => {
  const pack: ConstraintPack = {
    policyIds: ["policy-1", "policy-2"],
    approvalMode: "required",
    autonomyMode: "supervised",
    tool_policy: { allowedTools: ["read", "write", "execute"] },
    riskPolicy: { maxRiskScore: 90, escalationThreshold: 70 },
    outputPolicy: { requiredEvidence: ["audit"], redactSensitiveData: true },
    budget: { maxSteps: 50, maxCost: 500, maxDurationMs: 120000 },
  };

  const normalized = normalizeConstraintPack(pack);

  assert.deepEqual(normalized.policyIds, ["policy-1", "policy-2"]);
  assert.equal(normalized.approvalMode, "required");
  assert.equal(normalized.autonomyMode, "supervised");
  assert.deepEqual(normalized.tool_policy.allowedTools, ["read", "write", "execute"]);
  assert.deepEqual(normalized.risk_policy, { maxRiskScore: 90, escalationThreshold: 70 });
  assert.deepEqual(normalized.output_policy, { requiredEvidence: ["audit"], redactSensitiveData: true });
});

test("normalizeConstraintPack removes risk_policy field", () => {
  const pack: ConstraintPack = {
    ...createMinimalPack(),
    riskPolicy: { maxRiskScore: 50, escalationThreshold: 40 },
    risk_policy: { maxRiskScore: 75, escalationThreshold: 60 },
  };

  const normalized = normalizeConstraintPack(pack);

  assert.equal("risk_policy" in normalized, false);
});

test("normalizeConstraintPack removes output_policy field", () => {
  const pack: ConstraintPack = {
    ...createMinimalPack(),
    outputPolicy: { requiredEvidence: ["scan"], redactSensitiveData: true },
    output_policy: { requiredEvidence: ["review"], redactSensitiveData: false },
  };

  const normalized = normalizeConstraintPack(pack);

  assert.equal("output_policy" in normalized, false);
});

test("normalizeConstraintPack preserves riskPolicy when using legacy fields", () => {
  const pack: ConstraintPack = {
    ...createMinimalPack(),
    risk_policy: { maxRiskScore: 75, escalationThreshold: 60 },
  };

  const normalized = normalizeConstraintPack(pack);

  // Should have riskPolicy with normalized values
  assert.ok(normalized.risk_policy != null);
  assert.equal(normalized.risk_policy.maxRiskScore, 75);
  assert.equal("risk_policy" in normalized, false);
});

test("normalizeConstraintPack handles budget_envelope", () => {
  const pack: ConstraintPack = {
    ...createMinimalPack(),
    budget_envelope: { maxSteps: 20, maxCost: 200, maxDurationMs: 30000, maxTokens: 1000 },
  };

  const normalized = normalizeConstraintPack(pack);

  assert.ok(normalized.budgetEnvelope != null);
  assert.equal(normalized.budgetEnvelope.maxSteps, 20);
  assert.equal(normalized.budgetEnvelope.maxTokens, 1000);
});

test("normalizeConstraintPack handles budget_envelope with maxTokens", () => {
  const pack: ConstraintPack = {
    ...createMinimalPack(),
    budget: { maxSteps: 15, maxCost: 150, maxDurationMs: 45000 },
    budget_envelope: { maxSteps: 20, maxCost: 200, maxDurationMs: 30000, maxTokens: 1000 },
  };

  const normalized = normalizeConstraintPack(pack);

  // budget_envelope should take precedence
  assert.equal(normalized.budgetEnvelope?.maxSteps, 20);
  assert.equal(normalized.budget?.maxSteps, 20);
});

test("normalizeConstraintPack handles legacy budget field", () => {
  const pack: ConstraintPack = {
    ...createMinimalPack(),
    budget: { maxSteps: 25, maxCost: 250, maxDurationMs: 90000 },
  };

  const normalized = normalizeConstraintPack(pack);

  assert.ok(normalized.budgetEnvelope != null);
  assert.equal(normalized.budgetEnvelope.maxSteps, 25);
  assert.equal(normalized.budget?.maxSteps, 25);
});

test("normalizeConstraintPack handles sandbox_requirement", () => {
  const pack: ConstraintPack = {
    ...createMinimalPack(),
    sandbox_requirement: {
      sandboxMode: "network_isolated",
      timeoutMs: 30000,
      allowedHosts: ["api.example.com"],
    },
  };

  const normalized = normalizeConstraintPack(pack);

  assert.ok(normalized.sandboxRequirement != null);
  assert.equal(normalized.sandboxRequirement.sandboxMode, "network_isolated");
  assert.deepEqual(normalized.sandboxRequirement.allowedHosts, ["api.example.com"]);
});

test("normalizeConstraintPack handles approval_requirement", () => {
  const pack: ConstraintPack = {
    ...createMinimalPack(),
    approval_requirement: {
      requiredForRiskClass: ["high", "critical"],
      approverRoles: ["security_admin", "manager"],
      escalationTimeoutMs: 3600000,
    },
  };

  const normalized = normalizeConstraintPack(pack);

  assert.ok(normalized.approvalRequirement != null);
  assert.deepEqual(normalized.approvalRequirement.requiredForRiskClass, ["high", "critical"]);
  assert.deepEqual(normalized.approvalRequirement.approverRoles, ["security_admin", "manager"]);
});

test("normalizeConstraintPack preserves tool_policy allowedTools as new array", () => {
  const pack: ConstraintPack = {
    ...createMinimalPack(),
    tool_policy: { allowedTools: ["read", "write"] },
  };

  const normalized = normalizeConstraintPack(pack);

  // Should be a new array, not same reference
  assert.notEqual(normalized.tool_policy.allowedTools, pack.tool_policy.allowedTools);
  assert.deepEqual(normalized.tool_policy.allowedTools, ["read", "write"]);
});

test("normalizeConstraintPack preserves requiredEvidence as new array", () => {
  const pack: ConstraintPack = {
    ...createMinimalPack(),
    outputPolicy: { requiredEvidence: ["audit", "review"], redactSensitiveData: false },
  };

  const normalized = normalizeConstraintPack(pack);

  // Should be a new array
  assert.notEqual(normalized.output_policy.requiredEvidence, pack.output_policy.requiredEvidence);
  assert.deepEqual(normalized.output_policy.requiredEvidence, ["audit", "review"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// Normalize with Only Legacy Fields Tests
// ─────────────────────────────────────────────────────────────────────────────

test("normalizeConstraintPack handles pack with only legacy fields", () => {
  const pack: ConstraintPack = {
    policyIds: ["legacy-policy"],
    approvalMode: "supervised",
    autonomyMode: "manual",
    tool_policy: { allowedTools: ["bash"] },
    risk_policy: { maxRiskScore: 85, escalationThreshold: 65 },
    output_policy: { requiredEvidence: ["log"], redactSensitiveData: true },
    budget: { maxSteps: 40, maxCost: 400, maxDurationMs: 80000 },
  };

  const normalized = normalizeConstraintPack(pack);

  assert.equal(normalized.approvalMode, "supervised");
  assert.equal(normalized.autonomyMode, "manual");
  assert.ok(normalized.risk_policy != null);
  assert.ok(normalized.output_policy != null);
  assert.ok(normalized.budgetEnvelope != null);
});

test("normalizeConstraintPack handles pack with mixed canonical and legacy fields", () => {
  const pack: ConstraintPack = {
    policyIds: ["policy-mixed"],
    approvalMode: "required",
    autonomyMode: "auto",
    tool_policy: { allowedTools: ["read"] },
    riskPolicy: { maxRiskScore: 80, escalationThreshold: 60 }, // Canonical
    // risk_policy missing - legacy fallback
    output_policy: { requiredEvidence: ["scan"], redactSensitiveData: false }, // Legacy
    budget_envelope: { maxSteps: 30, maxCost: 300, maxDurationMs: 60000 }, // Envelope
  };

  const normalized = normalizeConstraintPack(pack);

  assert.equal(normalized.risk_policy.maxRiskScore, 80);
  assert.equal(normalized.output_policy.requiredEvidence[0], "scan");
  assert.equal(normalized.budgetEnvelope.maxSteps, 30);
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("normalizeConstraintPack handles empty policyIds", () => {
  const pack: ConstraintPack = {
    ...createMinimalPack(),
    policyIds: [],
  };

  const normalized = normalizeConstraintPack(pack);

  assert.deepEqual(normalized.policyIds, []);
});

test("normalizeConstraintPack handles empty allowedTools", () => {
  const pack: ConstraintPack = {
    ...createMinimalPack(),
    tool_policy: { allowedTools: [] },
  };

  const normalized = normalizeConstraintPack(pack);

  assert.deepEqual(normalized.tool_policy.allowedTools, []);
});

test("normalizeConstraintPack handles empty requiredEvidence", () => {
  const pack: ConstraintPack = {
    ...createMinimalPack(),
    outputPolicy: { requiredEvidence: [], redactSensitiveData: false },
  };

  const normalized = normalizeConstraintPack(pack);

  assert.deepEqual(normalized.output_policy.requiredEvidence, []);
});

test("normalizeConstraintPack does not add sandboxRequirement when not present", () => {
  const pack: ConstraintPack = {
    ...createMinimalPack(),
    sandbox_requirement: undefined,
    sandboxRequirement: undefined,
  };

  const normalized = normalizeConstraintPack(pack);

  assert.equal(normalized.sandboxRequirement, undefined);
});

test("normalizeConstraintPack does not add approvalRequirement when not present", () => {
  const pack: ConstraintPack = {
    ...createMinimalPack(),
    approval_requirement: undefined,
    approvalRequirement: undefined,
  };

  const normalized = normalizeConstraintPack(pack);

  assert.equal(normalized.approvalRequirement, undefined);
});

test("normalizeConstraintPack handles budget without maxTokens", () => {
  const pack: ConstraintPack = {
    ...createMinimalPack(),
    budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
  };

  const normalized = normalizeConstraintPack(pack);

  // Should still have budgetEnvelope
  assert.ok(normalized.budgetEnvelope != null);
  assert.equal(normalized.budget?.maxSteps, 10);
});

// ─────────────────────────────────────────────────────────────────────────────
// Type Compatibility Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ConstraintPack type allows riskPolicy and risk_policy as alternatives", () => {
  // This is a compile-time check - if it compiles, the types are correct
  const packWithRiskPolicy: ConstraintPack = {
    ...createMinimalPack(),
    riskPolicy: { maxRiskScore: 50, escalationThreshold: 40 },
  };

  const packWithRiskPolicyLegacy: ConstraintPack = {
    ...createMinimalPack(),
    risk_policy: { maxRiskScore: 50, escalationThreshold: 40 },
  };

  assert.ok(packWithRiskPolicy.risk_policy != null);
  assert.ok(packWithRiskPolicyLegacy.risk_policy != null);
});

test("ConstraintPack type allows outputPolicy and output_policy as alternatives", () => {
  const packWithOutputPolicy: ConstraintPack = {
    ...createMinimalPack(),
    outputPolicy: { requiredEvidence: ["scan"], redactSensitiveData: true },
  };

  const packWithOutputPolicyLegacy: ConstraintPack = {
    ...createMinimalPack(),
    output_policy: { requiredEvidence: ["scan"], redactSensitiveData: true },
  };

  assert.ok(packWithOutputPolicy.output_policy != null);
  assert.ok(packWithOutputPolicyLegacy.output_policy != null);
});

test("ConstraintPack type allows budgetEnvelope and budget_envelope as alternatives", () => {
  const packWithBudgetEnvelope: ConstraintPack = {
    ...createMinimalPack(),
    budgetEnvelope: { maxSteps: 20, maxCost: 200, maxDurationMs: 30000 },
  };

  const packWithBudgetEnvelopeLegacy: ConstraintPack = {
    ...createMinimalPack(),
    budget_envelope: { maxSteps: 20, maxCost: 200, maxDurationMs: 30000 },
  };

  assert.ok(packWithBudgetEnvelope.budgetEnvelope != null);
  assert.ok(packWithBudgetEnvelopeLegacy.budget_envelope != null);
});

test("ConstraintPack type allows sandboxRequirement and sandbox_requirement as alternatives", () => {
  const packWithSandbox: ConstraintPack = {
    ...createMinimalPack(),
    sandboxRequirement: { sandboxMode: "ephemeral", timeoutMs: 10000 },
  };

  const packWithSandboxLegacy: ConstraintPack = {
    ...createMinimalPack(),
    sandbox_requirement: { sandboxMode: "ephemeral", timeoutMs: 10000 },
  };

  assert.ok(packWithSandbox.sandboxRequirement != null);
  assert.ok(packWithSandboxLegacy.sandbox_requirement != null);
});

test("ConstraintPack type allows approvalRequirement and approval_requirement as alternatives", () => {
  const packWithApproval: ConstraintPack = {
    ...createMinimalPack(),
    approvalRequirement: { requiredForRiskClass: ["critical"], approverRoles: ["admin"], escalationTimeoutMs: 3600000 },
  };

  const packWithApprovalLegacy: ConstraintPack = {
    ...createMinimalPack(),
    approval_requirement: { requiredForRiskClass: ["critical"], approverRoles: ["admin"], escalationTimeoutMs: 3600000 },
  };

  assert.ok(packWithApproval.approvalRequirement != null);
  assert.ok(packWithApprovalLegacy.approval_requirement != null);
});
