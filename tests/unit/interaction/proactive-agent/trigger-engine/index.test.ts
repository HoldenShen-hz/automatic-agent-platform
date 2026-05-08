/**
 * Unit tests for trigger-engine utilities
 */

import assert from "node:assert/strict";
import test from "node:test";
import { resolveTriggerActionMode } from "../../../../../src/interaction/proactive-agent/trigger-engine/index.js";

test("resolveTriggerActionMode returns suggest when requireConfirmation is true", () => {
  assert.equal(resolveTriggerActionMode(true, "low"), "suggest");
  assert.equal(resolveTriggerActionMode(true, "medium"), "suggest");
  assert.equal(resolveTriggerActionMode(true, "high"), "suggest");
  assert.equal(resolveTriggerActionMode(true, "critical"), "suggest");
});

test("resolveTriggerActionMode returns silent_record for critical risk without confirmation", () => {
  assert.equal(resolveTriggerActionMode(false, "critical"), "silent_record");
});

test("resolveTriggerActionMode returns auto_execute for low risk without confirmation", () => {
  assert.equal(resolveTriggerActionMode(false, "low"), "auto_execute");
});

test("resolveTriggerActionMode returns auto_execute for medium risk without confirmation", () => {
  assert.equal(resolveTriggerActionMode(false, "medium"), "auto_execute");
});

test("resolveTriggerActionMode returns suggest for high risk without confirmation", () => {
  assert.equal(resolveTriggerActionMode(false, "high"), "suggest");
});

test("resolveTriggerActionMode covers all risk levels with confirmation required", () => {
  const riskLevels: Array<"low" | "medium" | "high" | "critical"> = ["low", "medium", "high", "critical"];
  for (const risk of riskLevels) {
    assert.equal(resolveTriggerActionMode(true, risk), "suggest");
  }
});

test("resolveTriggerActionMode covers all risk levels without confirmation", () => {
  assert.equal(resolveTriggerActionMode(false, "low"), "auto_execute");
  assert.equal(resolveTriggerActionMode(false, "medium"), "auto_execute");
  assert.equal(resolveTriggerActionMode(false, "high"), "suggest");
  assert.equal(resolveTriggerActionMode(false, "critical"), "silent_record");
});
