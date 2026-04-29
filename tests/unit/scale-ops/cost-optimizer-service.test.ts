import assert from "node:assert/strict";
import test from "node:test";

import { CostOptimizationService, type CostAttributionRecord } from "../../../src/ops-maturity/cost-optimizer/cost-optimization-service.js";

test("CostOptimizationService recordCost adds record and returns it", async () => {
  const service = new CostOptimizationService();
  const record: CostAttributionRecord = {
    subjectType: "task",
    subjectId: "task-001",
    costType: "llm",
    amountUsd: 0.50,
    llmCostUsd: 0.50,
    toolCostUsd: 0,
    computeCostUsd: 0,
    storageCostUsd: 0,
    egressCostUsd: 0,
    humanReviewCostUsd: 0,
    decisionRef: "decision-001",
    capturedAt: new Date().toISOString(),
  };

  const result = service.recordCost(record);

  assert.equal(result.subjectId, "task-001");
  assert.equal(result.amountUsd, 0.50);
  const records = service.listRecords();
  assert.equal(records.length, 1);
});

test("CostOptimizationService recordCost throws for empty decisionRef", async () => {
  const service = new CostOptimizationService();
  const record: CostAttributionRecord = {
    subjectType: "task",
    subjectId: "task-001",
    costType: "llm",
    amountUsd: 0.50,
    llmCostUsd: 0.50,
    toolCostUsd: 0,
    computeCostUsd: 0,
    storageCostUsd: 0,
    egressCostUsd: 0,
    humanReviewCostUsd: 0,
    decisionRef: "",
    capturedAt: new Date().toISOString(),
  };

  assert.throws(
    () => service.recordCost(record),
    (err: Error) => err.message.includes("unsourced_record")
  );
});

test("CostOptimizationService aggregate sums costs by subject", async () => {
  const service = new CostOptimizationService();
  service.recordCost({
    subjectType: "task",
    subjectId: "task-001",
    costType: "total",
    amountUsd: 1.00,
    llmCostUsd: 0.50,
    toolCostUsd: 0.25,
    computeCostUsd: 0.25,
    storageCostUsd: 0,
    egressCostUsd: 0,
    humanReviewCostUsd: 0,
    decisionRef: "d1",
    capturedAt: new Date().toISOString(),
  });
  service.recordCost({
    subjectType: "task",
    subjectId: "task-002",
    costType: "total",
    amountUsd: 2.00,
    llmCostUsd: 1.00,
    toolCostUsd: 0.50,
    computeCostUsd: 0.50,
    storageCostUsd: 0,
    egressCostUsd: 0,
    humanReviewCostUsd: 0,
    decisionRef: "d2",
    capturedAt: new Date().toISOString(),
  });

  const aggregated = service.aggregate();

  assert.equal(aggregated["task-001"], 1.00);
  assert.equal(aggregated["task-002"], 2.00);
});

test("CostOptimizationService aggregate filters by subjectType when provided", async () => {
  const service = new CostOptimizationService();
  service.recordCost({
    subjectType: "task",
    subjectId: "task-001",
    costType: "total",
    amountUsd: 1.00,
    llmCostUsd: 0.50,
    toolCostUsd: 0.25,
    computeCostUsd: 0.25,
    storageCostUsd: 0,
    egressCostUsd: 0,
    humanReviewCostUsd: 0,
    decisionRef: "d1",
    capturedAt: new Date().toISOString(),
  });
  service.recordCost({
    subjectType: "model",
    subjectId: "model-gpt4",
    costType: "total",
    amountUsd: 5.00,
    llmCostUsd: 5.00,
    toolCostUsd: 0,
    computeCostUsd: 0,
    storageCostUsd: 0,
    egressCostUsd: 0,
    humanReviewCostUsd: 0,
    decisionRef: "d2",
    capturedAt: new Date().toISOString(),
  });

  const aggregated = service.aggregate("task");

  assert.equal(aggregated["task-001"], 1.00);
  assert.equal(aggregated["model-gpt4"], undefined);
});

test("CostOptimizationService simulate calculates cost reduction", async () => {
  const service = new CostOptimizationService();
  service.recordCost({
    subjectType: "task",
    subjectId: "task-001",
    costType: "total",
    amountUsd: 10.00,
    llmCostUsd: 5.00,
    toolCostUsd: 5.00,
    computeCostUsd: 0,
    storageCostUsd: 0,
    egressCostUsd: 0,
    humanReviewCostUsd: 0,
    decisionRef: "d1",
    capturedAt: new Date().toISOString(),
  });

  const results = service.simulate([{ scenarioId: "s1", subjectId: "task-001", reductionPercent: 20 }]);

  assert.equal(results.length, 1);
  assert.equal(results[0].scenarioId, "s1");
  assert.equal(results[0].currentCostUsd, 10.00);
  assert.equal(results[0].simulatedCostUsd, 8.00);
  assert.equal(results[0].deltaUsd, -2.00);
});

test("CostOptimizationService buildDashboardSlice returns complete slice", async () => {
  const service = new CostOptimizationService();
  service.recordCost({
    subjectType: "task",
    subjectId: "task-001",
    costType: "total",
    amountUsd: 3.50,
    llmCostUsd: 2.00,
    toolCostUsd: 1.50,
    computeCostUsd: 0,
    storageCostUsd: 0,
    egressCostUsd: 0,
    humanReviewCostUsd: 0,
    decisionRef: "d1",
    capturedAt: new Date().toISOString(),
  });

  const slice = service.buildDashboardSlice();

  assert.ok(slice.generatedAt.length > 0);
  assert.equal(slice.totalCostUsd, 3.50);
  assert.ok(slice.bySubject["task-001"] !== undefined);
  assert.ok(Array.isArray(slice.recommendations));
  assert.equal(slice.unsourcedRecordCount, 0);
});

test("CostOptimizationService listRecords returns copy of records", async () => {
  const service = new CostOptimizationService();
  service.recordCost({
    subjectType: "task",
    subjectId: "task-001",
    costType: "llm",
    amountUsd: 1.00,
    llmCostUsd: 1.00,
    toolCostUsd: 0,
    computeCostUsd: 0,
    storageCostUsd: 0,
    egressCostUsd: 0,
    humanReviewCostUsd: 0,
    decisionRef: "d1",
    capturedAt: new Date().toISOString(),
  });

  const records = service.listRecords();

  assert.equal(records.length, 1);
  assert.equal(records[0].subjectId, "task-001");
  records[0].subjectId = "modified";
  const records2 = service.listRecords();
  assert.equal(records2[0].subjectId, "task-001");
});

test("CostOptimizationService buildRecommendations returns recommendations for subjects", async () => {
  const service = new CostOptimizationService();
  service.recordCost({
    subjectType: "task",
    subjectId: "task-001",
    costType: "total",
    amountUsd: 100.00,
    llmCostUsd: 80.00,
    toolCostUsd: 20.00,
    computeCostUsd: 0,
    storageCostUsd: 0,
    egressCostUsd: 0,
    humanReviewCostUsd: 0,
    decisionRef: "d1",
    modelRef: "gpt-4",
    capturedAt: new Date().toISOString(),
  });

  const recommendations = service.buildRecommendations();

  assert.ok(recommendations.length > 0);
  const rec = recommendations.find((r) => r.subjectId === "task-001");
  assert.ok(rec != null);
});
