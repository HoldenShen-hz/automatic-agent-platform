import assert from "node:assert/strict";
import test from "node:test";

import { mapHarnessStepToOapeflirPhase } from "../../../../src/platform/five-plane-orchestration/harness/oapeflir-harness-mapping.js";

test("mapHarnessStepToOapeflirPhase maps learner role to learn", () => {
  assert.equal(mapHarnessStepToOapeflirPhase("learner", "learn"), "learn");
  assert.equal(mapHarnessStepToOapeflirPhase("learner", "other"), "learn");
});

test("mapHarnessStepToOapeflirPhase maps release_manager role to release", () => {
  assert.equal(mapHarnessStepToOapeflirPhase("release_manager", "release"), "release");
  assert.equal(mapHarnessStepToOapeflirPhase("release_manager", "other"), "release");
});
