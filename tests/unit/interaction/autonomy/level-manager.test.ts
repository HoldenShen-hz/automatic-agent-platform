import assert from "node:assert/strict";
import test from "node:test";

import { compareAutonomyLevels, nextAutonomyLevel } from "../../../../src/interaction/autonomy/level-manager/index.js";

test("compareAutonomyLevels returns positive when left is higher", () => {
  assert.ok(compareAutonomyLevels("supervised", "suggestion") > 0);
  assert.ok(compareAutonomyLevels("semi_auto", "supervised") > 0);
  assert.ok(compareAutonomyLevels("full_auto", "semi_auto") > 0);
});

test("compareAutonomyLevels returns negative when left is lower", () => {
  assert.ok(compareAutonomyLevels("suggestion", "supervised") < 0);
  assert.ok(compareAutonomyLevels("supervised", "semi_auto") < 0);
  assert.ok(compareAutonomyLevels("semi_auto", "full_auto") < 0);
});

test("compareAutonomyLevels returns zero for equal levels", () => {
  assert.equal(compareAutonomyLevels("suggestion", "suggestion"), 0);
  assert.equal(compareAutonomyLevels("supervised", "supervised"), 0);
  assert.equal(compareAutonomyLevels("full_auto", "full_auto"), 0);
});

test("compareAutonomyLevels handles frozen level", () => {
  assert.ok(compareAutonomyLevels("frozen", "suggestion") > 0);
  assert.ok(compareAutonomyLevels("frozen", "full_auto") > 0);
  assert.equal(compareAutonomyLevels("frozen", "frozen"), 0);
});

test("nextAutonomyLevel returns frozen for frozen input", () => {
  assert.equal(nextAutonomyLevel("frozen"), "frozen");
});

test("nextAutonomyLevel suggestion goes to supervised", () => {
  assert.equal(nextAutonomyLevel("suggestion"), "supervised");
});

test("nextAutonomyLevel supervised goes to semi_auto", () => {
  assert.equal(nextAutonomyLevel("supervised"), "semi_auto");
});

test("nextAutonomyLevel semi_auto goes to full_auto", () => {
  assert.equal(nextAutonomyLevel("semi_auto"), "full_auto");
});

test("nextAutonomyLevel full_auto goes to full_auto (capped)", () => {
  // Full auto is second to last before frozen
  assert.equal(nextAutonomyLevel("full_auto"), "full_auto");
});

test("nextAutonomyLevel handles frozen as last element", () => {
  // Frozen should stay frozen
  assert.equal(nextAutonomyLevel("frozen"), "frozen");
});
