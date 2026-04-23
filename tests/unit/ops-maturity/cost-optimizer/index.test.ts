import assert from "node:assert/strict";
import test from "node:test";

import {
  simulateCostOptimization,
  simulateScenarioSavings,
  type CostSimulationScenario,
} from "../../../../src/ops-maturity/cost-optimizer/simulator/index.js";
import {
  buildCostOptimizationRecommendation,
  prioritizeCostOptimizationRecommendations,
} from "../../../../src/ops-maturity/cost-optimizer/recommendation-engine/index.js";
import {
  aggregateCostAttribution,
} from "../../../../src/ops-maturity/cost-optimizer/attribution-engine/index.js";

test("simulateCostOptimization applies reduction percentage correctly", () => {
  assert.equal(simulateCostOptimization(100, 10), 90);
  assert.equal(simulateCostOptimization(100, 20), 80);
  assert.equal(simulateCostOptimization(200, 50), 100);
  assert.equal(simulateCostOptimization(150.5, 25), 112.88);
});

test("simulateCostOptimization handles 0% reduction", () => {
  assert.equal(simulateCostOptimization(100, 0), 100);
});

test("simulateCostOptimization handles 100% reduction", () => {
  assert.equal(simulateCostOptimization(100, 100), 0);
});

test("simulateCostOptimization rounds to 2 decimal places", () => {
  assert.equal(simulateCostOptimization(33.333, 10), 30);
  assert.equal(simulateCostOptimization(99.999, 33), 67);
});

test("simulateScenarioSavings computes per-scenario savings", () => {
  const scenarios: CostSimulationScenario[] = [
    { scenarioId: "a", baselineCostUsd: 100, reductionPercent: 10 },
    { scenarioId: "b", baselineCostUsd: 200, reductionPercent: 20 },
    { scenarioId: "c", baselineCostUsd: 150, reductionPercent: 50 },
  ];
  const result = simulateScenarioSavings(scenarios);
  assert.equal(result["a"], 10);
  assert.equal(result["b"], 40);
  assert.equal(result["c"], 75);
});

test("simulateScenarioSavings handles empty scenarios", () => {
  const result = simulateScenarioSavings([]);
  assert.deepEqual(result, {});
});

test("simulateScenarioSavings returns 0 savings for 100% reduction", () => {
  const scenarios: CostSimulationScenario[] = [
    { scenarioId: "full_cut", baselineCostUsd: 100, reductionPercent: 100 },
  ];
  const result = simulateScenarioSavings(scenarios);
  assert.equal(result["full_cut"], 100);
});

test("prioritizeCostOptimizationRecommendations sorts by estimatedSavingsUsd descending", () => {
  const recommendations = [
    {
      recommendationId: "rec_a",
      subjectId: "sub_a",
      estimatedSavingsUsd: 5,
      riskLevel: "low" as const,
      action: "increase_cache_hit" as const,
    },
    {
      recommendationId: "rec_c",
      subjectId: "sub_c",
      estimatedSavingsUsd: 100,
      riskLevel: "high" as const,
      action: "downgrade_model" as const,
    },
    {
      recommendationId: "rec_b",
      subjectId: "sub_b",
      estimatedSavingsUsd: 25,
      riskLevel: "medium" as const,
      action: "right_size" as const,
    },
  ];
  const sorted = prioritizeCostOptimizationRecommendations(recommendations);
  assert.equal(sorted[0]!.subjectId, "sub_c");
  assert.equal(sorted[1]!.subjectId, "sub_b");
  assert.equal(sorted[2]!.subjectId, "sub_a");
});

test("prioritizeCostOptimizationRecommendations handles single item", () => {
  const recommendations = [
    {
      recommendationId: "rec_solo",
      subjectId: "sub_solo",
      estimatedSavingsUsd: 42,
      riskLevel: "medium" as const,
      action: "right_size" as const,
    },
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
  const recommendations = [
    {
      recommendationId: "rec_1",
      subjectId: "sub_1",
      estimatedSavingsUsd: 10,
      riskLevel: "low" as const,
      action: "increase_cache_hit" as const,
    },
    {
      recommendationId: "rec_2",
      subjectId: "sub_2",
      estimatedSavingsUsd: 20,
      riskLevel: "medium" as const,
      action: "right_size" as const,
    },
  ];
  const originalFirst = recommendations[0]!.estimatedSavingsUsd;
  prioritizeCostOptimizationRecommendations(recommendations);
  assert.equal(recommendations[0]!.estimatedSavingsUsd, originalFirst);
});

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
  assert.equal(result.action, "increase_cache_hit");
  assert.equal(result.riskLevel, "low");
  assert.equal(result.estimatedSavingsUsd, 1.5);
});

test("buildCostOptimizationRecommendation uses medium risk and right_size for cost > 100", () => {
  const result = buildCostOptimizationRecommendation("subj", 101);
  assert.ok(result != null);
  assert.equal(result.action, "right_size");
  assert.equal(result.riskLevel, "medium");
  assert.equal(result.estimatedSavingsUsd, 15.15);
});

test("aggregateCostAttribution handles fractional amounts", () => {
  const entries = [
    { subjectId: "task_a", amountUsd: 0.1 },
    { subjectId: "task_a", amountUsd: 0.2 },
    { subjectId: "task_a", amountUsd: 0.3 },
  ];
  const result = aggregateCostAttribution(entries);
  assert.equal(result["task_a"], 0.6);
});

test("aggregateCostAttribution handles many entries for same subject", () => {
  const entries = Array.from({ length: 100 }, (_, i) => ({
    subjectId: "task_many",
    amountUsd: 0.01,
  }));
  const result = aggregateCostAttribution(entries);
  assert.equal(result["task_many"], 1);
});

test("aggregateCostAttribution handles large amounts", () => {
  const entries = [
    { subjectId: "big_task", amountUsd: 1_000_000 },
    { subjectId: "big_task", amountUsd: 500_000 },
  ];
  const result = aggregateCostAttribution(entries);
  assert.equal(result["big_task"], 1_500_000);
});
