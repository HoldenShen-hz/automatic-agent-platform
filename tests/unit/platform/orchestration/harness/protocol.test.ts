import test from "node:test";
import assert from "node:assert/strict";
import { HARNESS_EVALUATOR_ROLE } from "../../../../../src/platform/orchestration/harness/protocol/index.js";

test("HARNESS_EVALUATOR_ROLE constant is exported and has correct value", () => {
  assert.equal(HARNESS_EVALUATOR_ROLE, "evaluator");
});

test("HARNESS_EVALUATOR_ROLE is a string type", () => {
  assert.equal(typeof HARNESS_EVALUATOR_ROLE, "string");
});

test("HARNESS_EVALUATOR_ROLE is not empty", () => {
  assert.ok(HARNESS_EVALUATOR_ROLE.length > 0);
});