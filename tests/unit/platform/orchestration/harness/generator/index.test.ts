import assert from "node:assert/strict";
import test from "node:test";

import { HARNESS_GENERATOR_ROLE } from "../../../../../../src/platform/orchestration/harness/generator/index.js";

test("HARNESS_GENERATOR_ROLE is a string", () => {
  assert.equal(typeof HARNESS_GENERATOR_ROLE, "string");
});

test("HARNESS_GENERATOR_ROLE has expected value", () => {
  assert.equal(HARNESS_GENERATOR_ROLE, "generator");
});

test("HARNESS_GENERATOR_ROLE is used for harness generation", () => {
  assert.ok(HARNESS_GENERATOR_ROLE.length > 0);
  assert.equal(HARNESS_GENERATOR_ROLE, "generator");
});

test("HARNESS_GENERATOR_ROLE can be used in role comparisons", () => {
  const componentRole = "generator";
  assert.equal(componentRole, HARNESS_GENERATOR_ROLE);
});

test("HARNESS_GENERATOR_ROLE is a non-empty string", () => {
  assert.ok(HARNESS_GENERATOR_ROLE.length > 0);
});