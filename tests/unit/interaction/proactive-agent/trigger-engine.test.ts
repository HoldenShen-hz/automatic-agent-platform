/**
 * Unit tests for trigger-engine utilities
 */

import assert from "node:assert/strict";
import test from "node:test";
import { resolveTriggerActionMode } from "../../../../src/interaction/proactive-agent/trigger-engine/index.js";

test("resolveTriggerActionMode returns suggest when requireConfirmation is true", () => {
  const mode = resolveTriggerActionMode(true, "low");
  assert.equal(mode, "suggest");
});

test("resolveTriggerActionMode returns silent_record for critical risk without confirmation", () => {
  const mode = resolveTriggerActionMode(false, "critical");
  assert.equal(mode, "silent_record");
});

test("resolveTriggerActionMode returns auto_execute for low/medium risk and suggest for high risk without confirmation", () => {
  assert.equal(resolveTriggerActionMode(false, "low"), "auto_execute");
  assert.equal(resolveTriggerActionMode(false, "medium"), "auto_execute");
  assert.equal(resolveTriggerActionMode(false, "high"), "suggest");
});

test("resolveTriggerActionMode suggest for critical risk when confirmation required", () => {
  const mode = resolveTriggerActionMode(true, "critical");
  assert.equal(mode, "suggest");
});

test("resolveTriggerActionMode suggest for medium risk when confirmation required", () => {
  const mode = resolveTriggerActionMode(true, "medium");
  assert.equal(mode, "suggest");
});

test("resolveTriggerActionMode suggest for high risk when confirmation required", () => {
  const mode = resolveTriggerActionMode(true, "high");
  assert.equal(mode, "suggest");
});

test("resolveTriggerActionMode silent_record for low risk when no confirmation and critical risk", () => {
  // critical alone triggers silent_record; low risk does not override
  const mode = resolveTriggerActionMode(false, "critical");
  assert.equal(mode, "silent_record");
});
