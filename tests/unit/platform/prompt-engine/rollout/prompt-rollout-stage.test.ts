/**
 * Unit tests for prompt rollout stage
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  PROMPT_ROLLOUT_STAGES,
  isPromptRolloutStage,
  comparePromptRolloutStage,
  nextPromptRolloutStage,
  QUALITY_GATE_THRESHOLDS,
  passesQualityGate,
  type PromptRolloutStage,
} from "../../../../../src/platform/prompt-engine/rollout/prompt-rollout-stage.js";

test("PROMPT_ROLLOUT_STAGES contains all valid stages", () => {
  assert.deepEqual(PROMPT_ROLLOUT_STAGES, ["canary_5", "canary_20", "stable", "rolled_back"]);
});

test("isPromptRolloutStage validates correct stages", () => {
  assert.equal(isPromptRolloutStage("canary_5"), true);
  assert.equal(isPromptRolloutStage("canary_20"), true);
  assert.equal(isPromptRolloutStage("stable"), true);
  assert.equal(isPromptRolloutStage("rolled_back"), true);
});

test("isPromptRolloutStage rejects invalid stages", () => {
  assert.equal(isPromptRolloutStage("draft"), false);
  assert.equal(isPromptRolloutStage("staging"), false);
  assert.equal(isPromptRolloutStage("shadow"), false);
  assert.equal(isPromptRolloutStage("invalid"), false);
  assert.equal(isPromptRolloutStage(""), false);
});

test("comparePromptRolloutStage orders stages correctly", () => {
  assert.equal(comparePromptRolloutStage("canary_5", "canary_5"), 0);
  assert.ok(comparePromptRolloutStage("canary_5", "canary_20") < 0);
  assert.ok(comparePromptRolloutStage("canary_20", "canary_5") > 0);
  assert.ok(comparePromptRolloutStage("canary_20", "stable") < 0);
  assert.ok(comparePromptRolloutStage("stable", "canary_5") > 0);
  assert.ok(comparePromptRolloutStage("stable", "rolled_back") < 0);
});

test("nextPromptRolloutStage returns correct next stage", () => {
  assert.equal(nextPromptRolloutStage("canary_5"), "canary_20");
  assert.equal(nextPromptRolloutStage("canary_20"), "stable");
  assert.equal(nextPromptRolloutStage("stable"), "rolled_back");
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

test("passesQualityGate returns true when error rate below threshold", () => {
  assert.equal(passesQualityGate("canary_5", 0.03), true);
  assert.equal(passesQualityGate("canary_20", 0.01), true);
  assert.equal(passesQualityGate("stable", 0.005), true);
});

test("passesQualityGate returns false when error rate exceeds threshold", () => {
  assert.equal(passesQualityGate("canary_5", 0.06), false);
  assert.equal(passesQualityGate("canary_20", 0.04), false);
  assert.equal(passesQualityGate("stable", 0.02), false);
});

test("passesQualityGate returns true for rolled_back (no threshold)", () => {
  assert.equal(passesQualityGate("rolled_back", 0.99), true);
  assert.equal(passesQualityGate("rolled_back", 1.0), true);
});

test("PromptRolloutStage type allows valid stages only", () => {
  const stage: PromptRolloutStage = "canary_5";
  assert.equal(stage, "canary_5");

  const stable: PromptRolloutStage = "stable";
  assert.equal(stable, "stable");
});

test("comparePromptRolloutStage is symmetric for same inputs", () => {
  const result1 = comparePromptRolloutStage("canary_5", "stable");
  const result2 = comparePromptRolloutStage("stable", "canary_5");
  assert.equal(result1, -result2);
});

test("QUALITY_GATE_THRESHOLDS canary_5 is more lenient than canary_20", () => {
  assert.ok(
    QUALITY_GATE_THRESHOLDS.canary_5.maxErrorRate > QUALITY_GATE_THRESHOLDS.canary_20.maxErrorRate,
    "canary_5 threshold should be more lenient than canary_20",
  );
});

test("QUALITY_GATE_THRESHOLDS stable is strictest", () => {
  assert.ok(
    QUALITY_GATE_THRESHOLDS.stable.maxErrorRate < QUALITY_GATE_THRESHOLDS.canary_20.maxErrorRate,
    "stable threshold should be strictest",
  );
});

test("passesQualityGate boundary at exact threshold", () => {
  assert.equal(passesQualityGate("canary_5", 0.05), false, "exact threshold is not below");
  assert.equal(passesQualityGate("canary_5", 0.049), true, "just below threshold passes");
});