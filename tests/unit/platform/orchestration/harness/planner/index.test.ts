import assert from "node:assert/strict";
import test from "node:test";

import { HARNESS_PLANNER_ROLE } from "../../../../../../src/platform/orchestration/harness/planner/index.js";

test("HARNESS_PLANNER_ROLE is a string", () => {
  assert.equal(typeof HARNESS_PLANNER_ROLE, "string");
});

test("HARNESS_PLANNER_ROLE has expected value", () => {
  assert.equal(HARNESS_PLANNER_ROLE, "planner");
});

test("HARNESS_PLANNER_ROLE is non-empty", () => {
  assert.ok(HARNESS_PLANNER_ROLE.length > 0);
});

test("HARNESS_PLANNER_ROLE can be used in role comparisons", () => {
  const role = "planner";
  assert.equal(role, HARNESS_PLANNER_ROLE);
});