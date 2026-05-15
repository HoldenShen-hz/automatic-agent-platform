import assert from "node:assert/strict";
import test from "node:test";

import {
  getConstraintOutputPolicy,
  getConstraintRiskPolicy,
  normalizeConstraintPack,
  type ConstraintBudgetEnvelope,
  type ConstraintPack,
} from "../../../../../src/platform/five-plane-orchestration/harness/index.js";

function createMinimalPack(overrides: Partial<ConstraintPack> = {}): ConstraintPack {
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

test("getConstraintRiskPolicy returns snake_case policy", () => {
  const pack = createMinimalPack({
    risk_policy: { maxRiskScore: 50, escalationThreshold: 40 },
  });

  const riskPolicy = getConstraintRiskPolicy(pack);
  assert.deepEqual(riskPolicy, { maxRiskScore: 50, escalationThreshold: 40 });
});

test("getConstraintRiskPolicy throws when risk_policy is missing", () => {
  const pack = createMinimalPack({
    risk_policy: undefined,
  }) as unknown as ConstraintPack;

  assert.throws(() => getConstraintRiskPolicy(pack), /harness\.constraint_pack\.missing_risk_policy/);
});

test("getConstraintOutputPolicy returns snake_case policy", () => {
  const pack = createMinimalPack({
    output_policy: { requiredEvidence: ["scan"], redactSensitiveData: true },
  });

  const outputPolicy = getConstraintOutputPolicy(pack);
  assert.deepEqual(outputPolicy, { requiredEvidence: ["scan"], redactSensitiveData: true });
});

test("getConstraintOutputPolicy throws when output_policy is missing", () => {
  const pack = createMinimalPack({
    output_policy: undefined,
  }) as unknown as ConstraintPack;

  assert.throws(() => getConstraintOutputPolicy(pack), /harness\.constraint_pack\.missing_output_policy/);
});

test("normalizeConstraintPack clones canonical snake_case fields", () => {
  const pack = createMinimalPack({
    policyIds: ["policy-1", "policy-2"],
    tool_policy: { allowedTools: ["read", "write", "execute"] },
    risk_policy: { maxRiskScore: 90, escalationThreshold: 70 },
    output_policy: { requiredEvidence: ["audit", "review"], redactSensitiveData: true },
  });

  const normalized = normalizeConstraintPack(pack);

  assert.deepEqual(normalized.policyIds, ["policy-1", "policy-2"]);
  assert.deepEqual(normalized.tool_policy.allowedTools, ["read", "write", "execute"]);
  assert.deepEqual(normalized.risk_policy, { maxRiskScore: 90, escalationThreshold: 70 });
  assert.deepEqual(normalized.output_policy, { requiredEvidence: ["audit", "review"], redactSensitiveData: true });
  assert.notEqual(normalized.policyIds, pack.policyIds);
  assert.notEqual(normalized.tool_policy.allowedTools, pack.tool_policy.allowedTools);
  assert.notEqual(normalized.output_policy.requiredEvidence, pack.output_policy?.requiredEvidence);
});

test("normalizeConstraintPack preserves required sandbox and approval requirements", () => {
  const pack = createMinimalPack({
    sandboxRequirement: { sandboxMode: "network_isolated", timeoutMs: 30_000, allowedHosts: ["api.example.com"] },
    approvalRequirement: {
      requiredForRiskClass: ["high", "critical"],
      approverRoles: ["security", "ops"],
      escalationTimeoutMs: 120_000,
    },
  });

  const normalized = normalizeConstraintPack(pack);

  assert.deepEqual(normalized.sandboxRequirement, pack.sandboxRequirement);
  assert.deepEqual(normalized.approvalRequirement, pack.approvalRequirement);
});

test("normalizeConstraintPack derives budgetEnvelope from legacy budget", () => {
  const pack = createMinimalPack({
    budget: {
      maxSteps: 25,
      maxCost: 500,
      maxDurationMs: 120_000,
      max_model_tokens: 4_000,
      max_context_tokens: 8_000,
      max_output_tokens: 2_000,
    },
    budgetEnvelope: undefined,
  });

  const normalized = normalizeConstraintPack(pack);

  assert.deepEqual(normalized.budgetEnvelope, {
    maxSteps: 25,
    maxCost: 500,
    maxDurationMs: 120_000,
    maxModelTokens: 4_000,
    maxContextTokens: 8_000,
    maxOutputTokens: 2_000,
  });
  assert.deepEqual(normalized.budget, pack.budget);
});

test("normalizeConstraintPack copies budgetEnvelope into deprecated budget mirror", () => {
  const budgetEnvelope: ConstraintBudgetEnvelope = {
    maxSteps: 20,
    maxCost: 250,
    maxDurationMs: 90_000,
    maxTokens: 4_096,
    maxModelTokens: 6_000,
    maxContextTokens: 12_000,
    maxOutputTokens: 2_000,
  };
  const pack = createMinimalPack({
    budgetEnvelope,
    budget: undefined,
  });

  const normalized = normalizeConstraintPack(pack);

  assert.deepEqual(normalized.budgetEnvelope, budgetEnvelope);
  assert.deepEqual(normalized.budget, {
    maxSteps: 20,
    maxCost: 250,
    maxDurationMs: 90_000,
    max_model_tokens: 6_000,
    max_context_tokens: 12_000,
    max_output_tokens: 2_000,
  });
});

test("normalizeConstraintPack falls back to budget when budgetEnvelope is absent", () => {
  const pack = createMinimalPack({
    budgetEnvelope: undefined,
    budget: { maxSteps: 15, maxCost: 150, maxDurationMs: 45_000 },
  });

  const normalized = normalizeConstraintPack(pack);

  assert.deepEqual(normalized.budgetEnvelope, {
    maxSteps: 15,
    maxCost: 150,
    maxDurationMs: 45_000,
  });
});

