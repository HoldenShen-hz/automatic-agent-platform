import test from "node:test";
import assert from "node:assert/strict";
import type { ConstraintPack } from "../../../../../src/platform/orchestration/harness/index.js";

test("ConstraintPack type is exported", () => {
  // ConstraintPack is a type, verify it exists by constructing a valid object
  const pack: ConstraintPack = {
    policyIds: ["policy-1"],
    approvalMode: "none",
    autonomyMode: "auto",
    toolPolicy: {
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
    budget: {
      maxSteps: 100,
      maxCost: 1000,
      maxDurationMs: 60000,
    },
  };

  assert.equal(pack.policyIds.length, 1);
  assert.equal(pack.approvalMode, "none");
  assert.equal(pack.autonomyMode, "auto");
  assert.equal(pack.toolPolicy.allowedTools.length, 2);
  assert.equal(pack.risk_policy.maxRiskScore, 10);
  assert.equal(pack.output_policy.requiredEvidence.length, 1);
  assert.equal(pack.budget.maxSteps, 100);
});
