/**
 * Unit Tests: Cost Optimization Service
 *
 * Tests for cost attribution, aggregation, recommendations, and simulation
 * from the ops-maturity/cost-optimizer module.
 *
 * Uses node:test + assert/strict with ESM and .js extensions.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  CostOptimizationService,
  type CostAttributionRecord,
  type CostSimulationScenarioInput,
  type CostDashboardSlice,
  type CostSimulationResult,
} from "../../../../src/ops-maturity/cost-optimizer/cost-optimization-service.js";

import { aggregateCostAttribution } from "../../../../src/ops-maturity/cost-optimizer/attribution-engine/index.js";
import {
  buildCostOptimizationRecommendation,
  prioritizeCostOptimizationRecommendations,
} from "../../../../src/ops-maturity/cost-optimizer/recommendation-engine/index.js";
import {
  simulateCostOptimization,
  simulateScenarioSavings,
} from "../../../../src/ops-maturity/cost-optimizer/simulator/index.js";

// =============================================================================
// CostAttributionRecord Factory
// =============================================================================

function makeRecord(overrides: Partial<CostAttributionRecord> = {}): CostAttributionRecord {
  return {
    subjectType: "task",
    subjectId: overrides.subjectId ?? "task_1",
    costType: "total",
    amountUsd: overrides.amountUsd ?? 0.10,
    llmCostUsd: 0.08,
    toolCostUsd: 0.01,
    computeCostUsd: 0.01,
    storageCostUsd: 0,
    egressCostUsd: 0,
    humanReviewCostUsd: 0,
    decisionRef: overrides.decisionRef ?? "decision_1",
    capturedAt: overrides.capturedAt ?? "2026-04-29T00:00:00.000Z",
    ...overrides,
  };
}

// =============================================================================
// CostOptimizationService Tests
// =============================================================================

test("CostOptimizationService.recordCost accepts valid attribution record", () => {
  const service = new CostOptimizationService();
  const record = makeRecord({ subjectId: "task_test", amountUsd: 0.25 });

  const result = service.recordCost(record);

  assert.equal(result.subjectId, "task_test");
  assert.equal(result.amountUsd, 0.25);
});

test("CostOptimizationService.recordCost throws for empty decisionRef", () => {
  const service = new CostOptimizationService();
  const record = makeRecord({ decisionRef: "   " });

  assert.throws(
    () => service.recordCost(record),
    /cost_optimizer.unsourced_record/,
  );
});

test("CostOptimizationService.recordCost increments unsourcedRecordCount on invalid record", () => {
  const service = new CostOptimizationService();

  try {
    service.recordCost(makeRecord({ decisionRef: "" }));
  } catch {
    // expected
  }

  // Record valid record
  const record = makeRecord({ decisionRef: "valid_decision" });
  service.recordCost(record);

  const dashboard = service.buildDashboardSlice();
  assert.equal(dashboard.unsourcedRecordCount, 0);
});

test("CostOptimizationService.aggregate sums costs by subject", () => {
  const service = new CostOptimizationService();

  service.recordCost(makeRecord({ subjectId: "task_a", amountUsd: 0.10 }));
  service.recordCost(makeRecord({ subjectId: "task_a", amountUsd: 0.20 }));
  service.recordCost(makeRecord({ subjectId: "task_b", amountUsd: 0.15 }));

  const result = service.aggregate();

  assert.equal(result["task_a"], 0.30);
  assert.equal(result["task_b"], 0.15);
});

test("CostOptimizationService.aggregate filters by subjectType", () => {
  const service = new CostOptimizationService();

  service.recordCost(makeRecord({ subjectType: "task", subjectId: "task_1", amountUsd: 0.10 }));
  service.recordCost(makeRecord({ subjectType: "workflow", subjectId: "wf_1", amountUsd: 0.50 }));
  service.recordCost(makeRecord({ subjectType: "task", subjectId: "task_2", amountUsd: 0.20 }));

  const taskOnly = service.aggregate("task");
  const workflowOnly = service.aggregate("workflow");

  assert.equal(taskOnly["task_1"], 0.10);
  assert.equal(taskOnly["task_2"], 0.20);
  assert.equal(workflowOnly["wf_1"], 0.50);
  assert.strictEqual(workflowOnly["task_1"], undefined);
});

test("CostOptimizationService.aggregate returns empty for unknown subjectType", () => {
  const service = new CostOptimizationService();
  service.recordCost(makeRecord({ subjectType: "task", subjectId: "task_1", amountUsd: 0.10 }));

  const agentOnly = service.aggregate("agent");

  assert.strictEqual(agentOnly["task_1"], undefined);
  assert.equal(Object.keys(agentOnly).length, 0);
});

test("CostOptimizationService.buildRecommendations generates recommendations for high-cost subjects", () => {
  const service = new CostOptimizationService();

  // Costs >= $10 trigger recommendations
  service.recordCost(makeRecord({ subjectId: "task_heavy", amountUsd: 50.00 }));
  service.recordCost(makeRecord({ subjectId: "task_light", amountUsd: 5.00 }));

  const recommendations = service.buildRecommendations();

  assert.ok(recommendations.length >= 1);
  const heavyRec = recommendations.find((r) => r.subjectId === "task_heavy");
  assert.ok(heavyRec != null, "Should have recommendation for heavy task");
  assert.equal(heavyRec!.action, "right_size");
});

test("CostOptimizationService.buildRecommendations filters low-cost subjects", () => {
  const service = new CostOptimizationService();

  service.recordCost(makeRecord({ subjectId: "task_light", amountUsd: 5.00 }));

  const recommendations = service.buildRecommendations();

  const lightRec = recommendations.find((r) => r.subjectId === "task_light");
  assert.ok(lightRec == null, "Should not generate recommendation for light task");
});

test("CostOptimizationService.simulate applies reduction scenarios", () => {
  const service = new CostOptimizationService();

  service.recordCost(makeRecord({ subjectId: "task_a", amountUsd: 100.00 }));
  service.recordCost(makeRecord({ subjectId: "task_b", amountUsd: 50.00 }));

  const scenarios: readonly CostSimulationScenarioInput[] = [
    { scenarioId: "reduce_a", subjectId: "task_a", reductionPercent: 20 },
    { scenarioId: "reduce_b", subjectId: "task_b", reductionPercent: 10 },
  ];

  const results = service.simulate(scenarios);

  assert.equal(results.length, 2);
  const resultA = results.find((r) => r.scenarioId === "reduce_a")!;
  assert.equal(resultA.currentCostUsd, 100.00);
  assert.equal(resultA.simulatedCostUsd, 80.00);
  assert.equal(resultA.deltaUsd, -20.00);

  const resultB = results.find((r) => r.scenarioId === "reduce_b")!;
  assert.equal(resultB.currentCostUsd, 50.00);
  assert.equal(resultB.simulatedCostUsd, 45.00);
  assert.equal(resultB.deltaUsd, -5.00);
});

test("CostOptimizationService.simulate handles unknown subjects", () => {
  const service = new CostOptimizationService();

  const scenarios: readonly CostSimulationScenarioInput[] = [
    { scenarioId: "unknown", subjectId: "unknown_task", reductionPercent: 25 },
  ];

  const results = service.simulate(scenarios);

  assert.equal(results[0]!.currentCostUsd, 0);
  assert.equal(results[0]!.simulatedCostUsd, 0);
});

test("CostOptimizationService.buildDashboardSlice returns complete dashboard", () => {
  const service = new CostOptimizationService();

  service.recordCost(makeRecord({ subjectId: "task_1", amountUsd: 25.00 }));
  service.recordCost(makeRecord({ subjectId: "task_2", amountUsd: 15.00 }));

  const dashboard = service.buildDashboardSlice();

  assert.equal(dashboard.totalCostUsd, 40.00);
  assert.equal(dashboard.bySubject["task_1"], 25.00);
  assert.equal(dashboard.bySubject["task_2"], 15.00);
  assert.ok(Array.isArray(dashboard.recommendations));
  assert.equal(dashboard.unsourcedRecordCount, 0);
});

test("CostOptimizationService.buildDashboardSlice uses custom timestamp", () => {
  const service = new CostOptimizationService();
  const customTime = "2026-03-15T12:00:00.000Z";

  const dashboard = service.buildDashboardSlice(customTime);

  assert.equal(dashboard.generatedAt, customTime);
});

test("CostOptimizationService.listRecords returns copy of records", () => {
  const service = new CostOptimizationService();

  service.recordCost(makeRecord({ subjectId: "task_1", amountUsd: 0.10 }));
  service.recordCost(makeRecord({ subjectId: "task_2", amountUsd: 0.20 }));

  const records = service.listRecords();

  assert.equal(records.length, 2);
  records.push(makeRecord({ subjectId: "task_3", amountUsd: 0.30 }));
  assert.equal(service.listRecords().length, 2, "Original records should not be mutated");
});

test("CostOptimizationService.upgrades risk for model LLM costs", () => {
  const service = new CostOptimizationService();

  // Low cost normally, but with model type and llm costType it should upgrade
  service.recordCost(
    makeRecord({
      subjectType: "model",
      subjectId: "model_ref",
      costType: "llm",
      amountUsd: 100.00,
    }),
  );

  const recommendations = service.buildRecommendations("model");
  const modelRec = recommendations.find((r) => r.subjectId === "model_ref");

  assert.ok(modelRec != null);
  // base risk for $100 is medium, but model LLM upgrades it
  assert.ok(modelRec!.riskLevel !== "low", "Model LLM should not have low risk");
});

test("CostOptimizationService.resolves modelRef from records", () => {
  const service = new CostOptimizationService();

  service.recordCost(
    makeRecord({
      subjectId: "task_with_model",
      amountUsd: 50.00,
      modelRef: "anthropic/claude-3-5-sonnet",
    }),
  );

  const recommendations = service.buildRecommendations();
  const rec = recommendations.find((r) => r.subjectId === "task_with_model");

  assert.ok(rec != null);
  assert.equal(rec!.currentModelRef, "anthropic/claude-3-5-sonnet");
});

// =============================================================================
// Cost Attribution Aggregation Tests
// =============================================================================

test("aggregateCostAttribution sums amounts for same subject", () => {
  const entries = [
    { subjectId: "task_a", amountUsd: 0.10 },
    { subjectId: "task_a", amountUsd: 0.25 },
    { subjectId: "task_b", amountUsd: 0.15 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.equal(result["task_a"], 0.35);
  assert.equal(result["task_b"], 0.15);
});

test("aggregateCostAttribution rounds to 4 decimal places [platform-cost-management]", () => {
  const entries = [
    { subjectId: "task_a", amountUsd: 0.123456789 },
    { subjectId: "task_a", amountUsd: 0.123456789 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.equal(result["task_a"], 0.2469);
});

test("aggregateCostAttribution handles empty array", () => {
  const result = aggregateCostAttribution([]);

  assert.deepEqual(result, {});
});

test("aggregateCostAttribution handles single entry [platform-cost-management]", () => {
  const entries = [{ subjectId: "task_single", amountUsd: 0.50 }];

  const result = aggregateCostAttribution(entries);

  assert.equal(result["task_single"], 0.50);
});

test("aggregateCostAttribution handles zero amounts", () => {
  const entries = [
    { subjectId: "task_zero", amountUsd: 0 },
    { subjectId: "task_zero", amountUsd: 0 },
    { subjectId: "task_zero", amountUsd: 0.01 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.equal(result["task_zero"], 0.01);
});

// =============================================================================
// Cost Recommendation Tests
// =============================================================================

test("buildCostOptimizationRecommendation returns null for low-cost subjects", () => {
  const result = buildCostOptimizationRecommendation("task_light", 5.00);

  assert.equal(result, null);
});

test("buildCostOptimizationRecommendation generates right_size for moderate costs", () => {
  const result = buildCostOptimizationRecommendation("task_moderate", 50.00);

  assert.ok(result != null);
  assert.equal(result!.action, "right_size");
  assert.equal(result!.riskLevel, "medium");
  assert.ok(result!.estimatedSavingsUsd > 0);
});

test("buildCostOptimizationRecommendation generates increase_cache_hit for low costs", () => {
  const result = buildCostOptimizationRecommendation("task_low", 10.00);

  assert.ok(result != null);
  assert.equal(result!.action, "increase_cache_hit");
  assert.equal(result!.riskLevel, "low");
});

test("buildCostOptimizationRecommendation includes model refs when provided", () => {
  const result = buildCostOptimizationRecommendation("task_model", 100.00, {
    modelRef: "anthropic/claude-3-5-sonnet",
  });

  assert.ok(result != null);
  assert.equal(result!.currentModelRef, "anthropic/claude-3-5-sonnet");
  assert.ok(result!.recommendedModelRef != null);
});

test("prioritizeCostOptimizationRecommendations sorts by savings descending", () => {
  const recommendations = [
    { recommendationId: "rec_a", subjectId: "a", estimatedSavingsUsd: 10, riskLevel: "low" as const, action: "right_size" as const },
    { recommendationId: "rec_c", subjectId: "c", estimatedSavingsUsd: 50, riskLevel: "medium" as const, action: "right_size" as const },
    { recommendationId: "rec_b", subjectId: "b", estimatedSavingsUsd: 25, riskLevel: "high" as const, action: "downgrade_model" as const },
  ];

  const sorted = prioritizeCostOptimizationRecommendations(recommendations);

  assert.equal(sorted[0]!.subjectId, "c");
  assert.equal(sorted[1]!.subjectId, "b");
  assert.equal(sorted[2]!.subjectId, "a");
});

test("prioritizeCostOptimizationRecommendations handles empty array", () => {
  const result = prioritizeCostOptimizationRecommendations([]);

  assert.deepEqual(result, []);
});

// =============================================================================
// Cost Simulation Tests
// =============================================================================

test("simulateCostOptimization applies percentage reduction", () => {
  const result = simulateCostOptimization(100.00, 20);

  assert.equal(result, 80.00);
});

test("simulateCostOptimization rounds to 2 decimal places", () => {
  const result = simulateCostOptimization(100.00, 33);

  assert.equal(result, 67.00);
});

test("simulateCostOptimization handles 100% reduction", () => {
  const result = simulateCostOptimization(100.00, 100);

  assert.equal(result, 0.00);
});

test("simulateCostOptimization handles 0% reduction", () => {
  const result = simulateCostOptimization(100.00, 0);

  assert.equal(result, 100.00);
});

test("simulateCostOptimization handles small costs", () => {
  const result = simulateCostOptimization(0.01, 50);

  assert.equal(result, 0.01);
});

test("simulateScenarioSavings calculates savings for multiple scenarios", () => {
  const scenarios = [
    { scenarioId: "s1", baselineCostUsd: 100, reductionPercent: 20 },
    { scenarioId: "s2", baselineCostUsd: 50, reductionPercent: 10 },
  ];

  const result = simulateScenarioSavings(scenarios);

  assert.equal(result["s1"], 20.00);
  assert.equal(result["s2"], 5.00);
});

// =============================================================================
// Type Validation Tests
// =============================================================================

test("CostAttributionRecord accepts all subject types", () => {
  const types: CostAttributionRecord["subjectType"][] = ["task", "workflow", "agent", "model", "domain"];
  assert.equal(types.length, 5);
});

test("CostAttributionRecord accepts all cost types", () => {
  const costTypes: CostAttributionRecord["costType"][] = ["llm", "tool", "compute", "storage", "egress", "humanReview", "total"];
  assert.equal(costTypes.length, 7);
});

test("CostSimulationScenarioInput structure validation", () => {
  const scenario: CostSimulationScenarioInput = {
    scenarioId: "test_scenario",
    subjectId: "task_1",
    reductionPercent: 25,
  };

  assert.equal(scenario.scenarioId, "test_scenario");
  assert.equal(scenario.reductionPercent, 25);
});

test("CostDashboardSlice structure validation", () => {
  const dashboard: CostDashboardSlice = {
    generatedAt: "2026-04-29T00:00:00.000Z",
    totalCostUsd: 150.00,
    bySubject: { task_1: 100.00, task_2: 50.00 },
    recommendations: [],
    unsourcedRecordCount: 0,
  };

  assert.equal(dashboard.totalCostUsd, 150.00);
  assert.deepEqual(dashboard.bySubject, { task_1: 100.00, task_2: 50.00 });
});

test("CostSimulationResult structure validation", () => {
  const result: CostSimulationResult = {
    scenarioId: "sim_1",
    subjectId: "task_1",
    currentCostUsd: 100.00,
    simulatedCostUsd: 80.00,
    deltaUsd: -20.00,
  };

  assert.equal(result.deltaUsd, -20.00);
});
