import assert from "node:assert/strict";
import test from "node:test";
import { aggregateCostAttribution } from "../../../src/ops-maturity/cost-optimizer/attribution-engine/index.js";
import { simulateCostOptimization, simulateScenarioSavings } from "../../../src/ops-maturity/cost-optimizer/simulator/index.js";
import { buildCostOptimizationRecommendation, prioritizeCostOptimizationRecommendations } from "../../../src/ops-maturity/cost-optimizer/recommendation-engine/index.js";

test("cost: aggregate cost attribution single entry", () => {
  const entries = [{ subjectId: "task-001", amountUsd: 10.5 }];
  const result = aggregateCostAttribution(entries);

  assert.strictEqual(result["task-001"], 10.5);
});

test("cost: aggregate cost attribution multiple entries same subject", () => {
  const entries = [
    { subjectId: "task-001", amountUsd: 10 },
    { subjectId: "task-001", amountUsd: 5.5 },
    { subjectId: "task-001", amountUsd: 2.25 },
  ];
  const result = aggregateCostAttribution(entries);

  assert.strictEqual(result["task-001"], 17.75);
});

test("cost: aggregate cost attribution multiple subjects", () => {
  const entries = [
    { subjectId: "task-001", amountUsd: 10 },
    { subjectId: "task-002", amountUsd: 20 },
    { subjectId: "task-003", amountUsd: 15 },
  ];
  const result = aggregateCostAttribution(entries);

  assert.strictEqual(result["task-001"], 10);
  assert.strictEqual(result["task-002"], 20);
  assert.strictEqual(result["task-003"], 15);
});

test("cost: aggregate cost attribution handles floating point precision", () => {
  const entries = [
    { subjectId: "task-fp", amountUsd: 0.1 },
    { subjectId: "task-fp", amountUsd: 0.2 },
  ];
  const result = aggregateCostAttribution(entries);

  assert.strictEqual(result["task-fp"], 0.3);
});

test("cost: simulate cost optimization with 20% reduction", () => {
  const result = simulateCostOptimization(100, 20);

  assert.strictEqual(result, 80);
});

test("cost: simulate cost optimization with 15% reduction", () => {
  const result = simulateCostOptimization(200, 15);

  assert.strictEqual(result, 170);
});

test("cost: simulate cost optimization with 0% reduction", () => {
  const result = simulateCostOptimization(100, 0);

  assert.strictEqual(result, 100);
});

test("cost: simulate cost optimization with 100% reduction", () => {
  const result = simulateCostOptimization(50, 100);

  assert.strictEqual(result, 0);
});

test("cost: simulate scenario savings", () => {
  const scenarios = [
    { scenarioId: "s1", baselineCostUsd: 100, reductionPercent: 20 },
    { scenarioId: "s2", baselineCostUsd: 200, reductionPercent: 10 },
  ];
  const result = simulateScenarioSavings(scenarios);

  assert.strictEqual(result["s1"], 20);
  assert.strictEqual(result["s2"], 20);
});

test("cost: build recommendation returns null for low cost", () => {
  const result = buildCostOptimizationRecommendation("task-low", 5);

  assert.strictEqual(result, null);
});

test("cost: build recommendation for moderate cost", () => {
  const result = buildCostOptimizationRecommendation("task-moderate", 50);

  assert.ok(result != null);
  assert.strictEqual(result.subjectId, "task-moderate");
  assert.strictEqual(result.riskLevel, "low");
  assert.strictEqual(result.action, "increase_cache_hit");
  assert.ok(result.estimatedSavingsUsd > 0);
});

test("cost: build recommendation for high cost", () => {
  const result = buildCostOptimizationRecommendation("task-high", 150);

  assert.ok(result != null);
  assert.strictEqual(result.riskLevel, "medium");
  assert.strictEqual(result.action, "right_size");
  assert.ok(result.estimatedSavingsUsd > 0);
});

test("cost: build recommendation with model ref", () => {
  const result = buildCostOptimizationRecommendation("task-with-model", 200, { modelRef: "anthropic/claude-3-5-sonnet" });

  assert.ok(result != null);
  assert.ok(result.currentModelRef != null);
});

test("cost: prioritize recommendations by savings descending", () => {
  const recs = [
    { recommendationId: "r1", subjectId: "s1", estimatedSavingsUsd: 10, riskLevel: "low", action: "right_size" },
    { recommendationId: "r2", subjectId: "s2", estimatedSavingsUsd: 50, riskLevel: "medium", action: "right_size" },
    { recommendationId: "r3", subjectId: "s3", estimatedSavingsUsd: 30, riskLevel: "high", action: "downgrade_model" },
  ];

  const prioritized = prioritizeCostOptimizationRecommendations(recs);

  assert.strictEqual(prioritized[0].subjectId, "s2");
  assert.strictEqual(prioritized[1].subjectId, "s3");
  assert.strictEqual(prioritized[2].subjectId, "s1");
});

test("cost: prioritize recommendations returns copy not mutate", () => {
  const recs = [
    { recommendationId: "r1", subjectId: "s1", estimatedSavingsUsd: 10, riskLevel: "low", action: "right_size" },
    { recommendationId: "r2", subjectId: "s2", estimatedSavingsUsd: 20, riskLevel: "low", action: "right_size" },
  ];

  const prioritized = prioritizeCostOptimizationRecommendations(recs);

  assert.strictEqual(prioritized[0].estimatedSavingsUsd, 20);
  assert.notStrictEqual(prioritized, recs);
});
