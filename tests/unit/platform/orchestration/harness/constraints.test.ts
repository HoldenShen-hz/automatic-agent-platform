import assert from "node:assert/strict";
import test from "node:test";

import { normalizeConstraintPack, type ConstraintPack } from "../../../../../src/platform/five-plane-orchestration/harness/constraints/index.js";

function createConstraintPack(overrides: Partial<ConstraintPack> = {}): ConstraintPack {
  return {
    policyIds: ["policy-1"],
    approvalMode: "none",
    autonomyMode: "supervised",
    tool_policy: {
      allowedTools: ["tool-a", "tool-b"],
    },
    risk_policy: {
      maxRiskScore: 10,
      escalationThreshold: 8,
    },
    output_policy: {
      requiredEvidence: ["evidence-1"],
      redactSensitiveData: false,
    },
    budgetEnvelope: {
      maxSteps: 100,
      maxCost: 1000,
      maxDurationMs: 60000,
    },
    sandboxRequirement: {
      sandboxMode: "ephemeral",
      timeoutMs: 30000,
    },
    approvalRequirement: {
      requiredForRiskClass: ["high", "critical"],
      approverRoles: ["operator"],
      escalationTimeoutMs: 60000,
    },
    ...overrides,
  };
}

test("ConstraintPack can be constructed with the current canonical fields", () => {
  const pack = createConstraintPack();

  assert.equal(pack.policyIds.length, 1);
  assert.equal(pack.approvalMode, "none");
  assert.equal(pack.autonomyMode, "supervised");
  assert.equal(pack.tool_policy.allowedTools.length, 2);
  assert.equal(pack.risk_policy?.maxRiskScore, 10);
  assert.equal(pack.output_policy?.requiredEvidence.length, 1);
  assert.equal(pack.budgetEnvelope?.maxSteps, 100);
});

test("ConstraintPack supports the documented approval modes", () => {
  assert.equal(createConstraintPack({ approvalMode: "none" }).approvalMode, "none");
  assert.equal(createConstraintPack({ approvalMode: "required" }).approvalMode, "required");
  assert.equal(createConstraintPack({ approvalMode: "supervised" }).approvalMode, "supervised");
});

test("normalizeConstraintPack preserves canonical policies and budget envelope", () => {
  const normalized = normalizeConstraintPack(createConstraintPack({
    autonomyMode: "semi_auto",
    budgetEnvelope: {
      maxSteps: 5,
      maxCost: 25,
      maxDurationMs: 1000,
      maxModelTokens: 256,
    },
  }));

  assert.equal(normalized.autonomyMode, "supervised_auto");
  assert.equal(normalized.tool_policy.allowedTools.includes("tool-a"), true);
  assert.equal(normalized.budgetEnvelope?.maxSteps, 5);
  assert.equal(normalized.budget?.max_model_tokens, 256);
});
