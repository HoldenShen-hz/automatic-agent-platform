import assert from "node:assert/strict";
import test from "node:test";

import {
  getConstraintOutputPolicy,
  getConstraintRiskPolicy,
  normalizeConstraintPack,
  type ConstraintBudgetEnvelope,
  type ConstraintPack,
} from "../../../../../src/platform/five-plane-orchestration/harness/index.js";

function createPack(overrides: Partial<ConstraintPack> = {}): ConstraintPack {
  return {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "semi_auto",
    tool_policy: { allowedTools: ["read", "write"] },
    risk_policy: { maxRiskScore: 10, escalationThreshold: 8 },
    output_policy: { requiredEvidence: ["audit"], redactSensitiveData: false },
    sandboxRequirement: { sandboxMode: "none", timeoutMs: 60_000 },
    approvalRequirement: {
      requiredForRiskClass: ["low", "medium", "high", "critical"],
      approverRoles: ["admin"],
      escalationTimeoutMs: 60_000,
    },
    budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60_000 },
    ...overrides,
  };
}

test("constraint pack accessors return canonical snake_case policies", () => {
  const pack = createPack({
    risk_policy: { maxRiskScore: 50, escalationThreshold: 40 },
    output_policy: { requiredEvidence: ["scan"], redactSensitiveData: true },
  });

  assert.deepEqual(getConstraintRiskPolicy(pack), { maxRiskScore: 50, escalationThreshold: 40 });
  assert.deepEqual(getConstraintOutputPolicy(pack), { requiredEvidence: ["scan"], redactSensitiveData: true });
});

test("constraint pack accessors throw when required policies are absent at runtime", () => {
  const noRisk = { ...createPack() } as ConstraintPack & { risk_policy?: ConstraintPack["risk_policy"] };
  delete (noRisk as { risk_policy?: unknown }).risk_policy;
  const noOutput = { ...createPack() } as ConstraintPack & { output_policy?: ConstraintPack["output_policy"] };
  delete (noOutput as { output_policy?: unknown }).output_policy;

  assert.throws(() => getConstraintRiskPolicy(noRisk as ConstraintPack), /harness\.constraint_pack\.missing_risk_policy/);
  assert.throws(() => getConstraintOutputPolicy(noOutput as ConstraintPack), /harness\.constraint_pack\.missing_output_policy/);
});

test("normalizeConstraintPack mirrors budgetEnvelope and legacy budget fields", () => {
  const budgetEnvelope: ConstraintBudgetEnvelope = {
    maxSteps: 20,
    maxCost: 250,
    maxDurationMs: 90_000,
    maxTokens: 4_096,
    maxModelTokens: 6_000,
    maxContextTokens: 12_000,
    maxOutputTokens: 2_000,
  };

  const normalizedFromLegacy = normalizeConstraintPack(createPack({
    budget: {
      maxSteps: 25,
      maxCost: 500,
      maxDurationMs: 120_000,
      max_model_tokens: 4_000,
      max_context_tokens: 8_000,
      max_output_tokens: 2_000,
    },
  }));
  const normalizedFromEnvelope = normalizeConstraintPack(createPack({
    budgetEnvelope,
  }));

  assert.equal(normalizedFromLegacy.budgetEnvelope?.maxModelTokens, 4_000);
  assert.equal(normalizedFromEnvelope.budget?.maxOutputTokens, 2_000);
  assert.deepEqual(normalizedFromEnvelope.budgetEnvelope, budgetEnvelope);
});
