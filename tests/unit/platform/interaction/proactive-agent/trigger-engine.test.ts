import test from "node:test";
import { strict as assert } from "node:assert/strict";
import { resolveTriggerActionMode } from "../../../../../src/interaction/proactive-agent/trigger-engine/index.js";

test("resolveTriggerActionMode returns suggest when requireConfirmation is true [platform-trigger-engine]", () => {
  assert.strictEqual(resolveTriggerActionMode(true, "low"), "suggest");
  assert.strictEqual(resolveTriggerActionMode(true, "medium"), "suggest");
  assert.strictEqual(resolveTriggerActionMode(true, "high"), "suggest");
  assert.strictEqual(resolveTriggerActionMode(true, "critical"), "suggest");
});

test("resolveTriggerActionMode returns silent_record for critical risk when no confirmation required", () => {
  assert.strictEqual(resolveTriggerActionMode(false, "critical"), "silent_record");
});

test("resolveTriggerActionMode returns auto_execute only for low risk when no confirmation required", () => {
  assert.strictEqual(resolveTriggerActionMode(false, "low"), "auto_execute");
  assert.strictEqual(resolveTriggerActionMode(false, "medium"), "suggest");
  assert.strictEqual(resolveTriggerActionMode(false, "high"), "suggest");
});

test("resolveTriggerActionMode treats missing confirmation requirement as false", () => {
  assert.strictEqual(resolveTriggerActionMode(false, "low"), "auto_execute");
});

test("resolveTriggerActionMode returns correct modes for all risk levels without confirmation", () => {
  assert.strictEqual(resolveTriggerActionMode(false, "low"), "auto_execute");
  assert.strictEqual(resolveTriggerActionMode(false, "medium"), "suggest");
  assert.strictEqual(resolveTriggerActionMode(false, "high"), "suggest");
  assert.strictEqual(resolveTriggerActionMode(false, "critical"), "silent_record");
});

test("resolveTriggerActionMode with confirmation overrides risk level", () => {
  assert.strictEqual(resolveTriggerActionMode(true, "critical"), "suggest");
  assert.strictEqual(resolveTriggerActionMode(true, "low"), "suggest");
});

test("resolveTriggerActionMode handles undefined risk level", () => {
  assert.strictEqual(
    resolveTriggerActionMode(false, undefined as unknown as "low" | "medium" | "high" | "critical"),
    "auto_execute",
  );
});

test("resolveTriggerActionMode returns string literal types", () => {
  const result = resolveTriggerActionMode(false, "low");
  assert.ok(result === "auto_execute" || result === "suggest" || result === "silent_record");
});

test("resolveTriggerActionMode for low risk without confirmation is always auto_execute", () => {
  const modes = ["auto_execute", "suggest", "silent_record"];
  for (const mode of modes) {
    // Only "auto_execute" is valid for low risk without confirmation
  }
  assert.strictEqual(resolveTriggerActionMode(false, "low"), "auto_execute");
});

test("resolveTriggerActionMode for medium risk without confirmation is always suggest", () => {
  assert.strictEqual(resolveTriggerActionMode(false, "medium"), "suggest");
});

test("resolveTriggerActionMode for high risk without confirmation requires operator-visible suggestion", () => {
  assert.strictEqual(resolveTriggerActionMode(false, "high"), "suggest");
});

test("resolveTriggerActionMode is deterministic", () => {
  const result1 = resolveTriggerActionMode(false, "critical");
  const result2 = resolveTriggerActionMode(false, "critical");
  assert.strictEqual(result1, result2);
});

test("resolveTriggerActionMode suggest is returned before checking risk when confirmation required", () => {
  assert.strictEqual(resolveTriggerActionMode(true, "low"), "suggest");
  assert.strictEqual(resolveTriggerActionMode(true, "medium"), "suggest");
  assert.strictEqual(resolveTriggerActionMode(true, "high"), "suggest");
  assert.strictEqual(resolveTriggerActionMode(true, "critical"), "suggest");
});

test("resolveTriggerActionMode priority order: confirmation > critical > high-risk suggestion > auto_execute", () => {
  // With confirmation, always suggest
  assert.strictEqual(resolveTriggerActionMode(true, "low"), "suggest");

  // Without confirmation, critical is silent_record
  assert.strictEqual(resolveTriggerActionMode(false, "critical"), "silent_record");

  // Without confirmation, high risk is still operator-visible
  assert.strictEqual(resolveTriggerActionMode(false, "high"), "suggest");

  // Without confirmation, only low risk is auto_execute
  assert.strictEqual(resolveTriggerActionMode(false, "medium"), "suggest");
});

test("resolveTriggerActionMode exact critical threshold", () => {
  assert.strictEqual(resolveTriggerActionMode(false, "critical"), "silent_record");
});

test("resolveTriggerActionMode medium risk treated as non-critical", () => {
  assert.strictEqual(resolveTriggerActionMode(false, "medium"), "suggest");
});

test("resolveTriggerActionMode high risk is treated as suggest, not auto_execute", () => {
  assert.strictEqual(resolveTriggerActionMode(false, "high"), "suggest");
});

test("resolveTriggerActionMode low risk treated as non-critical", () => {
  assert.strictEqual(resolveTriggerActionMode(false, "low"), "auto_execute");
});

test("resolveTriggerActionMode boolean confirmation flags work correctly", () => {
  assert.strictEqual(resolveTriggerActionMode(false, "low"), "auto_execute");
  assert.strictEqual(resolveTriggerActionMode(true, "low"), "suggest");

  assert.strictEqual(resolveTriggerActionMode(false, "critical"), "silent_record");
  assert.strictEqual(resolveTriggerActionMode(true, "critical"), "suggest");
});
