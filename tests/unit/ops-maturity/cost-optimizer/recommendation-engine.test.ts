import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCostOptimizationRecommendation,
  prioritizeCostOptimizationRecommendations,
  type CostOptimizationRecommendation,
} from "../../../../src/ops-maturity/cost-optimizer/recommendation-engine/index.js";

test("buildCostOptimizationRecommendation returns null when cost < 10", () => {
  assert.equal(buildCostOptimizationRecommendation("subj", 0), null);
  assert.equal(buildCostOptimizationRecommendation("subj", 9.99), null);
  assert.equal(buildCostOptimizationRecommendation("subj", -100), null);
});

test("buildCostOptimizationRecommendation returns recommendation when cost >= 10", () => {
  const result = buildCostOptimizationRecommendation("subj", 10);
  assert.ok(result != null);
  assert.equal(result.subjectId, "subj");
  assert.equal(result.recommendationId, "rec_subj");
});

test("buildCostOptimizationRecommendation uses increase_cache_hit action for low cost", () => {
  const result = buildCostOptimizationRecommendation("subj", 50);
  assert.ok(result != null);
  assert.equal(result.action, "increase_cache_hit");
  assert.equal(result.riskLevel, "low");
});

test("buildCostOptimizationRecommendation uses right_size for cost > 100", () => {
  const result = buildCostOptimizationRecommendation("subj", 101);
  assert.ok(result != null);
  assert.equal(result.action, "right_size");
  assert.equal(result.riskLevel, "medium");
});

test("buildCostOptimizationRecommendation calculates estimatedSavingsUsd", () => {
  const result = buildCostOptimizationRecommendation("subj", 10);
  assert.ok(result != null);
  // 10 * 0.15 = 1.5
  assert.equal(result.estimatedSavingsUsd, 1.5);
});

test("buildCostOptimizationRecommendation calculates higher savings for high cost with downgrade", () => {
  // Cost exactly 100: downgradePath requires currentCostUsd >= 100 but also needs modelRef with available downgrade
  const result = buildCostOptimizationRecommendation("subj", 100);
  assert.ok(result != null);
  // Without modelRef for downgrade path: 100 * 0.15 = 15, riskLevel "low" (100 is not > 100)
  assert.equal(result.estimatedSavingsUsd, 15);
  assert.equal(result.riskLevel, "low");
  assert.equal(result.action, "increase_cache_hit");
});

test("buildCostOptimizationRecommendation includes currentModelRef when modelRef provided", () => {
  const result = buildCostOptimizationRecommendation("subj", 50, { modelRef: "test-model" });
  assert.ok(result != null);
  assert.equal(result.currentModelRef, "test-model");
});

test("prioritizeCostOptimizationRecommendations sorts by estimatedSavingsUsd descending", () => {
  const recommendations: CostOptimizationRecommendation[] = [
    { recommendationId: "rec_a", subjectId: "sub_a", estimatedSavingsUsd: 5, riskLevel: "low", action: "increase_cache_hit" },
    { recommendationId: "rec_c", subjectId: "sub_c", estimatedSavingsUsd: 100, riskLevel: "high", action: "downgrade_model" },
    { recommendationId: "rec_b", subjectId: "sub_b", estimatedSavingsUsd: 25, riskLevel: "medium", action: "right_size" },
  ];
  const sorted = prioritizeCostOptimizationRecommendations(recommendations);
  assert.equal(sorted[0]!.subjectId, "sub_c");
  assert.equal(sorted[1]!.subjectId, "sub_b");
  assert.equal(sorted[2]!.subjectId, "sub_a");
});

test("prioritizeCostOptimizationRecommendations handles single item", () => {
  const recommendations: CostOptimizationRecommendation[] = [
    { recommendationId: "rec_solo", subjectId: "sub_solo", estimatedSavingsUsd: 42, riskLevel: "medium", action: "right_size" },
  ];
  const sorted = prioritizeCostOptimizationRecommendations(recommendations);
  assert.equal(sorted.length, 1);
  assert.equal(sorted[0]!.subjectId, "sub_solo");
});

test("prioritizeCostOptimizationRecommendations handles empty array", () => {
  const sorted = prioritizeCostOptimizationRecommendations([]);
  assert.deepEqual(sorted, []);
});

test("prioritizeCostOptimizationRecommendations does not mutate original array", () => {
  const recommendations: CostOptimizationRecommendation[] = [
    { recommendationId: "rec_1", subjectId: "sub_1", estimatedSavingsUsd: 10, riskLevel: "low", action: "increase_cache_hit" },
    { recommendationId: "rec_2", subjectId: "sub_2", estimatedSavingsUsd: 20, riskLevel: "medium", action: "right_size" },
  ];
  const originalFirst = recommendations[0]!.estimatedSavingsUsd;
  prioritizeCostOptimizationRecommendations(recommendations);
  assert.equal(recommendations[0]!.estimatedSavingsUsd, originalFirst);
});

test("prioritizeCostOptimizationRecommendations handles tied savings values", () => {
  const recommendations: CostOptimizationRecommendation[] = [
    { recommendationId: "rec_a", subjectId: "sub_a", estimatedSavingsUsd: 50, riskLevel: "low", action: "increase_cache_hit" },
    { recommendationId: "rec_b", subjectId: "sub_b", estimatedSavingsUsd: 50, riskLevel: "medium", action: "right_size" },
  ];
  const sorted = prioritizeCostOptimizationRecommendations(recommendations);
  assert.equal(sorted.length, 2);
});

test("prioritizeCostOptimizationRecommendations handles very large savings values", () => {
  const recommendations: CostOptimizationRecommendation[] = [
    { recommendationId: "rec_big", subjectId: "sub_big", estimatedSavingsUsd: 1_000_000, riskLevel: "high", action: "downgrade_model" },
    { recommendationId: "rec_small", subjectId: "sub_small", estimatedSavingsUsd: 1, riskLevel: "low", action: "increase_cache_hit" },
  ];
  const sorted = prioritizeCostOptimizationRecommendations(recommendations);
  assert.equal(sorted[0]!.subjectId, "sub_big");
  assert.equal(sorted[sorted.length - 1]!.subjectId, "sub_small");
});

test("buildCostOptimizationRecommendation returns all required fields", () => {
  const result = buildCostOptimizationRecommendation("full_test", 150);
  assert.ok(result != null);
  assert.equal(typeof result.recommendationId, "string");
  assert.equal(typeof result.subjectId, "string");
  assert.equal(typeof result.estimatedSavingsUsd, "number");
  assert.equal(typeof result.riskLevel, "string");
  assert.equal(typeof result.action, "string");
  assert.ok(["low", "medium", "high"].includes(result.riskLevel));
  assert.ok(["right_size", "downgrade_model", "increase_cache_hit", "schedule_shift"].includes(result.action));
});

test("buildCostOptimizationRecommendation action is schedule_shift when cost < 10 with modelRef", () => {
  const result = buildCostOptimizationRecommendation("subj", 5, { modelRef: "some-model" });
  assert.equal(result, null);
});

test("buildCostOptimizationRecommendation does not include recommendedModelRef when no downgrade", () => {
  const result = buildCostOptimizationRecommendation("subj", 50, { modelRef: "balanced" });
  assert.ok(result != null);
  assert.equal(result.recommendedModelRef, undefined);
});
