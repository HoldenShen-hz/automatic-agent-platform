import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateCostAttribution,
  buildCostOptimizationRecommendation,
  CostOptimizationService,
} from "../../../../src/ops-maturity/cost-optimizer/index.js";

test("aggregateCostAttribution sums amounts per subjectId", () => {
  const entries = [
    { subjectId: "task_1", amountUsd: 10 },
    { subjectId: "task_1", amountUsd: 5 },
    { subjectId: "task_2", amountUsd: 3 },
  ];
  const result = aggregateCostAttribution(entries);
  assert.deepEqual(result, { task_1: 15, task_2: 3 });
});

test("aggregateCostAttribution handles empty input", () => {
  const result = aggregateCostAttribution([]);
  assert.deepEqual(result, {});
});

test("CostOptimizationService.recordCost stores a valid record", () => {
  const service = new CostOptimizationService();
  const record = service.recordCost({
    subjectType: "task",
    subjectId: "task_x",
    costType: "model",
    amountUsd: 25,
    decisionRef: "dec_001",
    modelRef: "claude-3-7",
    capturedAt: "2026-04-21T00:00:00.000Z",
  });
  assert.equal(record.subjectId, "task_x");
  assert.equal(record.amountUsd, 25);
  assert.deepEqual(service.listRecords(), [record]);
});

test("CostOptimizationService.recordCost throws for empty decisionRef", () => {
  const service = new CostOptimizationService();
  assert.throws(
    () =>
      service.recordCost({
        subjectType: "task",
        subjectId: "task_y",
        costType: "model",
        amountUsd: 2,
        decisionRef: "   ",
        capturedAt: "2026-04-21T00:00:00.000Z",
      }),
    /cost_optimizer\.unsourced_record/,
  );
});

test("CostOptimizationService.aggregate returns per-subject totals", () => {
  const service = new CostOptimizationService();
  service.recordCost({
    subjectType: "agent",
    subjectId: "agent_alpha",
    costType: "runtime",
    amountUsd: 10,
    decisionRef: "dec_1",
    capturedAt: "2026-04-21T00:00:00.000Z",
  });
  service.recordCost({
    subjectType: "agent",
    subjectId: "agent_alpha",
    costType: "storage",
    amountUsd: 5,
    decisionRef: "dec_2",
    capturedAt: "2026-04-21T00:01:00.000Z",
  });
  service.recordCost({
    subjectType: "model",
    subjectId: "model_beta",
    costType: "model",
    amountUsd: 20,
    decisionRef: "dec_3",
    modelRef: "gpt-5",
    capturedAt: "2026-04-21T00:02:00.000Z",
  });

  const all = service.aggregate();
  assert.equal(all["agent_alpha"], 15);
  assert.equal(all["model_beta"], 20);

  const agentsOnly = service.aggregate("agent");
  assert.equal(agentsOnly["agent_alpha"], 15);
  assert.equal(agentsOnly["model_beta"], undefined);
});

test("CostOptimizationService.aggregate returns empty when no records match filter", () => {
  const service = new CostOptimizationService();
  service.recordCost({
    subjectType: "task",
    subjectId: "task_z",
    costType: "network",
    amountUsd: 1,
    decisionRef: "dec_1",
    capturedAt: "2026-04-21T00:00:00.000Z",
  });
  const result = service.aggregate("domain");
  assert.deepEqual(result, {});
});

test("buildCostOptimizationRecommendation returns null when cost < 10", () => {
  const result = buildCostOptimizationRecommendation("cheap_task", 9.99);
  assert.equal(result, null);
});

test("buildCostOptimizationRecommendation returns recommendation when cost >= 10", () => {
  const result = buildCostOptimizationRecommendation("normal_task", 50);
  assert.ok(result != null);
  assert.equal(result.subjectId, "normal_task");
  assert.equal(result.estimatedSavingsUsd, 7.5);
  assert.equal(result.riskLevel, "low");
});

test("buildCostOptimizationRecommendation uses medium risk when cost > 100", () => {
  const result = buildCostOptimizationRecommendation("expensive_workflow", 200);
  assert.ok(result != null);
  assert.equal(result.estimatedSavingsUsd, 30);
  assert.equal(result.riskLevel, "medium");
});

test("buildCostOptimizationRecommendation suggests model downgrade when a cheaper peer exists", () => {
  const result = buildCostOptimizationRecommendation("model_heavy_task", 200, {
    modelRef: "balanced",
  });
  assert.ok(result != null);
  assert.equal(result.action, "downgrade_model");
  assert.equal(result.currentModelRef, "balanced");
  assert.ok(typeof result.recommendedModelRef === "string");
});

