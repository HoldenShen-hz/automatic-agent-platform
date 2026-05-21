import assert from "node:assert/strict";
import test from "node:test";

import { CostOptimizationService } from "../../../../src/ops-maturity/cost-optimizer/cost-optimization-service.js";

test("cost-management: CostOptimizationService records and aggregates costs", () => {
  const service = new CostOptimizationService();

  service.recordCost({
    subjectType: "workflow",
    subjectId: "workflow_a",
    costType: "model",
    amountUsd: 12.5,
    decisionRef: "decision_1",
    modelRef: "gpt-5.4",
    capturedAt: "2026-04-20T00:00:00.000Z",
  });

  service.recordCost({
    subjectType: "workflow",
    subjectId: "workflow_a",
    costType: "tool",
    amountUsd: 7.5,
    decisionRef: "decision_2",
    capturedAt: "2026-04-20T00:10:00.000Z",
  });

  assert.deepStrictEqual(service.aggregate("workflow"), { workflow_a: 20 });
});

test("cost-management: CostOptimizationService aggregates all costs without filter", () => {
  const service = new CostOptimizationService();

  service.recordCost({
    subjectType: "task",
    subjectId: "task_a",
    costType: "llm",
    amountUsd: 10,
    decisionRef: "d1",
    capturedAt: "2026-04-20T00:00:00.000Z",
  });

  service.recordCost({
    subjectType: "agent",
    subjectId: "agent_b",
    costType: "compute",
    amountUsd: 5,
    decisionRef: "d2",
    capturedAt: "2026-04-20T00:05:00.000Z",
  });

  const result = service.aggregate();

  assert.strictEqual(result["task_a"], 10);
  assert.strictEqual(result["agent_b"], 5);
});

test("cost-management: CostOptimizationService rejects unsourced records", () => {
  const service = new CostOptimizationService();

  assert.throws(
    () => {
      service.recordCost({
        subjectType: "task",
        subjectId: "task_a",
        costType: "model",
        amountUsd: 5,
        decisionRef: "",
        capturedAt: "2026-04-20T00:00:00.000Z",
      });
    },
    /cost_optimizer\.unsourced_record/,
  );

  assert.strictEqual(service.buildDashboardSlice().unsourcedRecordCount, 1);
});

test("cost-management: CostOptimizationService tracks unsourced record count", () => {
  const service = new CostOptimizationService();

  try {
    service.recordCost({
      subjectType: "task",
      subjectId: "task_a",
      costType: "model",
      amountUsd: 5,
      decisionRef: "",
      capturedAt: "2026-04-20T00:00:00.000Z",
    });
  } catch {
    // expected - invalid record
  }

  try {
    service.recordCost({
      subjectType: "task",
      subjectId: "task_b",
      costType: "model",
      amountUsd: 10,
      decisionRef: "",
      capturedAt: "2026-04-20T00:00:00.000Z",
    });
  } catch {
    // expected - invalid record
  }

  assert.strictEqual(service.buildDashboardSlice().unsourcedRecordCount, 2);
});

test("cost-management: CostOptimizationService builds recommendations", () => {
  const service = new CostOptimizationService();

  service.recordCost({
    subjectType: "workflow",
    subjectId: "workflow_a",
    costType: "model",
    amountUsd: 12.5,
    decisionRef: "decision_1",
    modelRef: "gpt-5.4",
    capturedAt: "2026-04-20T00:00:00.000Z",
  });

  const recommendations = service.buildRecommendations("workflow");

  assert.strictEqual(recommendations.length, 1);
  assert.strictEqual(recommendations[0]?.subjectId, "workflow_a");
});

test("cost-management: CostOptimizationService simulates cost reduction", () => {
  const service = new CostOptimizationService();

  service.recordCost({
    subjectType: "workflow",
    subjectId: "workflow_a",
    costType: "model",
    amountUsd: 100,
    decisionRef: "decision_1",
    capturedAt: "2026-04-20T00:00:00.000Z",
  });

  const simulation = service.simulate([
    {
      scenarioId: "scenario_reduce_10",
      subjectId: "workflow_a",
      reductionPercent: 10,
    },
  ]);

  assert.strictEqual(simulation[0]?.currentCostUsd, 100);
  assert.strictEqual(simulation[0]?.simulatedCostUsd, 90);
  assert.strictEqual(simulation[0]?.deltaUsd, -10);
});

