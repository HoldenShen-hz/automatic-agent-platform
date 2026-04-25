import test from "node:test";
import { strict as assert } from "node:assert/strict";
import { CostOptimizationService, type CostAttributionRecord, type CostSimulationScenarioInput } from "../../../../../src/ops-maturity/cost-optimizer/cost-optimization-service.js";
import { simulateCostOptimization, simulateScenarioSavings } from "../../../../../src/ops-maturity/cost-optimizer/simulator/index.js";
import { buildCostOptimizationRecommendation, prioritizeCostOptimizationRecommendations } from "../../../../../src/ops-maturity/cost-optimizer/recommendation-engine/index.js";

test("CostOptimizationService.recordCost stores record and returns it", () => {
  const service = new CostOptimizationService();
  const record: CostAttributionRecord = {
    subjectType: "task",
    subjectId: "task-1",
    costType: "model",
    amountUsd: 0.50,
    decisionRef: "dec-1",
    capturedAt: "2024-01-01T00:00:00Z",
  };

  const result = service.recordCost(record);

  assert.deepStrictEqual(result, record);
});

test("CostOptimizationService.recordCost throws for empty decisionRef", () => {
  const service = new CostOptimizationService();
  const record: CostAttributionRecord = {
    subjectType: "task",
    subjectId: "task-1",
    costType: "model",
    amountUsd: 0.50,
    decisionRef: "",
    capturedAt: "2024-01-01T00:00:00Z",
  };

  assert.throws(() => {
    service.recordCost(record);
  }, /unsourced_record/);
});

test("CostOptimizationService.recordCost increments unsourcedRecordCount for empty decisionRef", () => {
  const service = new CostOptimizationService();
  const record: CostAttributionRecord = {
    subjectType: "task",
    subjectId: "task-1",
    costType: "model",
    amountUsd: 0.50,
    decisionRef: "   ",
    capturedAt: "2024-01-01T00:00:00Z",
  };

  try {
    service.recordCost(record);
  } catch {
    // expected
  }

  assert.strictEqual(service.buildDashboardSlice().unsourcedRecordCount, 1);
});

test("CostOptimizationService.aggregate sums costs by subjectId", () => {
  const service = new CostOptimizationService();
  service.recordCost(makeRecord("task", "task-1", 0.10));
  service.recordCost(makeRecord("task", "task-1", 0.20));
  service.recordCost(makeRecord("task", "task-2", 0.15));

  const result = service.aggregate();

  assert.strictEqual(result["task-1"], 0.30);
  assert.strictEqual(result["task-2"], 0.15);
});

test("CostOptimizationService.aggregate filters by subjectType", () => {
  const service = new CostOptimizationService();
  service.recordCost(makeRecord("task", "task-1", 0.10));
  service.recordCost(makeRecord("agent", "agent-1", 0.20));

  const result = service.aggregate("task");

  assert.strictEqual(result["task-1"], 0.10);
  assert.strictEqual(result["agent-1"], undefined);
});

test("CostOptimizationService.buildRecommendations returns recommendations for subjects over threshold", () => {
  const service = new CostOptimizationService();
  service.recordCost(makeRecord("task", "expensive-task", 50, "model-ref-1"));

  const recommendations = service.buildRecommendations();

  assert.ok(recommendations.length > 0);
  assert.ok(recommendations.some((r) => r.subjectId === "expensive-task"));
});

test("CostOptimizationService.buildRecommendations returns empty for subjects under threshold", () => {
  const service = new CostOptimizationService();
  service.recordCost(makeRecord("task", "cheap-task", 5));

  const recommendations = service.buildRecommendations();

  assert.ok(!recommendations.some((r) => r.subjectId === "cheap-task"));
});

test("CostOptimizationService.simulate returns correct simulation results", () => {
  const service = new CostOptimizationService();
  service.recordCost(makeRecord("task", "task-1", 100));

  const scenarios: CostSimulationScenarioInput[] = [
    { scenarioId: "s1", subjectId: "task-1", reductionPercent: 10 },
  ];

  const results = service.simulate(scenarios);

  assert.strictEqual(results[0]!.scenarioId, "s1");
  assert.strictEqual(results[0]!.currentCostUsd, 100);
  assert.strictEqual(results[0]!.simulatedCostUsd, 90);
});

test("CostOptimizationService.buildDashboardSlice returns complete slice", () => {
  const service = new CostOptimizationService();
  service.recordCost(makeRecord("task", "task-1", 25));

  const slice = service.buildDashboardSlice();

  assert.ok(typeof slice.generatedAt === "string");
  assert.strictEqual(slice.totalCostUsd, 25);
  assert.ok(typeof slice.bySubject === "object");
  assert.ok(Array.isArray(slice.recommendations));
  assert.ok(typeof slice.unsourcedRecordCount === "number");
});

