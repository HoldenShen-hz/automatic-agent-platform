import test from "node:test";
import { strict as assert } from "node:assert/strict";
import {
  compareAutonomyLevels,
  nextAutonomyLevel,
  AUTONOMY_LEVEL_ORDER,
} from "../../../../../src/interaction/autonomy/level-manager/index.js";

test("compareAutonomyLevels returns positive when left is higher", () => {
  assert.ok(compareAutonomyLevels("full_auto", "supervised") > 0);
  assert.ok(compareAutonomyLevels("semi_auto", "suggestion") > 0);
});

test("compareAutonomyLevels returns negative when left is lower", () => {
  assert.ok(compareAutonomyLevels("suggestion", "full_auto") < 0);
  assert.ok(compareAutonomyLevels("supervised", "semi_auto") < 0);
});

test("compareAutonomyLevels returns 0 for same level", () => {
  assert.strictEqual(compareAutonomyLevels("supervised", "supervised"), 0);
  assert.strictEqual(compareAutonomyLevels("full_auto", "full_auto"), 0);
});

test("compareAutonomyLevels frozen is highest", () => {
  assert.ok(compareAutonomyLevels("frozen", "full_auto") > 0);
  assert.ok(compareAutonomyLevels("frozen", "suggestion") > 0);
});

test("compareAutonomyLevels suggestion is lowest non-frozen", () => {
  assert.ok(compareAutonomyLevels("suggestion", "supervised") < 0);
  assert.ok(compareAutonomyLevels("suggestion", "frozen") < 0);
});

test("AUTONOMY_LEVEL_ORDER contains all levels in ascending order", () => {
  assert.deepStrictEqual(AUTONOMY_LEVEL_ORDER, [
    "suggestion",
    "supervised",
    "semi_auto",
    "full_auto",
    "frozen",
  ]);
});

test("nextAutonomyLevel returns next higher level", () => {
  assert.strictEqual(nextAutonomyLevel("suggestion"), "supervised");
  assert.strictEqual(nextAutonomyLevel("supervised"), "semi_auto");
  assert.strictEqual(nextAutonomyLevel("semi_auto"), "full_auto");
});

test("nextAutonomyLevel frozen stays frozen", () => {
  assert.strictEqual(nextAutonomyLevel("frozen"), "frozen");
});

test("nextAutonomyLevel full_auto stays full_auto", () => {
  assert.strictEqual(nextAutonomyLevel("full_auto"), "full_auto");
});

test("nextAutonomyLevel boundary case from full_auto", () => {
  const result = nextAutonomyLevel("full_auto");
  assert.strictEqual(result, "full_auto");
});

test("compareAutonomyLevels order is consistent with AUTONOMY_LEVEL_ORDER", () => {
  for (let i = 0; i < AUTONOMY_LEVEL_ORDER.length; i++) {
    for (let j = 0; j < AUTONOMY_LEVEL_ORDER.length; j++) {
      const expected = i - j;
      const actual = compareAutonomyLevels(AUTONOMY_LEVEL_ORDER[i]!, AUTONOMY_LEVEL_ORDER[j]!);
      if (expected !== 0) {
        assert.ok(actual !== 0, `Expected non-zero for ${AUTONOMY_LEVEL_ORDER[i]} vs ${AUTONOMY_LEVEL_ORDER[j]}`);
      }
    }
  }
});

test("nextAutonomyLevel from suggestion goes to supervised", () => {
  assert.strictEqual(nextAutonomyLevel("suggestion"), "supervised");
});

test("nextAutonomyLevel from supervised goes to semi_auto", () => {
  assert.strictEqual(nextAutonomyLevel("supervised"), "semi_auto");
});

test("nextAutonomyLevel from semi_auto goes to full_auto", () => {
  assert.strictEqual(nextAutonomyLevel("semi_auto"), "full_auto");
});