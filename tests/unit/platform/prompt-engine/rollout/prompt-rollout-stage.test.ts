/**
 * Unit tests for prompt rollout stage
 *
 * Tests for prompt-rollout-stage covering:
 * - Issue #1956: Stage order wrong: shadow before canary
 * - Issue #1963: stable→rolled_back auto advance
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

// ============================================================================
// Issue #1956: Stage order wrong: shadow before canary
// ============================================================================

test("PROMPT_ROLLOUT_STAGES contains all valid stages", () => {
  assert.deepEqual(PROMPT_ROLLOUT_STAGES, ["canary_5", "canary_20", "stable", "rolled_back"]);
});

test("PROMPT_ROLLOUT_STAGES has correct order (canary before stable)", () => {
  // Issue #1956: Stage order should be canary_5 → canary_20 → stable → rolled_back
  const canary5Index = PROMPT_ROLLOUT_STAGES.indexOf("canary_5");
  const canary20Index = PROMPT_ROLLOUT_STAGES.indexOf("canary_20");
  const stableIndex = PROMPT_ROLLOUT_STAGES.indexOf("stable");
  const rolledBackIndex = PROMPT_ROLLOUT_STAGES.indexOf("rolled_back");

  assert.ok(canary5Index >= 0, "canary_5 should be in stages");
  assert.ok(canary20Index >= 0, "canary_20 should be in stages");
  assert.ok(stableIndex >= 0, "stable should be in stages");
  assert.ok(rolledBackIndex >= 0, "rolled_back should be in stages");

  assert.ok(canary5Index < canary20Index, "canary_5 should come before canary_20");
  assert.ok(canary20Index < stableIndex, "canary_20 should come before stable");
  assert.ok(stableIndex < rolledBackIndex, "stable should come before rolled_back");
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
  assert.equal(isPromptRolloutStage("partial_25"), false);
  assert.equal(isPromptRolloutStage("partial_50"), false);
  assert.equal(isPromptRolloutStage("partial_75"), false);
  assert.equal(isPromptRolloutStage("invalid"), false);
  assert.equal(isPromptRolloutStage(""), false);
});

test("comparePromptRolloutStage orders stages correctly", () => {
  assert.equal(comparePromptRolloutStage("canary_5", "canary_5"), 0);
  assert.ok(comparePromptRolloutStage("canary_5", "canary_20") < 0, "canary_5 < canary_20");
  assert.ok(comparePromptRolloutStage("canary_20", "canary_5") > 0, "canary_20 > canary_5");
  assert.ok(comparePromptRolloutStage("canary_20", "stable") < 0, "canary_20 < stable");
  assert.ok(comparePromptRolloutStage("stable", "canary_5") > 0, "stable > canary_5");
  assert.ok(comparePromptRolloutStage("stable", "rolled_back") < 0, "stable < rolled_back");
  assert.ok(comparePromptRolloutStage("rolled_back", "canary_5") > 0, "rolled_back > canary_5");
});

test("comparePromptRolloutStage is symmetric for same inputs", () => {
  const result1 = comparePromptRolloutStage("canary_5", "stable");
  const result2 = comparePromptRolloutStage("stable", "canary_5");
  assert.equal(result1, -result2);
});

// ============================================================================
// Issue #1963: stable→rolled_back auto advance
// ============================================================================

test("nextPromptRolloutStage returns correct next stage", () => {
  // Issue #1963: nextPromptRolloutStage should NOT auto-advance from stable to rolled_back
  // rolled_back is a terminal state, not part of the progression
  assert.equal(nextPromptRolloutStage("canary_5"), "canary_20", "canary_5 → canary_20");
  assert.equal(nextPromptRolloutStage("canary_20"), "stable", "canary_20 → stable");
  assert.equal(nextPromptRolloutStage("stable"), null, "stable is terminal (no auto-advance)");
  assert.equal(nextPromptRolloutStage("rolled_back"), null, "rolled_back is terminal");
});

test("nextPromptRolloutStage returns null for rolled_back (terminal state)", () => {
  // Issue #1963: rolled_back should not auto-advance
  assert.equal(nextPromptRolloutStage("rolled_back"), null);
});

test("nextPromptRolloutStage returns null for stable (no auto-advance to rolled_back)", () => {
  // Issue #1963: stable should NOT automatically advance to rolled_back
  assert.equal(nextPromptRolloutStage("stable"), null, "stable should not auto-advance");
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
  assert.equal(passesQualityGate("canary_5", 0.03), true, "3% < 5%");
  assert.equal(passesQualityGate("canary_20", 0.01), true, "1% < 3%");
  assert.equal(passesQualityGate("stable", 0.005), true, "0.5% < 1%");
});

test("passesQualityGate returns false when error rate exceeds threshold", () => {
  assert.equal(passesQualityGate("canary_5", 0.06), false, "6% > 5%");
  assert.equal(passesQualityGate("canary_20", 0.04), false, "4% > 3%");
  assert.equal(passesQualityGate("stable", 0.02), false, "2% > 1%");
});

test("passesQualityGate returns true for rolled_back (no threshold)", () => {
  // rolled_back has no quality gate - any error rate passes
  assert.equal(passesQualityGate("rolled_back", 0.99), true);
  assert.equal(passesQualityGate("rolled_back", 1.0), true);
});

test("PromptRolloutStage type allows valid stages only", () => {
  const stage: PromptRolloutStage = "canary_5";
  assert.equal(stage, "canary_5");

  const stable: PromptRolloutStage = "stable";
  assert.equal(stable, "stable");
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
  // Error rate equal to threshold should NOT pass (must be below)
  assert.equal(passesQualityGate("canary_5", 0.05), false, "exact threshold is not below");
  assert.equal(passesQualityGate("canary_5", 0.049), true, "just below threshold passes");
});

test("passesQualityGate boundary for canary_20", () => {
  assert.equal(passesQualityGate("canary_20", 0.03), false, "exact threshold 3% is not below");
  assert.equal(passesQualityGate("canary_20", 0.029), true, "just below 3% passes");
});

test("passesQualityGate boundary for stable", () => {
  assert.equal(passesQualityGate("stable", 0.01), false, "exact threshold 1% is not below");
  assert.equal(passesQualityGate("stable", 0.009), true, "just below 1% passes");
});

test("PROMPT_ROLLOUT_STAGES length is 4", () => {
  assert.equal(PROMPT_ROLLOUT_STAGES.length, 4);
});

test("all stages in PROMPT_ROLLOUT_STAGES are unique", () => {
  const unique = new Set(PROMPT_ROLLOUT_STAGES);
  assert.equal(unique.size, PROMPT_ROLLOUT_STAGES.length);
});

test("comparePromptRolloutStage transitivity", () => {
  // if a < b and b < c, then a < c
  assert.ok(comparePromptRolloutStage("canary_5", "canary_20") < 0);
  assert.ok(comparePromptRolloutStage("canary_20", "stable") < 0);
  assert.ok(comparePromptRolloutStage("canary_5", "stable") < 0);
});

test("passesQualityGate with zero error rate always passes", () => {
  assert.equal(passesQualityGate("canary_5", 0), true);
  assert.equal(passesQualityGate("canary_20", 0), true);
  assert.equal(passesQualityGate("stable", 0), true);
});

test("QUALITY_GATE_THRESHOLDS values are between 0 and 1", () => {
  for (const stage of ["canary_5", "canary_20", "stable"] as const) {
    assert.ok(QUALITY_GATE_THRESHOLDS[stage].maxErrorRate >= 0);
    assert.ok(QUALITY_GATE_THRESHOLDS[stage].maxErrorRate <= 1);
    assert.ok(QUALITY_GATE_THRESHOLDS[stage].minPassthrough >= 0);
    assert.ok(QUALITY_GATE_THRESHOLDS[stage].minPassthrough <= 1);
  }
});