test("CostOptimizationService.listRecords returns all records", () => {
  const service = new CostOptimizationService();
  service.recordCost(makeRecord("task", "task-1", 0.10));
  service.recordCost(makeRecord("task", "task-2", 0.20));

  const records = service.listRecords();

  assert.strictEqual(records.length, 2);
});

test("simulateCostOptimization calculates correct reduction", () => {
  const result = simulateCostOptimization(100, 10);

  assert.strictEqual(result, 90);
});

test("simulateCostOptimization handles zero reduction", () => {
  const result = simulateCostOptimization(100, 0);

  assert.strictEqual(result, 100);
});

test("simulateCostOptimization handles 100% reduction", () => {
  const result = simulateCostOptimization(100, 100);

  assert.strictEqual(result, 0);
});

test("simulateCostOptimization handles fractional percentages", () => {
  const result = simulateCostOptimization(100, 15.5);

  assert.strictEqual(result, 84.5);
});

test("buildCostOptimizationRecommendation returns null for low cost subjects", () => {
  const result = buildCostOptimizationRecommendation("cheap-task", 5);

  assert.strictEqual(result, null);
});

test("buildCostOptimizationRecommendation returns recommendation for high cost subjects", () => {
  const result = buildCostOptimizationRecommendation("expensive-task", 100);

  assert.ok(result !== null);
  assert.strictEqual(result?.subjectId, "expensive-task");
  assert.ok(typeof result?.estimatedSavingsUsd === "number");
});

test("buildCostOptimizationRecommendation includes action based on cost threshold", () => {
  const lowCost = buildCostOptimizationRecommendation("task", 50);
  const highCost = buildCostOptimizationRecommendation("task", 150);

  assert.ok(lowCost !== null);
  assert.ok(highCost !== null);
  assert.strictEqual(lowCost?.action, "increase_cache_hit");
  assert.strictEqual(highCost?.action, "right_size");
});

test("prioritizeCostOptimizationRecommendations sorts by estimated savings descending", () => {
  const recommendations = [
    { recommendationId: "r1", subjectId: "low-savings", estimatedSavingsUsd: 10, riskLevel: "low" as const, action: "right_size" as const },
    { recommendationId: "r2", subjectId: "high-savings", estimatedSavingsUsd: 100, riskLevel: "low" as const, action: "right_size" as const },
    { recommendationId: "r3", subjectId: "medium-savings", estimatedSavingsUsd: 50, riskLevel: "low" as const, action: "right_size" as const },
  ];

  const sorted = prioritizeCostOptimizationRecommendations(recommendations);

  assert.strictEqual(sorted[0]!.subjectId, "high-savings");
  assert.strictEqual(sorted[1]!.subjectId, "medium-savings");
  assert.strictEqual(sorted[2]!.subjectId, "low-savings");
});

test("simulateScenarioSavings returns savings per scenario", () => {
  const scenarios = [
    { scenarioId: "s1", baselineCostUsd: 100, reductionPercent: 10 },
    { scenarioId: "s2", baselineCostUsd: 200, reductionPercent: 20 },
  ];

  const result = simulateScenarioSavings(scenarios);

  assert.strictEqual(result["s1"], 10);
  assert.strictEqual(result["s2"], 40);
});

test("CostOptimizationService handles multiple cost types for same subject", () => {
  const service = new CostOptimizationService();
  service.recordCost(makeRecordWithCostType("task", "task-1", 0.10, "model"));
  service.recordCost(makeRecordWithCostType("task", "task-1", 0.15, "runtime"));

  const result = service.aggregate();

  assert.strictEqual(result["task-1"], 0.25);
});

function makeRecord(subjectType: "task" | "agent" | "model" | "workflow" | "domain", subjectId: string, amountUsd: number, modelRef?: string): CostAttributionRecord {
  const record: CostAttributionRecord = {
    subjectType,
    subjectId,
    costType: "model",
    amountUsd,
    decisionRef: "test-decision",
    capturedAt: new Date().toISOString(),
  };
  if (modelRef !== undefined) {
    return { ...record, modelRef };
  }
  return record;
}

function makeRecordWithCostType(subjectType: "task" | "agent" | "model" | "workflow" | "domain", subjectId: string, amountUsd: number, costType: "model" | "tool" | "storage" | "runtime" | "network"): CostAttributionRecord {
  return {
    subjectType,
    subjectId,
    costType,
    amountUsd,
    decisionRef: "test-decision",
    capturedAt: new Date().toISOString(),
  };
}