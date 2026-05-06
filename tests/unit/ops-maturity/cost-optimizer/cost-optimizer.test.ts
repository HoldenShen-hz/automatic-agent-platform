import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateCostAttribution,
  buildCostOptimizationRecommendation,
  CostOptimizationService,
  type CostAttributionRecord,
  type CostSubjectType,
} from "../../../../src/ops-maturity/cost-optimizer/index.js";

function makeCostRecord(overrides: Partial<CostAttributionRecord> & {
  subjectType: CostSubjectType;
  subjectId: string;
  costType: CostAttributionRecord["costType"];
  amountUsd: number;
  decisionRef: string;
  capturedAt: string;
}): CostAttributionRecord {
  return {
    costType: "llm",
    llmCostUsd: 0,
    toolCostUsd: 0,
    computeCostUsd: 0,
    storageCostUsd: 0,
    egressCostUsd: 0,
    humanReviewCostUsd: 0,
    ...overrides,
  };
}

// Test: Optimizer calculates optimal resource allocation
test("optimizer calculates optimal resource allocation - single subject aggregation", () => {
  const service = new CostOptimizationService();
  service.recordCost(makeCostRecord({
    subjectType: "task",
    subjectId: "task-res-001",
    costType: "llm",
    amountUsd: 50,
    decisionRef: "dec-llm-1",
    capturedAt: "2026-04-21T00:00:00.000Z",
  }));
  service.recordCost(makeCostRecord({
    subjectType: "task",
    subjectId: "task-res-001",
    costType: "tool",
    amountUsd: 30,
    decisionRef: "dec-tool-1",
    capturedAt: "2026-04-21T00:01:00.000Z",
  }));

  const aggregated = service.aggregate();
  assert.strictEqual(aggregated["task-res-001"], 80);
});

test("optimizer calculates optimal resource allocation - multiple subjects with filtering", () => {
  const service = new CostOptimizationService();
  service.recordCost(makeCostRecord({
    subjectType: "agent",
    subjectId: "agent-alpha",
    costType: "compute",
    amountUsd: 100,
    decisionRef: "dec-comp-1",
    capturedAt: "2026-04-21T00:00:00.000Z",
  }));
  service.recordCost(makeCostRecord({
    subjectType: "model",
    subjectId: "model-beta",
    costType: "llm",
    amountUsd: 250,
    decisionRef: "dec-llm-1",
    capturedAt: "2026-04-21T00:01:00.000Z",
  }));
  service.recordCost(makeCostRecord({
    subjectType: "agent",
    subjectId: "agent-alpha",
    costType: "storage",
    amountUsd: 20,
    decisionRef: "dec-store-1",
    capturedAt: "2026-04-21T00:02:00.000Z",
  }));

  const agentOnly = service.aggregate("agent");
  assert.strictEqual(agentOnly["agent-alpha"], 120);
  assert.strictEqual(agentOnly["model-beta"], undefined);

  const modelOnly = service.aggregate("model");
  assert.strictEqual(modelOnly["model-beta"], 250);
  assert.strictEqual(modelOnly["agent-alpha"], undefined);
});

test("optimizer calculates optimal resource allocation - aggregateCostAttribution utility", () => {
  const entries = [
    { subjectId: "workflow-a", amountUsd: 45.5 },
    { subjectId: "workflow-a", amountUsd: 12.3 },
    { subjectId: "workflow-b", amountUsd: 100 },
  ];
  const result = aggregateCostAttribution(entries);
  assert.strictEqual(result["workflow-a"], 57.8);
  assert.strictEqual(result["workflow-b"], 100);
});

// Test: Cost thresholds are respected
test("cost thresholds - recommendations not generated below threshold", () => {
  const result = buildCostOptimizationRecommendation("cheap-subject", 5);
  assert.strictEqual(result, null);
});

test("cost thresholds - recommendations generated at threshold", () => {
  const result = buildCostOptimizationRecommendation("threshold-subject", 10);
  assert.ok(result != null);
  assert.strictEqual(result.subjectId, "threshold-subject");
  assert.strictEqual(result.estimatedSavingsUsd, 1.5);
});

test("cost thresholds - low risk for costs under 100", () => {
  const result = buildCostOptimizationRecommendation("moderate-subject", 50);
  assert.ok(result != null);
  assert.strictEqual(result.riskLevel, "low");
  assert.strictEqual(result.action, "increase_cache_hit");
});

test("cost thresholds - medium risk for costs over 100", () => {
  const result = buildCostOptimizationRecommendation("expensive-subject", 150);
  assert.ok(result != null);
  assert.strictEqual(result.riskLevel, "medium");
  assert.strictEqual(result.action, "right_size");
});