test("cost-management: CostOptimizationService simulates multiple scenarios", () => {
  const service = new CostOptimizationService();

  service.recordCost({
    subjectType: "task",
    subjectId: "task_a",
    costType: "llm",
    amountUsd: 50,
    decisionRef: "d1",
    capturedAt: "2026-04-20T00:00:00.000Z",
  });

  service.recordCost({
    subjectType: "task",
    subjectId: "task_b",
    costType: "llm",
    amountUsd: 100,
    decisionRef: "d2",
    capturedAt: "2026-04-20T00:05:00.000Z",
  });

  const simulation = service.simulate([
    { scenarioId: "s1", subjectId: "task_a", reductionPercent: 20 },
    { scenarioId: "s2", subjectId: "task_b", reductionPercent: 30 },
  ]);

  assert.strictEqual(simulation[0]?.simulatedCostUsd, 40);
  assert.strictEqual(simulation[1]?.simulatedCostUsd, 70);
});

test("cost-management: CostOptimizationService handles unknown subject in simulation", () => {
  const service = new CostOptimizationService();

  service.recordCost({
    subjectType: "task",
    subjectId: "task_a",
    costType: "llm",
    amountUsd: 50,
    decisionRef: "d1",
    capturedAt: "2026-04-20T00:00:00.000Z",
  });

  const simulation = service.simulate([
    { scenarioId: "s1", subjectId: "unknown_subject", reductionPercent: 10 },
  ]);

  assert.strictEqual(simulation[0]?.currentCostUsd, 0);
  assert.strictEqual(simulation[0]?.simulatedCostUsd, 0);
});

test("cost-management: CostOptimizationService builds dashboard slice", () => {
  const service = new CostOptimizationService();

  service.recordCost({
    subjectType: "workflow",
    subjectId: "workflow_a",
    costType: "model",
    amountUsd: 12.5,
    decisionRef: "decision_1",
    capturedAt: "2026-04-20T00:00:00.000Z",
  });

  service.recordCost({
    subjectType: "workflow",
    subjectId: "workflow_a",
    costType: "tool",
    amountUsd: 7.5,
    decisionRef: "decision_2",
    capturedAt: "2026-04-20T00:10:00.000Z",
  });

  const dashboard = service.buildDashboardSlice("2026-04-20T01:00:00.000Z");

  assert.strictEqual(dashboard.generatedAt, "2026-04-20T01:00:00.000Z");
  assert.strictEqual(dashboard.totalCostUsd, 20);
  assert.strictEqual(dashboard.unsourcedRecordCount, 0);
  assert.ok(Array.isArray(dashboard.recommendations));
  assert.ok("workflow_a" in dashboard.bySubject);
});

test("cost-management: CostOptimizationService lists records as copy", () => {
  const service = new CostOptimizationService();

  service.recordCost({
    subjectType: "task",
    subjectId: "task_a",
    costType: "llm",
    amountUsd: 10,
    decisionRef: "d1",
    capturedAt: "2026-04-20T00:00:00.000Z",
  });

  const records = service.listRecords();

  assert.strictEqual(records.length, 1);
  assert.strictEqual(records[0].subjectId, "task_a");

  // Modifying returned array does not affect internal state
  records.push({
    subjectType: "task",
    subjectId: "task_b",
    costType: "llm",
    amountUsd: 20,
    decisionRef: "d2",
    capturedAt: "2026-04-20T00:00:00.000Z",
  });

  const records2 = service.listRecords();
  assert.strictEqual(records2.length, 1);
});

test("cost-management: CostOptimizationService filters by harness_run_id", () => {
  const service = new CostOptimizationService();

  service.recordCost({
    harness_run_id: "run_123",
    costType: "llm",
    amountUsd: 10,
    decisionRef: "d1",
    capturedAt: "2026-04-20T00:00:00.000Z",
  });

  service.recordCost({
    harness_run_id: "run_456",
    costType: "llm",
    amountUsd: 20,
    decisionRef: "d2",
    capturedAt: "2026-04-20T00:05:00.000Z",
  });

  const result = service.aggregate("run_123");

  assert.strictEqual(result["run_123"], 10);
  assert.strictEqual(result["run_456"], undefined);
});

test("cost-management: CostOptimizationService filters by subjectType", () => {
  const service = new CostOptimizationService();

  service.recordCost({
    subjectType: "task",
    subjectId: "task_a",
    costType: "llm",
    amountUsd: 10,
    decisionRef: "d1",
    capturedAt: "2026-04-20T00:00:00.000Z",
  });

  service.recordCost({
    subjectType: "workflow",
    subjectId: "workflow_a",
    costType: "llm",
    amountUsd: 20,
    decisionRef: "d2",
    capturedAt: "2026-04-20T00:05:00.000Z",
  });

  const result = service.aggregate("task");

  assert.strictEqual(result["task_a"], 10);
  assert.strictEqual(result["workflow_a"], undefined);
});

