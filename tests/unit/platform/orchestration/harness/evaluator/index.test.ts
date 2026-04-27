import assert from "node:assert/strict";
import test from "node:test";

import { HARNESS_EVALUATOR_ROLE } from "../../../../../../src/platform/orchestration/harness/evaluator/index.js";

test("HARNESS_EVALUATOR_ROLE is a string", () => {
  assert.equal(typeof HARNESS_EVALUATOR_ROLE, "string");
});

test("HARNESS_EVALUATOR_ROLE has expected value", () => {
  assert.equal(HARNESS_EVALUATOR_ROLE, "evaluator");
});

test("HARNESS_EVALUATOR_ROLE is used for harness evaluation", () => {
  // The role constant is used to identify the evaluator component in the harness system
  assert.ok(HARNESS_EVALUATOR_ROLE.length > 0);
  assert.equal(HARNESS_EVALUATOR_ROLE, "evaluator");
});

test("HARNESS_EVALUATOR_ROLE can be used in role comparisons", () => {
  const componentRole = "evaluator";
  assert.equal(componentRole, HARNESS_EVALUATOR_ROLE);
});

test("HARNESS_EVALUATOR_ROLE is a non-empty string", () => {
  assert.ok(HARNESS_EVALUATOR_ROLE.length > 0);
});