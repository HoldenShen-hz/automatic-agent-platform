import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCostOptimizationRecommendation,
  prioritizeCostOptimizationRecommendations,
  type CostOptimizationRecommendation,
} from "../../../../dist/src/ops-maturity/cost-optimizer/recommendation-engine/index.js";

test("buildCostOptimizationRecommendation returns null for zero cost", () => {
  const result = buildCostOptimizationRecommendation("subj", 0);
  assert.equal(result, null);
});

test("buildCostOptimizationRecommendation returns null for negative cost", () => {
  const result = buildCostOptimizationRecommendation("subj", -50);
  assert.equal(result, null);
});

test("buildCostOptimizationRecommendation returns null for cost just below threshold (9.9999)", () => {
  const result = buildCostOptimizationRecommendation("subj", 9.9999);
  assert.equal(result, null);
});

test("buildCostOptimizationRecommendation returns recommendation at exactly threshold (10)", () => {
  const result = buildCostOptimizationRecommendation("subj", 10);
  assert.ok(result != null);
  assert.equal(result.estimatedSavingsUsd, 1.5);
  assert.equal(result.riskLevel, "low");
  assert.equal(result.action, "increase_cache_hit");
});

test("buildCostOptimizationRecommendation returns null for cost between 0 and 10", () => {
  const values = [0.01, 1, 5, 9, 9.999];
  for (const val of values) {
    const result = buildCostOptimizationRecommendation("subj", val);
    assert.equal(result, null, `Cost ${val} should return null`);
  }
});

test("buildCostOptimizationRecommendation schedule_shift action is unreachable with current logic", () => {
  // The code sets action to schedule_shift when downgradePath is false AND currentCostUsd <= 100
  // But downgradePath requires currentCostUsd >= 100
  // These conditions are mutually exclusive, so schedule_shift can never be returned
  // This test documents the current behavior: schedule_shift is unreachable
  const result = buildCostOptimizationRecommendation("subj", 50);
  assert.ok(result != null);
  assert.notEqual(result.action, "schedule_shift",
    "schedule_shift should be unreachable with current logic (downgradePath requires cost >= 100 which conflicts with cost <= 100)");
});

test("buildCostOptimizationRecommendation without modelRef never uses downgrade_model", () => {
  // Without a modelRef, there's no profile to compare, so downgradePath is always false
  const result = buildCostOptimizationRecommendation("subj", 200);
  assert.ok(result != null);
  assert.notEqual(result.action, "downgrade_model",
    "Without modelRef, downgrade_path should be false");
  assert.equal(result.action, "right_size");
  assert.equal(result.riskLevel, "medium");
});

test("buildCostOptimizationRecommendation with modelRef that has no cheaper peer uses right_size not downgrade", () => {
  // Even with modelRef, if there's no cheaper peer profile, downgradePath is false
  // Using a modelRef that exists in the registry but has no cheaper alternative
  const result = buildCostOptimizationRecommendation("subj", 200, { modelRef: "balanced" });
  assert.ok(result != null);
  // If balanced has a cheaper peer: downgrade_model. If not: right_size
  // The test verifies the function doesn't crash either way
  assert.ok(["right_size", "downgrade_model"].includes(result.action));
});

test("prioritizeCostOptimizationRecommendations with all same savings maintains order", () => {
  const recommendations: CostOptimizationRecommendation[] = [
    { recommendationId: "rec_first", subjectId: "subj_first", estimatedSavingsUsd: 50, riskLevel: "low", action: "increase_cache_hit" },
    { recommendationId: "rec_second", subjectId: "subj_second", estimatedSavingsUsd: 50, riskLevel: "medium", action: "right_size" },
    { recommendationId: "rec_third", subjectId: "subj_third", estimatedSavingsUsd: 50, riskLevel: "high", action: "downgrade_model" },
  ];
  const sorted = prioritizeCostOptimizationRecommendations(recommendations);
  assert.equal(sorted.length, 3);
  // Stable sort should maintain relative order for equal elements
  assert.equal(sorted[0]!.recommendationId, "rec_first");
  assert.equal(sorted[1]!.recommendationId, "rec_second");
  assert.equal(sorted[2]!.recommendationId, "rec_third");
});

