import assert from "node:assert/strict";
import test from "node:test";

import { HarnessRuntimeService } from "../../../../../src/platform/orchestration/harness/index.js";

test("HarnessRuntimeService.decide honors guardrail retry suggestion before evaluator acceptance", () => {
  const runtime = new HarnessRuntimeService();

  const decision = runtime.decide({
    evaluatorScore: 0.91,
    requiresHuman: false,
    maxIterationsReached: false,
    guardrailSuggestedAction: "retry_same_plan",
  });

  assert.equal(decision.action, "retry_same_plan");
  assert.ok(decision.reasonCodes.includes("harness.guardrail_retry_same_plan"));
});
