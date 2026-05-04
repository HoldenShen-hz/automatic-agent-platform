import assert from "node:assert/strict";
import test from "node:test";

import type { SuccessCriterion } from "../../../../src/interaction/goal-decomposer/index.js";

test("goal-decomposer SuccessCriterion requires operator and threshold fields", () => {
  const criterion: SuccessCriterion = {
    metric: "pass_rate",
    target: "deployment_quality",
    operator: ">=",
    threshold: 0.95,
    evaluationMethod: "automated_test",
  };

  assert.equal(criterion.metric, "pass_rate");
  assert.equal(criterion.operator, ">=");
  assert.equal(criterion.threshold, 0.95);
  assert.equal(criterion.evaluationMethod, "automated_test");
});
