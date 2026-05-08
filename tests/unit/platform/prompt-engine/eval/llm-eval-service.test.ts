import assert from "node:assert/strict";
import test from "node:test";

import type {
  EvalStatus,
  EvalSuiteKind,
  QualityVerdict,
  EvalStructuredOutput,
} from "../../../../../src/platform/prompt-engine/eval/llm-eval-service.js";

test("EvalStatus type accepts valid values", () => {
  const statuses: EvalStatus[] = ["pending", "running", "passed", "failed", "degraded"];
  assert.equal(statuses.length, 5);
});

test("EvalSuiteKind type accepts valid values", () => {
  const kinds: EvalSuiteKind[] = ["golden", "regression", "ab_test", "smoke"];
  assert.equal(kinds.length, 4);
});

test("QualityVerdict type accepts valid values", () => {
  const verdicts: QualityVerdict[] = ["pass", "fail", "degraded", "inconclusive"];
  assert.equal(verdicts.length, 4);
});

test("EvalStructuredOutput type accepts various values", () => {
  const outputs: EvalStructuredOutput[] = [
    "string",
    42,
    true,
    null,
    { key: "value" },
    [1, 2, 3],
  ];
  assert.equal(outputs.length, 6);
});
