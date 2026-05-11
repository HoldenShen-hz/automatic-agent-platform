import assert from "node:assert/strict";
import test from "node:test";

import {
  PROMPT_ROLLOUT_STAGES,
  QUALITY_GATE_THRESHOLDS,
  comparePromptRolloutStage,
  isPromptRolloutStage,
  nextPromptRolloutStage,
  passesQualityGate,
  type PromptRolloutStage,
} from "../../../../../src/platform/prompt-engine/rollout/prompt-rollout-stage.js";

test("PROMPT_ROLLOUT_STAGES contains expected stages in order", () => {
  assert.deepEqual(PROMPT_ROLLOUT_STAGES, ["canary_5", "canary_20", "stable", "rolled_back"]);
});

test("isPromptRolloutStage returns true for valid stages", () => {
  assert.equal(isPromptRolloutStage("canary_5"), true);
  assert.equal(isPromptRolloutStage("canary_20"), true);
  assert.equal(isPromptRolloutStage("stable"), true);
  assert.equal(isPromptRolloutStage("rolled_back"), true);
});

test("isPromptRolloutStage returns false for invalid stages", () => {
  assert.equal(isPromptRolloutStage("canary_50"), false);
  assert.equal(isPromptRolloutStage("partial"), false);
  assert.equal(isPromptRolloutStage(""), false);
  assert.equal(isPromptRolloutStage("STABLE"), false);
});

test("comparePromptRolloutStage returns negative when left comes before right", () => {
  assert.ok(comparePromptRolloutStage("canary_5", "canary_20") < 0);
  assert.ok(comparePromptRolloutStage("canary_20", "stable") < 0);
  assert.ok(comparePromptRolloutStage("stable", "rolled_back") < 0);
});

test("comparePromptRolloutStage returns positive when left comes after right", () => {
  assert.ok(comparePromptRolloutStage("canary_20", "canary_5") > 0);
  assert.ok(comparePromptRolloutStage("stable", "canary_20") > 0);
  assert.ok(comparePromptRolloutStage("rolled_back", "stable") > 0);
});

test("comparePromptRolloutStage returns zero for same stage", () => {
  assert.equal(comparePromptRolloutStage("canary_5", "canary_5"), 0);
  assert.equal(comparePromptRolloutStage("stable", "stable"), 0);
});

test("nextPromptRolloutStage returns null for stable (terminal stage)", () => {
  // Issue 1956 fix: stable is terminal - cannot advance to rolled_back
  assert.equal(nextPromptRolloutStage("stable"), null);
});

test("nextPromptRolloutStage returns null for rolled_back (last stage)", () => {
  assert.equal(nextPromptRolloutStage("rolled_back"), null);
});

test("QUALITY_GATE_THRESHOLDS has correct structure", () => {
  assert.equal(QUALITY_GATE_THRESHOLDS.canary_5.maxErrorRate, 0.05);
  assert.equal(QUALITY_GATE_THRESHOLDS.canary_5.minPassthrough, 0.95);
  assert.equal(QUALITY_GATE_THRESHOLDS.canary_20.maxErrorRate, 0.03);
  assert.equal(QUALITY_GATE_THRESHOLDS.canary_20.minPassthrough, 0.97);
  assert.equal(QUALITY_GATE_THRESHOLDS.stable.maxErrorRate, 0.01);
  assert.equal(QUALITY_GATE_THRESHOLDS.stable.minPassthrough, 0.99);
});

test("QUALITY_GATE_THRESHOLDS does not have threshold for rolled_back", () => {
  assert.equal("rolled_back" in QUALITY_GATE_THRESHOLDS, false);
});

test("passesQualityGate returns true when error rate below threshold for canary_5", () => {
  assert.equal(passesQualityGate("canary_5", 0.04), true);
  assert.equal(passesQualityGate("canary_5", 0.049), true);
  assert.equal(passesQualityGate("canary_5", 0.05), false);
});

test("passesQualityGate returns true when error rate below threshold for canary_20", () => {
  assert.equal(passesQualityGate("canary_20", 0.02), true);
  assert.equal(passesQualityGate("canary_20", 0.029), true);
  assert.equal(passesQualityGate("canary_20", 0.03), false);
});

test("passesQualityGate returns true when error rate below threshold for stable", () => {
  assert.equal(passesQualityGate("stable", 0.005), true);
  assert.equal(passesQualityGate("stable", 0.009), true);
  assert.equal(passesQualityGate("stable", 0.01), false);
});

test("passesQualityGate returns true for rolled_back (no threshold)", () => {
  assert.equal(passesQualityGate("rolled_back", 1.0), true);
  assert.equal(passesQualityGate("rolled_back", 0.5), true);
  assert.equal(passesQualityGate("rolled_back", 0.0), true);
});

test("passesQualityGate boundary conditions", () => {
  assert.equal(passesQualityGate("canary_5", 0.0), true);
  assert.equal(passesQualityGate("canary_20", 0.0), true);
  assert.equal(passesQualityGate("stable", 0.0), true);
});