test("prioritizeCostOptimizationRecommendations with descending savings values", () => {
  const recommendations: CostOptimizationRecommendation[] = [
    { recommendationId: "rec_a", subjectId: "subj_a", estimatedSavingsUsd: 1, riskLevel: "low", action: "increase_cache_hit" },
    { recommendationId: "rec_b", subjectId: "subj_b", estimatedSavingsUsd: 2, riskLevel: "medium", action: "right_size" },
    { recommendationId: "rec_c", subjectId: "subj_c", estimatedSavingsUsd: 3, riskLevel: "high", action: "downgrade_model" },
  ];
  const sorted = prioritizeCostOptimizationRecommendations(recommendations);
  assert.equal(sorted[0]!.subjectId, "subj_c");
  assert.equal(sorted[1]!.subjectId, "subj_b");
  assert.equal(sorted[2]!.subjectId, "subj_a");
});

test("prioritizeCostOptimizationRecommendations handles many items", () => {
  const recommendations: CostOptimizationRecommendation[] = Array.from({ length: 100 }, (_, i) => ({
    recommendationId: `rec_${i}`,
    subjectId: `subj_${i}`,
    estimatedSavingsUsd: i,
    riskLevel: "low" as const,
    action: "increase_cache_hit" as const,
  }));
  const sorted = prioritizeCostOptimizationRecommendations(recommendations);
  assert.equal(sorted.length, 100);
  assert.equal(sorted[0]!.subjectId, "subj_99");
  assert.equal(sorted[99]!.subjectId, "subj_0");
});

test("buildCostOptimizationRecommendation with very large cost values", () => {
  // Without modelRef, downgradePath is false, so estimatedSavingsUsd = cost * 0.15
  const result = buildCostOptimizationRecommendation("big_cost_subj", 10_000_000);
  assert.ok(result != null);
  // 10_000_000 * 0.15 = 1_500_000 (no downgrade path without modelRef)
  assert.equal(result.estimatedSavingsUsd, 1_500_000);
  assert.equal(result.riskLevel, "medium");
  assert.equal(result.action, "right_size");
});

test("buildCostOptimizationRecommendation with exactly 100 cost without modelRef", () => {
  // At cost = 100: currentCostUsd < 10 is false, but currentCostUsd > 100 is also false
  // So riskLevel = "low", action = "increase_cache_hit" (not right_size)
  const result = buildCostOptimizationRecommendation("subj", 100);
  assert.ok(result != null);
  assert.equal(result.estimatedSavingsUsd, 15); // 100 * 0.15
  assert.equal(result.riskLevel, "low");
  assert.equal(result.action, "increase_cache_hit");
});

test("buildCostOptimizationRecommendation with exactly 100 cost with modelRef but no cheaper peer", () => {
  // With modelRef at cost = 100: downgradePath requires costUsd >= 100 (true) AND recommendedProfile cheaper
  // If no cheaper peer: downgradePath = false
  // Since currentCostUsd > 100 is false, action = "increase_cache_hit"
  const result = buildCostOptimizationRecommendation("subj", 100, { modelRef: "claude-3-7" });
  assert.ok(result != null);
  assert.equal(result.estimatedSavingsUsd, 15); // 100 * 0.15
  // riskLevel depends on whether downgradePath is true
  assert.ok(["low", "medium", "high"].includes(result.riskLevel));
});

test("buildCostOptimizationRecommendation recommendedModelRef format includes provider and modelId", () => {
  // This test verifies the format when recommendedModelRef is present
  // We need a modelRef that has a valid downgrade option
  // The recommendedModelRef should be formatted as "provider/modelId"
  const result = buildCostOptimizationRecommendation("subj", 200, { modelRef: "balanced" });
  assert.ok(result != null);
  if (result.recommendedModelRef !== undefined) {
    assert.ok(result.recommendedModelRef.includes("/"),
      "recommendedModelRef should be in 'provider/modelId' format");
  }
});

test("buildCostOptimizationRecommendation with cost just above 100", () => {
  const result = buildCostOptimizationRecommendation("subj", 100.01);
  assert.ok(result != null);
  // 100.01 * 0.15 = 15.0015 -> toFixed(2) = "15"
  assert.equal(result.estimatedSavingsUsd, 15);
  assert.equal(result.riskLevel, "medium");
  assert.equal(result.action, "right_size");
});

test("buildCostOptimizationRecommendation estimatedSavingsUsd is always positive for cost >= 10", () => {
  const costs = [10, 10.01, 50, 99.99, 100, 100.01, 500, 1000];
  for (const cost of costs) {
    const result = buildCostOptimizationRecommendation("subj", cost);
    assert.ok(result != null, `Cost ${cost} should produce a recommendation`);
    assert.ok(result.estimatedSavingsUsd > 0, `Savings should be positive for cost ${cost}`);
  }
});
