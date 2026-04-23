import test from "node:test";
import assert from "node:assert/strict";
import { HARNESS_PLANNER_ROLE } from "../../../../../src/platform/orchestration/harness/planner/index.js";

test("HARNESS_PLANNER_ROLE constant is exported", () => {
  assert.equal(HARNESS_PLANNER_ROLE, "planner");
});
