import test from "node:test";
import assert from "node:assert/strict";
import { HARNESS_GENERATOR_ROLE } from "../../../../../src/platform/orchestration/harness/generator/index.js";

test("HARNESS_GENERATOR_ROLE constant is exported", () => {
  assert.equal(HARNESS_GENERATOR_ROLE, "generator");
});
