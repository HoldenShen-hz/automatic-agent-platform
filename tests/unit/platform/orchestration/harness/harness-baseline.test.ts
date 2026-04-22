import assert from "node:assert/strict";
import test from "node:test";

import {
  listHarnessCapabilityBaselines,
  resolveHarnessCapabilityBaseline,
} from "../../../../../src/platform/orchestration/harness/harness-baseline.js";

test("harness baseline covers phase 8a-8c orchestration services", () => {
  const baselines = listHarnessCapabilityBaselines();
  assert.deepEqual(
    baselines.map((item) => item.capabilityId),
    ["constraint-pack", "planner-generator-evaluator-loop", "hitl", "governance"],
  );
  assert.equal(resolveHarnessCapabilityBaseline("governance").entryModule, "src/platform/orchestration/harness/index.ts");
});