test("CostOptimizationService.buildRecommendations generates recommendations for subjects with cost >= 10", () => {
  const service = new CostOptimizationService();
  service.recordCost({
    subjectType: "workflow",
    subjectId: "wf_cheap",
    costType: "tool",
    amountUsd: 5,
    decisionRef: "dec_wf_cheap",
    capturedAt: "2026-04-21T00:00:00.000Z",
  });
  service.recordCost({
    subjectType: "workflow",
    subjectId: "wf_normal",
    costType: "model",
    amountUsd: 50,
    decisionRef: "dec_wf_normal",
    modelRef: "claude-3-7",
    capturedAt: "2026-04-21T00:00:00.000Z",
  });
  service.recordCost({
    subjectType: "agent",
    subjectId: "agent_expensive",
    costType: "runtime",
    amountUsd: 200,
    decisionRef: "dec_agent_expensive",
    capturedAt: "2026-04-21T00:00:00.000Z",
  });

  const recommendations = service.buildRecommendations();
  assert.equal(recommendations.length, 2);

  const wfRec = recommendations.find((r) => r.subjectId === "wf_normal");
  assert.ok(wfRec != null);
  assert.equal(wfRec.riskLevel, "low");

  const agentRec = recommendations.find((r) => r.subjectId === "agent_expensive");
  assert.ok(agentRec != null);
  assert.equal(agentRec.estimatedSavingsUsd, 30);
  assert.equal(agentRec.riskLevel, "medium");
});

test("CostOptimizationService.upgrades risk to medium when subject has model costType and base risk is low", () => {
  const service = new CostOptimizationService();
  service.recordCost({
    subjectType: "model",
    subjectId: "model_with_model_cost",
    costType: "model",
    amountUsd: 50,
    decisionRef: "dec_model",
    modelRef: "claude-3-7",
    capturedAt: "2026-04-21T00:00:00.000Z",
  });

  const recommendations = service.buildRecommendations("model");
  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0]!.riskLevel, "medium");
});

test("CostOptimizationService.buildDashboardSlice includes all expected fields", () => {
  const service = new CostOptimizationService();
  service.recordCost({
    subjectType: "task",
    subjectId: "dash_task",
    costType: "model",
    amountUsd: 120,
    decisionRef: "dec_dash",
    capturedAt: "2026-04-21T00:00:00.000Z",
  });

  const slice = service.buildDashboardSlice("2026-04-21T12:00:00.000Z");
  assert.equal(slice.generatedAt, "2026-04-21T12:00:00.000Z");
  assert.equal(slice.totalCostUsd, 120);
  assert.deepEqual(slice.bySubject, { dash_task: 120 });
  assert.equal(slice.unsourcedRecordCount, 0);
  assert.ok(slice.recommendations.length > 0);
});

test("CostOptimizationService.listRecords returns a copy of records", () => {
  const service = new CostOptimizationService();
  service.recordCost({
    subjectType: "task",
    subjectId: "list_task",
    costType: "runtime",
    amountUsd: 1,
    decisionRef: "dec_list",
    capturedAt: "2026-04-21T00:00:00.000Z",
  });

  const records = service.listRecords();
  records.push({ subjectType: "task", subjectId: "tampered", costType: "tool", amountUsd: 0, decisionRef: "x", capturedAt: "2026-04-21T00:00:00.000Z" });

  assert.equal(service.listRecords().length, 1);
});

test("CostOptimizationService.simulate returns correct delta and values", () => {
  const service = new CostOptimizationService();
  service.recordCost({
    subjectType: "task",
    subjectId: "sim_task",
    costType: "model",
    amountUsd: 100,
    decisionRef: "dec_sim",
    capturedAt: "2026-04-21T00:00:00.000Z",
  });

  const results = service.simulate([
    { scenarioId: "cut_20", subjectId: "sim_task", reductionPercent: 20 },
    { scenarioId: "cut_50", subjectId: "sim_task", reductionPercent: 50 },
  ]);

  assert.equal(results.length, 2);

  const r20 = results.find((r) => r.scenarioId === "cut_20")!;
  assert.equal(r20.currentCostUsd, 100);
  assert.equal(r20.simulatedCostUsd, 80);
  assert.equal(r20.deltaUsd, -20);

  const r50 = results.find((r) => r.scenarioId === "cut_50")!;
  assert.equal(r50.currentCostUsd, 100);
  assert.equal(r50.simulatedCostUsd, 50);
  assert.equal(r50.deltaUsd, -50);
});

test("CostOptimizationService.simulate handles unknown subject with zero cost", () => {
  const service = new CostOptimizationService();
  const results = service.simulate([
    { scenarioId: "ghost_scenario", subjectId: "ghost_subject", reductionPercent: 10 },
  ]);
  assert.equal(results[0]!.currentCostUsd, 0);
  assert.equal(results[0]!.simulatedCostUsd, 0);
  assert.equal(results[0]!.deltaUsd, 0);
});
