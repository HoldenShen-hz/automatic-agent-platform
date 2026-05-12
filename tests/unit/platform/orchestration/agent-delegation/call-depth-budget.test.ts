import assert from "node:assert/strict";
import test from "node:test";

import { CallDepthBudget } from "../../../../../src/platform/orchestration/agent-delegation/call-depth-budget.js";

test("CallDepthBudget evaluates total depth budget by summing all dimensions", () => {
  const budget = new CallDepthBudget();

  const decision = budget.evaluate({
    currentCallDepth: 4,
    goalDecompositionDepth: 4,
    delegationDepth: 4,
  });

  assert.equal(decision.effectiveCallDepth, 12);
  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "call_depth.exceeded");
});

test("CallDepthBudget allows requests under the max depth budget", () => {
  const budget = new CallDepthBudget();

  const decision = budget.evaluate({
    currentCallDepth: 1,
    goalDecompositionDepth: 1,
    delegationDepth: 1,
  });

  assert.equal(decision.effectiveCallDepth, 3);
  assert.equal(decision.allowed, true);
  assert.equal(decision.reasonCode, "call_depth.allowed");
});
