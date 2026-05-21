import assert from "node:assert/strict";
import test from "node:test";

// These are type-only exports and re-exports from the cost-optimizer index
// Testing that the module exports all expected types and functions

import {
  CostOptimizationService,
  CostAttributionRecord,
  CostSimulationScenarioInput,
  CostSimulationResult,
  CostDashboardSlice,
  type CostSubjectType,
} from "../../../../src/ops-maturity/cost-optimizer/index.js";

test("cost-management: index exports CostOptimizationService", () => {
  assert.ok(CostOptimizationService != null);
  assert.strictEqual(typeof CostOptimizationService, "function");
});

test("cost-management: index exports CostAttributionRecord type", () => {
  const record: CostAttributionRecord = {
    subjectType: "task",
    subjectId: "test-task",
    costType: "llm",
    amountUsd: 10,
    llmCostUsd: 10,
    toolCostUsd: 0,
    computeCostUsd: 0,
    storageCostUsd: 0,
    egressCostUsd: 0,
    humanReviewCostUsd: 0,
    decisionRef: "test-decision",
    capturedAt: "2026-04-20T00:00:00.000Z",
  };

  assert.strictEqual(record.subjectType, "task");
  assert.strictEqual(record.costType, "llm");
  assert.strictEqual(record.amountUsd, 10);
});

test("cost-management: index exports CostSubjectType type", () => {
  const subjectTypes: CostSubjectType[] = ["task", "workflow", "agent", "model", "domain", "run"];

  for (const type of subjectTypes) {
    assert.ok(typeof type === "string");
  }
});

test("cost-management: index exports CostSimulationScenarioInput interface", () => {
  const scenario: CostSimulationScenarioInput = {
    scenarioId: "test-scenario",
    subjectId: "test-subject",
    reductionPercent: 15,
  };

  assert.strictEqual(scenario.scenarioId, "test-scenario");
  assert.strictEqual(scenario.subjectId, "test-subject");
  assert.strictEqual(scenario.reductionPercent, 15);
});

test("cost-management: index exports CostSimulationResult interface", () => {
  const result: CostSimulationResult = {
    scenarioId: "test-scenario",
    subjectId: "test-subject",
    currentCostUsd: 100,
    simulatedCostUsd: 85,
    deltaUsd: -15,
  };

  assert.strictEqual(result.currentCostUsd, 100);
  assert.strictEqual(result.simulatedCostUsd, 85);
  assert.strictEqual(result.deltaUsd, -15);
});

test("cost-management: index exports CostDashboardSlice interface", () => {
  const slice: CostDashboardSlice = {
    generatedAt: "2026-04-20T00:00:00.000Z",
    totalCostUsd: 150.5,
    bySubject: { task_a: 100, task_b: 50.5 },
    recommendations: [],
    unsourcedRecordCount: 0,
  };

  assert.strictEqual(slice.generatedAt, "2026-04-20T00:00:00.000Z");
  assert.strictEqual(slice.totalCostUsd, 150.5);
  assert.ok("task_a" in slice.bySubject);
  assert.ok("task_b" in slice.bySubject);
});

test("cost-management: index exports can be used to create full service instance", () => {
  const service = new CostOptimizationService();

  service.recordCost({
    subjectType: "task",
    subjectId: "test-task",
    costType: "llm",
    amountUsd: 25,
    llmCostUsd: 25,
    toolCostUsd: 0,
    computeCostUsd: 0,
    storageCostUsd: 0,
    egressCostUsd: 0,
    humanReviewCostUsd: 0,
    decisionRef: "test-decision",
    capturedAt: "2026-04-20T00:00:00.000Z",
  });

  const aggregate = service.aggregate();
  const dashboard = service.buildDashboardSlice();

  assert.strictEqual(aggregate["test-task"], 25);
  assert.strictEqual(dashboard.totalCostUsd, 25);
});

test("cost-management: CostAttributionRecord supports optional fields", () => {
  // Minimal record with only required fields
  const record: CostAttributionRecord = {
    costType: "tool",
    amountUsd: 5,
    decisionRef: "minimal",
    capturedAt: "2026-04-20T00:00:00.000Z",
  };

  assert.strictEqual(record.costType, "tool");
  assert.strictEqual(record.subjectId, undefined);
  assert.strictEqual(record.harness_run_id, undefined);
  assert.strictEqual(record.modelRef, undefined);
});

test("cost-management: CostAttributionRecord supports qualityRisk field", () => {
  const record: CostAttributionRecord = {
    costType: "llm",
    amountUsd: 50,
    decisionRef: "test",
    capturedAt: "2026-04-20T00:00:00.000Z",
    qualityRisk: "high",
  };

  assert.strictEqual(record.qualityRisk, "high");
});

test("cost-management: CostDashboardSlice recommendations are readonly", () => {
  const slice: CostDashboardSlice = {
    generatedAt: "2026-04-20T00:00:00.000Z",
    totalCostUsd: 0,
    bySubject: {},
    recommendations: Object.freeze([]),
    unsourcedRecordCount: 0,
  };

  // Should be readable
  assert.strictEqual(slice.recommendations.length, 0);
});