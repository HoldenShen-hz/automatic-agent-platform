import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTONOMY_LEVEL_ORDER,
  compareAutonomyLevels,
  nextAutonomyLevel,
} from "../../../../../src/interaction/autonomy/level-manager/index.js";
import type { AutonomyLevel } from "../../../../../src/interaction/autonomy/index.js";

test("AUTONOMY_LEVEL_ORDER contains all five levels", () => {
  assert.deepEqual(AUTONOMY_LEVEL_ORDER, ["frozen", "suggestion", "supervised", "semi_auto", "full_auto"]);
});

test("compareAutonomyLevels returns negative when left is lower", () => {
  assert.ok(compareAutonomyLevels("frozen", "suggestion") < 0);
  assert.ok(compareAutonomyLevels("suggestion", "supervised") < 0);
  assert.ok(compareAutonomyLevels("supervised", "semi_auto") < 0);
  assert.ok(compareAutonomyLevels("semi_auto", "full_auto") < 0);
});

test("compareAutonomyLevels returns positive when left is higher", () => {
  assert.ok(compareAutonomyLevels("full_auto", "frozen") > 0);
  assert.ok(compareAutonomyLevels("full_auto", "semi_auto") > 0);
  assert.ok(compareAutonomyLevels("semi_auto", "supervised") > 0);
  assert.ok(compareAutonomyLevels("supervised", "suggestion") > 0);
});

test("compareAutonomyLevels returns 0 for same level", () => {
  assert.equal(compareAutonomyLevels("suggestion", "suggestion"), 0);
  assert.equal(compareAutonomyLevels("frozen", "frozen"), 0);
  assert.equal(compareAutonomyLevels("full_auto", "full_auto"), 0);
});

test("compareAutonomyLevels handles frozen specially", () => {
  assert.ok(compareAutonomyLevels("frozen", "suggestion") < 0);
  assert.ok(compareAutonomyLevels("suggestion", "frozen") > 0);
});

test("nextAutonomyLevel advances suggestion to supervised", () => {
  assert.equal(nextAutonomyLevel("suggestion"), "supervised");
});

test("nextAutonomyLevel advances supervised to semi_auto", () => {
  assert.equal(nextAutonomyLevel("supervised"), "semi_auto");
});

test("nextAutonomyLevel advances semi_auto to full_auto", () => {
  assert.equal(nextAutonomyLevel("semi_auto"), "full_auto");
});

test("nextAutonomyLevel keeps frozen at frozen", () => {
  assert.equal(nextAutonomyLevel("frozen"), "frozen");
});

test("nextAutonomyLevel does not exceed full_auto", () => {
  assert.equal(nextAutonomyLevel("full_auto"), "full_auto");
});

test("nextAutonomyLevel order is consistent with AUTONOMY_LEVEL_ORDER", () => {
  assert.equal(nextAutonomyLevel("suggestion"), "supervised");
  assert.equal(nextAutonomyLevel("supervised"), "semi_auto");
  assert.equal(nextAutonomyLevel("semi_auto"), "full_auto");
  assert.equal(nextAutonomyLevel("full_auto"), "full_auto");
  assert.equal(nextAutonomyLevel("frozen"), "frozen");
});