test("cost-management: CostOptimizationService risk level escalation for LLM costs", () => {
  const service = new CostOptimizationService();

  // Record an LLM cost record
  service.recordCost({
    subjectType: "task",
    subjectId: "task_llm",
    costType: "llm",
    amountUsd: 50,
    decisionRef: "d1",
    capturedAt: "2026-04-20T00:00:00.000Z",
  });

  const recommendations = service.buildRecommendations("task");

  assert.ok(recommendations.length > 0);
  // Low risk becomes medium for LLM costs
  assert.ok(
    recommendations[0].riskLevel === "medium" || recommendations[0].riskLevel === "high",
  );
});

test("cost-management: CostOptimizationService risk level not escalated for non-LLM costs", () => {
  const service = new CostOptimizationService();

  // Record a tool cost only
  service.recordCost({
    subjectType: "task",
    subjectId: "task_tool",
    costType: "tool",
    amountUsd: 30,
    decisionRef: "d1",
    capturedAt: "2026-04-20T00:00:00.000Z",
  });

  const recommendations = service.buildRecommendations("task");

  // For low cost (30 < 50), risk should stay low for non-LLM costs
  assert.ok(recommendations.length > 0);
  assert.strictEqual(recommendations[0].riskLevel, "low");
});

test("cost-management: CostOptimizationService resolves model reference", () => {
  const service = new CostOptimizationService();

  service.recordCost({
    subjectType: "task",
    subjectId: "task_model",
    costType: "model",
    amountUsd: 100,
    decisionRef: "d1",
    modelRef: "anthropic/claude-3-5-sonnet",
    capturedAt: "2026-04-20T00:00:00.000Z",
  });

  const recommendations = service.buildRecommendations("task");

  assert.ok(recommendations.length > 0);
  assert.strictEqual(recommendations[0].currentModelRef, "anthropic/claude-3-5-sonnet");
});

test("cost-management: CostOptimizationService records costs with all cost types", () => {
  const service = new CostOptimizationService();

  const costTypes = [
    { costType: "llm" as const, amount: 10 },
    { costType: "tool" as const, amount: 5 },
    { costType: "compute" as const, amount: 3 },
    { costType: "storage" as const, amount: 2 },
    { costType: "egress" as const, amount: 1 },
    { costType: "humanReview" as const, amount: 15 },
    { costType: "total" as const, amount: 36 },
    { costType: "model" as const, amount: 20 },
    { costType: "runtime" as const, amount: 8 },
  ];

  for (const { costType, amount } of costTypes) {
    service.recordCost({
      subjectType: "task",
      subjectId: `task_${costType}`,
      costType,
      amountUsd: amount,
      decisionRef: `d_${costType}`,
      capturedAt: "2026-04-20T00:00:00.000Z",
    });
  }

  const result = service.aggregate("task");

  assert.strictEqual(result["task_llm"], 10);
  assert.strictEqual(result["task_tool"], 5);
  assert.strictEqual(result["task_compute"], 3);
  assert.strictEqual(result["task_storage"], 2);
  assert.strictEqual(result["task_egress"], 1);
  assert.strictEqual(result["task_humanReview"], 15);
  assert.strictEqual(result["task_total"], 36);
  assert.strictEqual(result["task_model"], 20);
  assert.strictEqual(result["task_runtime"], 8);
});

test("cost-management: CostOptimizationService handles empty state", () => {
  const service = new CostOptimizationService();

  const aggregate = service.aggregate();
  const recommendations = service.buildRecommendations();
  const dashboard = service.buildDashboardSlice();
  const records = service.listRecords();

  assert.deepStrictEqual(aggregate, {});
  assert.deepStrictEqual(recommendations, []);
  assert.strictEqual(dashboard.totalCostUsd, 0);
  assert.strictEqual(dashboard.unsourcedRecordCount, 0);
  assert.deepStrictEqual(dashboard.bySubject, {});
  assert.deepStrictEqual(records, []);
});

test("cost-management: CostOptimizationService simulate handles empty scenarios", () => {
  const service = new CostOptimizationService();

  service.recordCost({
    subjectType: "task",
    subjectId: "task_a",
    costType: "llm",
    amountUsd: 100,
    decisionRef: "d1",
    capturedAt: "2026-04-20T00:00:00.000Z",
  });

  const result = service.simulate([]);

  assert.deepStrictEqual(result, []);
});