test("cost thresholds - service respects threshold for recommendations", () => {
  const service = new CostOptimizationService();
  service.recordCost(makeCostRecord({
    subjectType: "workflow",
    subjectId: "cheap-workflow",
    costType: "tool",
    amountUsd: 5,
    decisionRef: "dec-cheap",
    capturedAt: "2026-04-21T00:00:00.000Z",
  }));
  service.recordCost(makeCostRecord({
    subjectType: "workflow",
    subjectId: "normal-workflow",
    costType: "llm",
    amountUsd: 75,
    decisionRef: "dec-normal",
    capturedAt: "2026-04-21T00:01:00.000Z",
  }));

  const recommendations = service.buildRecommendations();
  assert.strictEqual(recommendations.length, 1);
  assert.strictEqual(recommendations[0]!.subjectId, "normal-workflow");
});

// Test: Budget is not exceeded
test("budget - dashboard slice total does not exceed sum of records", () => {
  const service = new CostOptimizationService();
  service.recordCost(makeCostRecord({
    subjectType: "task",
    subjectId: "task-budget-1",
    costType: "llm",
    amountUsd: 50.25,
    decisionRef: "dec-b1",
    capturedAt: "2026-04-21T00:00:00.000Z",
  }));
  service.recordCost(makeCostRecord({
    subjectType: "task",
    subjectId: "task-budget-2",
    costType: "compute",
    amountUsd: 30.75,
    decisionRef: "dec-b2",
    capturedAt: "2026-04-21T00:01:00.000Z",
  }));

  const slice = service.buildDashboardSlice();
  const expectedTotal = 50.25 + 30.75;
  assert.strictEqual(slice.totalCostUsd, expectedTotal);
});

test("budget - simulation shows cost reduction without negative values", () => {
  const service = new CostOptimizationService();
  service.recordCost(makeCostRecord({
    subjectType: "domain",
    subjectId: "domain-budget",
    costType: "llm",
    amountUsd: 200,
    decisionRef: "dec-dom",
    capturedAt: "2026-04-21T00:00:00.000Z",
  }));

  const results = service.simulate([
    { scenarioId: "reduce-30", subjectId: "domain-budget", reductionPercent: 30 },
  ]);

  assert.strictEqual(results[0]!.currentCostUsd, 200);
  assert.strictEqual(results[0]!.simulatedCostUsd, 140);
  assert.strictEqual(results[0]!.deltaUsd, -60);
  assert.ok(results[0]!.simulatedCostUsd >= 0);
});

test("budget - simulate unknown subject returns zero not negative", () => {
  const service = new CostOptimizationService();
  const results = service.simulate([
    { scenarioId: "ghost", subjectId: "unknown-subject", reductionPercent: 50 },
  ]);

  assert.strictEqual(results[0]!.currentCostUsd, 0);
  assert.strictEqual(results[0]!.simulatedCostUsd, 0);
  assert.strictEqual(results[0]!.deltaUsd, 0);
});

test("budget - 100% reduction results in zero cost", () => {
  const service = new CostOptimizationService();
  service.recordCost(makeCostRecord({
    subjectType: "agent",
    subjectId: "agent-full-cut",
    costType: "compute",
    amountUsd: 500,
    decisionRef: "dec-full",
    capturedAt: "2026-04-21T00:00:00.000Z",
  }));

  const results = service.simulate([
    { scenarioId: "full-cut", subjectId: "agent-full-cut", reductionPercent: 100 },
  ]);

  assert.strictEqual(results[0]!.simulatedCostUsd, 0);
  assert.strictEqual(results[0]!.deltaUsd, -500);
});

test("budget - unsourced record count does not affect budget calculations", () => {
  const service = new CostOptimizationService();
  service.recordCost(makeCostRecord({
    subjectType: "task",
    subjectId: "task-sourced",
    costType: "llm",
    amountUsd: 100,
    decisionRef: "dec-src",
    capturedAt: "2026-04-21T00:00:00.000Z",
  }));

  assert.throws(
    () =>
      service.recordCost({
        costType: "llm",
        llmCostUsd: 0,
        toolCostUsd: 0,
        computeCostUsd: 0,
        storageCostUsd: 0,
        egressCostUsd: 0,
        humanReviewCostUsd: 0,
        subjectType: "task",
        subjectId: "task-unsourced",
        costType: "llm",
        amountUsd: 50,
        decisionRef: "",
        capturedAt: "2026-04-21T00:00:00.000Z",
      }),
    /cost_optimizer\.unsourced_record/,
  );

  const slice = service.buildDashboardSlice();
  assert.strictEqual(slice.totalCostUsd, 100);
  assert.strictEqual(slice.unsourcedRecordCount, 1);
});

