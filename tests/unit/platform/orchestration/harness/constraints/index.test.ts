import assert from "node:assert/strict";
import test from "node:test";

import {
  getConstraintOutputPolicy,
  getConstraintRiskPolicy,
  normalizeConstraintPack,
  type ConstraintPack,
} from "../../../../../../src/platform/five-plane-orchestration/harness/constraints/index.js";

function createConstraintPack(overrides: Partial<ConstraintPack> = {}): ConstraintPack {
  return {
    policyIds: ["policy-1"],
    approvalMode: "none",
    autonomyMode: "supervised",
    tool_policy: { allowedTools: ["calculator"] },
    risk_policy: { maxRiskScore: 7, escalationThreshold: 5 },
    output_policy: { requiredEvidence: ["evidence-1"], redactSensitiveData: true },
    budgetEnvelope: { maxSteps: 4, maxCost: 25, maxDurationMs: 1000 },
    sandboxRequirement: { sandboxMode: "ephemeral", timeoutMs: 1000 },
    approvalRequirement: {
      requiredForRiskClass: ["high"],
      approverRoles: ["operator"],
      escalationTimeoutMs: 5000,
    },
    ...overrides,
  };
}

test("constraints index re-exports ConstraintPack and helper functions", () => {
  const pack = createConstraintPack();

  assert.equal(pack.tool_policy.allowedTools[0], "calculator");
  assert.deepEqual(getConstraintRiskPolicy(pack), pack.risk_policy);
  assert.deepEqual(getConstraintOutputPolicy(pack), pack.output_policy);
});

test("normalizeConstraintPack fills the legacy budget mirror from budgetEnvelope", () => {
  const normalized = normalizeConstraintPack(createConstraintPack({
    budgetEnvelope: {
      maxSteps: 10,
      maxCost: 50,
      maxDurationMs: 5000,
      maxOutputTokens: 128,
    },
  }));

  assert.equal(normalized.budgetEnvelope?.maxSteps, 10);
  assert.equal(normalized.budget?.maxSteps, 10);
  assert.equal(normalized.budget?.max_output_tokens, 128);
});
