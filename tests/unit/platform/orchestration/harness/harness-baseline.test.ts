import assert from "node:assert/strict";
import test from "node:test";

import * as harnessModule from "../../../../../src/platform/orchestration/harness/index.js";
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

test("harness baseline service names resolve from the canonical harness entry", () => {
  for (const baseline of listHarnessCapabilityBaselines()) {
    for (const serviceName of baseline.baselineServices) {
      assert.equal(
        serviceName in harnessModule,
        true,
        `expected ${serviceName} to be exported by ${baseline.entryModule}`,
      );
    }
  }
});