// Test: Optimization recommendations are generated
test("optimization recommendations - generated for cost >= 10", () => {
  const service = new CostOptimizationService();
  service.recordCost(makeCostRecord({
    subjectType: "workflow",
    subjectId: "wf-opt",
    costType: "llm",
    amountUsd: 100,
    decisionRef: "dec-opt",
    capturedAt: "2026-04-21T00:00:00.000Z",
  }));

  const recommendations = service.buildRecommendations();
  assert.strictEqual(recommendations.length, 1);
  assert.strictEqual(recommendations[0]!.subjectId, "wf-opt");
  assert.ok(recommendations[0]!.estimatedSavingsUsd > 0);
});

test("optimization recommendations - includes risk level", () => {
  const service = new CostOptimizationService();
  service.recordCost(makeCostRecord({
    subjectType: "model",
    subjectId: "model-rec",
    costType: "llm",
    amountUsd: 50,
    decisionRef: "dec-rec",
    modelRef: "claude-3-7",
    capturedAt: "2026-04-21T00:00:00.000Z",
  }));

  const recommendations = service.buildRecommendations();
  assert.strictEqual(recommendations.length, 1);
  assert.ok(
    recommendations[0]!.riskLevel === "low" ||
    recommendations[0]!.riskLevel === "medium" ||
    recommendations[0]!.riskLevel === "high",
  );
});

test("optimization recommendations - actions are valid", () => {
  const validActions = ["right_size", "downgrade_model", "increase_cache_hit", "schedule_shift"];

  const service = new CostOptimizationService();
  service.recordCost(makeCostRecord({
    subjectType: "task",
    subjectId: "task-action-1",
    costType: "llm",
    amountUsd: 50,
    decisionRef: "dec-act-1",
    capturedAt: "2026-04-21T00:00:00.000Z",
  }));
  service.recordCost(makeCostRecord({
    subjectType: "task",
    subjectId: "task-action-2",
    costType: "llm",
    amountUsd: 200,
    decisionRef: "dec-act-2",
    modelRef: "balanced",
    capturedAt: "2026-04-21T00:01:00.000Z",
  }));

  const recommendations = service.buildRecommendations();
  for (const rec of recommendations) {
    assert.ok(validActions.includes(rec.action), `Invalid action: ${rec.action}`);
  }
});

test("optimization recommendations - model records get upgraded risk", () => {
  const service = new CostOptimizationService();
  service.recordCost(makeCostRecord({
    subjectType: "model",
    subjectId: "model-risk",
    costType: "llm",
    amountUsd: 50,
    decisionRef: "dec-risk",
    modelRef: "claude-3-7",
    capturedAt: "2026-04-21T00:00:00.000Z",
  }));

  const recommendations = service.buildRecommendations();
  assert.strictEqual(recommendations.length, 1);
  assert.strictEqual(recommendations[0]!.riskLevel, "medium");
});

test("optimization recommendations - dashboard includes recommendations", () => {
  const service = new CostOptimizationService();
  service.recordCost(makeCostRecord({
    subjectType: "agent",
    subjectId: "agent-dash",
    costType: "compute",
    amountUsd: 150,
    decisionRef: "dec-dash",
    capturedAt: "2026-04-21T00:00:00.000Z",
  }));

  const slice = service.buildDashboardSlice();
  assert.ok(slice.recommendations.length > 0);
  assert.strictEqual(slice.recommendations[0]!.subjectId, "agent-dash");
});

test("optimization recommendations - empty when no records", () => {
  const service = new CostOptimizationService();
  const recommendations = service.buildRecommendations();
  assert.deepStrictEqual(recommendations, []);
});

test("optimization recommendations - multiple recommendations contain expected subjects", () => {
  const service = new CostOptimizationService();
  service.recordCost(makeCostRecord({
    subjectType: "task",
    subjectId: "task-low-savings",
    costType: "llm",
    amountUsd: 50,
    decisionRef: "dec-low",
    capturedAt: "2026-04-21T00:00:00.000Z",
  }));
  service.recordCost(makeCostRecord({
    subjectType: "task",
    subjectId: "task-high-savings",
    costType: "llm",
    amountUsd: 200,
    decisionRef: "dec-high",
    capturedAt: "2026-04-21T00:01:00.000Z",
  }));

  const slice = service.buildDashboardSlice();
  assert.strictEqual(slice.recommendations.length, 2);

  const subjectIds = slice.recommendations.map((r) => r.subjectId);
  assert.ok(subjectIds.includes("task-low-savings"));
  assert.ok(subjectIds.includes("task-high-savings"));
});
