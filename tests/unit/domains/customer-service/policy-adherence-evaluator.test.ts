import assert from "node:assert/strict";
import test from "node:test";

import { evaluatePolicyAdherence } from "../../../../src/domains/customer-service/policy-adherence-evaluator.js";

test("evaluatePolicyAdherence flags missing HITL and computes metrics", () => {
  const report = evaluatePolicyAdherence([
    {
      caseId: "case-1",
      policyMatched: true,
      toolArgumentsValid: true,
      handoffCorrect: true,
      requiresHitl: true,
      hitlApproved: false,
    },
    {
      caseId: "case-2",
      policyMatched: true,
      toolArgumentsValid: true,
      handoffCorrect: false,
      requiresHitl: false,
      hitlApproved: false,
    },
  ]);

  assert.equal(report.policyViolationCount, 1);
  assert.deepEqual(report.blockers, ["case-1:missing_hitl"]);
  assert.equal(report.toolArgumentCorrectness, 1);
});
