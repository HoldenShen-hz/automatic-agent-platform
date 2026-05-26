import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateCostAttribution,
  buildCostOptimizationRecommendation,
  CostOptimizationService,
} from "../../../../src/ops-maturity/cost-optimizer/index.js";
import type { ModelMetadataRegistry } from "../../../../src/platform/five-plane-control-plane/config-center/model-metadata-registry.js";

function buildCompatibleDowngradeRegistry(): ModelMetadataRegistry {
  return {
    version: "test",
    providers: {
      minimax: {
        status: "active",
        authMethods: ["api_key"],
      },
    },
    profiles: {
      balanced: {
        provider: "minimax",
        modelId: "MiniMax-M1",
        tier: "balanced",
        capabilities: ["reasoning", "writing", "tool_use"],
        contextWindowTokens: 204800,
        maxOutputTokens: 65536,
        pricing: {
          inputPer1kUsd: 0.003,
          outputPer1kUsd: 0.015,
        },
        metadataSource: "bundled_snapshot",
      },
      "balanced-lite": {
        provider: "minimax",
        modelId: "MiniMax-M1-Lite",
        tier: "fast",
        capabilities: ["tool_use"],
        contextWindowTokens: 131072,
        maxOutputTokens: 32768,
        pricing: {
          inputPer1kUsd: 0.001,
          outputPer1kUsd: 0.005,
        },
        metadataSource: "bundled_snapshot",
      },
    },
  };
}

function makeCostRecord(overrides: Record<string, unknown>) {
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

test("aggregateCostAttribution sums amounts per subjectId", () => {
  const entries = [
    { subjectId: "task_1", llmCostUsd: 10, toolCostUsd: 0, computeCostUsd: 0, storageCostUsd: 0, egressCostUsd: 0, humanReviewCostUsd: 0 },
    { subjectId: "task_1", llmCostUsd: 5, toolCostUsd: 0, computeCostUsd: 0, storageCostUsd: 0, egressCostUsd: 0, humanReviewCostUsd: 0 },
    { subjectId: "task_2", llmCostUsd: 3, toolCostUsd: 0, computeCostUsd: 0, storageCostUsd: 0, egressCostUsd: 0, humanReviewCostUsd: 0 },
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
  const record = service.recordCost(makeCostRecord({
    subjectType: "task",
    subjectId: "task_x",
    costType: "llm",
    llmCostUsd: 25,
    amountUsd: 25,
    decisionRef: "dec_001",
    modelRef: "claude-3-7",
    capturedAt: "2026-04-21T00:00:00.000Z",
  }));
  assert.equal(record.subjectId, "task_x");
  assert.equal(record.amountUsd, 25);
  assert.deepEqual(service.listRecords(), [record]);
});

test("CostOptimizationService.recordCost throws for empty decisionRef", () => {
  const service = new CostOptimizationService();
  assert.throws(
    () =>
      service.recordCost({
        llmCostUsd: 2,
        toolCostUsd: 0,
        computeCostUsd: 0,
        storageCostUsd: 0,
        egressCostUsd: 0,
        humanReviewCostUsd: 0,
        subjectType: "task",
        subjectId: "task_y",
        costType: "llm",
        amountUsd: 2,
        decisionRef: "   ",
        capturedAt: "2026-04-21T00:00:00.000Z",
      }),
    /cost_optimizer\.unsourced_record/,
  );
});

test("CostOptimizationService never drives unsourcedRecordCount below zero after valid records", () => {
  const service = new CostOptimizationService();

  service.recordCost(makeCostRecord({
    subjectType: "task",
    subjectId: "task_clean",
    costType: "llm",
    llmCostUsd: 1,
    amountUsd: 1,
    decisionRef: "dec_clean_1",
    capturedAt: "2026-04-21T00:00:00.000Z",
  }));
  service.recordCost(makeCostRecord({
    subjectType: "task",
    subjectId: "task_clean",
    costType: "llm",
    llmCostUsd: 1,
    amountUsd: 1,
    decisionRef: "dec_clean_2",
    capturedAt: "2026-04-21T00:01:00.000Z",
  }));

  assert.equal(service.buildDashboardSlice().unsourcedRecordCount, 0);
});

test("CostOptimizationService.aggregate returns per-subject totals", () => {
  const service = new CostOptimizationService();
  service.recordCost(makeCostRecord({
    subjectType: "agent",
    subjectId: "agent_alpha",
    costType: "compute",
    computeCostUsd: 10,
    amountUsd: 10,
    decisionRef: "dec_1",
    capturedAt: "2026-04-21T00:00:00.000Z",
  }));
  service.recordCost(makeCostRecord({
    subjectType: "agent",
    subjectId: "agent_alpha",
    costType: "storage",
    storageCostUsd: 5,
    amountUsd: 5,
    decisionRef: "dec_2",
    capturedAt: "2026-04-21T00:01:00.000Z",
  }));
  service.recordCost(makeCostRecord({
    subjectType: "model",
    subjectId: "model_beta",
    costType: "llm",
    llmCostUsd: 20,
    amountUsd: 20,
    decisionRef: "dec_3",
    modelRef: "gpt-5",
    capturedAt: "2026-04-21T00:02:00.000Z",
  }));

  const all = service.aggregate();
  assert.equal(all["agent_alpha"], 15);
  assert.equal(all["model_beta"], 20);

  const agentsOnly = service.aggregate("agent");
  assert.equal(agentsOnly["agent_alpha"], 15);
  assert.equal(agentsOnly["model_beta"], undefined);
});

test("CostOptimizationService.aggregate returns empty when no records match filter", () => {
  const service = new CostOptimizationService();
  service.recordCost(makeCostRecord({
    subjectType: "task",
    subjectId: "task_z",
    costType: "egress",
    egressCostUsd: 1,
    amountUsd: 1,
    decisionRef: "dec_1",
    capturedAt: "2026-04-21T00:00:00.000Z",
  }));
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
  assert.equal(result.riskLevel, "medium");
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
    registry: buildCompatibleDowngradeRegistry(),
  });
  assert.ok(result != null);
  assert.equal(result.action, "downgrade_model");
  assert.equal(result.currentModelRef, "balanced");
  assert.ok(typeof result.recommendedModelRef === "string");
});

test("buildCostOptimizationRecommendation keeps right_size when cheaper peers are capability-incompatible", () => {
  const result = buildCostOptimizationRecommendation("model_heavy_task", 200, {
    modelRef: "balanced",
  });
  assert.ok(result != null);
  assert.equal(result.action, "right_size");
  assert.equal(result.recommendedModelRef, undefined);
});

test("CostOptimizationService.buildRecommendations generates recommendations for subjects with cost >= 10", () => {
  const service = new CostOptimizationService();
  service.recordCost(makeCostRecord({
    subjectType: "workflow",
    subjectId: "wf_cheap",
    costType: "tool",
    toolCostUsd: 5,
    amountUsd: 5,
    decisionRef: "dec_wf_cheap",
    capturedAt: "2026-04-21T00:00:00.000Z",
  }));
  service.recordCost(makeCostRecord({
    subjectType: "workflow",
    subjectId: "wf_normal",
    costType: "llm",
    llmCostUsd: 50,
    amountUsd: 50,
    decisionRef: "dec_wf_normal",
    modelRef: "claude-3-7",
    capturedAt: "2026-04-21T00:00:00.000Z",
  }));
  service.recordCost(makeCostRecord({
    subjectType: "agent",
    subjectId: "agent_expensive",
    costType: "compute",
    computeCostUsd: 200,
    amountUsd: 200,
    decisionRef: "dec_agent_expensive",
    capturedAt: "2026-04-21T00:00:00.000Z",
  }));

  const recommendations = service.buildRecommendations();
  assert.equal(recommendations.length, 2);

  const wfRec = recommendations.find((r) => r.subjectId === "wf_normal");
  assert.ok(wfRec != null);
  assert.equal(wfRec.riskLevel, "medium");

  const agentRec = recommendations.find((r) => r.subjectId === "agent_expensive");
  assert.ok(agentRec != null);
  assert.equal(agentRec.estimatedSavingsUsd, 30);
  assert.equal(agentRec.riskLevel, "medium");
});

test("CostOptimizationService.upgrades risk to medium when subject has model costType and base risk is low", () => {
  const service = new CostOptimizationService();
  service.recordCost(makeCostRecord({
    subjectType: "model",
    subjectId: "model_with_model_cost",
    costType: "llm",
    llmCostUsd: 50,
    amountUsd: 50,
    decisionRef: "dec_model",
    modelRef: "claude-3-7",
    capturedAt: "2026-04-21T00:00:00.000Z",
  }));

  const recommendations = service.buildRecommendations("model");
  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0]!.riskLevel, "medium");
});

test("CostOptimizationService.buildDashboardSlice includes all expected fields", () => {
  const service = new CostOptimizationService();
  service.recordCost(makeCostRecord({
    subjectType: "task",
    subjectId: "dash_task",
    costType: "llm",
    llmCostUsd: 120,
    amountUsd: 120,
    decisionRef: "dec_dash",
    capturedAt: "2026-04-21T00:00:00.000Z",
  }));

  const slice = service.buildDashboardSlice("2026-04-21T12:00:00.000Z");
  assert.equal(slice.generatedAt, "2026-04-21T12:00:00.000Z");
  assert.equal(slice.totalCostUsd, 120);
  assert.deepEqual(slice.bySubject, { dash_task: 120 });
  assert.equal(slice.unsourcedRecordCount, 0);
  assert.ok(slice.recommendations.length > 0);
});

test("CostOptimizationService.listRecords returns a copy of records", () => {
  const service = new CostOptimizationService();
  service.recordCost(makeCostRecord({
    subjectType: "task",
    subjectId: "list_task",
    costType: "compute",
    computeCostUsd: 1,
    amountUsd: 1,
    decisionRef: "dec_list",
    capturedAt: "2026-04-21T00:00:00.000Z",
  }));

  const records = service.listRecords();
  records.push(makeCostRecord({ subjectType: "task", subjectId: "tampered", costType: "tool", toolCostUsd: 0, amountUsd: 0, decisionRef: "x", capturedAt: "2026-04-21T00:00:00.000Z" }) as any);

  assert.equal(service.listRecords().length, 1);
});

test("CostOptimizationService.simulate returns correct delta and values", () => {
  const service = new CostOptimizationService();
  service.recordCost(makeCostRecord({
    subjectType: "task",
    subjectId: "sim_task",
    costType: "llm",
    llmCostUsd: 100,
    amountUsd: 100,
    decisionRef: "dec_sim",
    capturedAt: "2026-04-21T00:00:00.000Z",
  }));

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

test("CostOptimizationService.recordCost accepts all 7 dimension fields per §64.1", () => {
  const service = new CostOptimizationService();
  const record = service.recordCost({
    harness_run_id: "harness-123",
    node_run_id: "node-456",
    subjectType: "workflow",
    subjectId: "wf-7dim",
    costType: "llm",
    amountUsd: 45.5,
    llmCostUsd: 30,
    toolCostUsd: 8,
    computeCostUsd: 4,
    storageCostUsd: 2,
    egressCostUsd: 1,
    humanReviewCostUsd: 0.5,
    qualityRisk: "low",
    decisionRef: "dec-7dim",
    modelRef: "claude-3-7",
    capturedAt: "2026-05-11T00:00:00.000Z",
  });
  assert.equal(record.amountUsd, 45.5);
  assert.equal(record.llmCostUsd, 30);
  assert.equal(record.toolCostUsd, 8);
  assert.equal(record.computeCostUsd, 4);
  assert.equal(record.storageCostUsd, 2);
  assert.equal(record.egressCostUsd, 1);
  assert.equal(record.humanReviewCostUsd, 0.5);
  assert.deepEqual(service.listRecords(), [record]);
});

test("CostOptimizationService.aggregate correctly sums 7-dimension breakdown per subject", () => {
  const service = new CostOptimizationService();
  // Record with all 7 dimensions populated
  service.recordCost({
    subjectType: "agent",
    subjectId: "agent-7dim",
    costType: "llm",
    llmCostUsd: 50,
    toolCostUsd: 20,
    computeCostUsd: 10,
    storageCostUsd: 5,
    egressCostUsd: 3,
    humanReviewCostUsd: 2,
    amountUsd: 90, // total of above
    decisionRef: "dec-7dim-1",
    capturedAt: "2026-05-11T00:00:00.000Z",
  });
  // Second record for same subject with different dimensions
  service.recordCost({
    subjectType: "agent",
    subjectId: "agent-7dim",
    costType: "compute",
    llmCostUsd: 25,
    toolCostUsd: 10,
    computeCostUsd: 5,
    storageCostUsd: 2.5,
    egressCostUsd: 1.5,
    humanReviewCostUsd: 1,
    amountUsd: 45, // total of above
    decisionRef: "dec-7dim-2",
    capturedAt: "2026-05-11T00:01:00.000Z",
  });

  const result = service.aggregate("agent");
  // Both records have amountUsd, so sum = 90 + 45 = 135
  assert.equal(result["agent-7dim"], 135);
});

test("CostOptimizationService.aggregate falls back to 7-dimension sum when amountUsd absent", () => {
  const service = new CostOptimizationService();
  // Record with individual dimensions but no amountUsd
  service.recordCost({
    subjectType: "task",
    subjectId: "task-dim-only",
    costType: "llm",
    llmCostUsd: 15,
    toolCostUsd: 5,
    computeCostUsd: 3,
    storageCostUsd: 1,
    egressCostUsd: 1,
    humanReviewCostUsd: 0.5,
    // amountUsd intentionally omitted
    decisionRef: "dec-dim-only",
    capturedAt: "2026-05-11T00:00:00.000Z",
  });

  const result = service.aggregate("task");
  // Sum of 7 dimensions: 15+5+3+1+1+0.5 = 25.5
  assert.equal(result["task-dim-only"], 25.5);
});

test("CostOptimizationService aggregates multiple subjects each with 7-dimension records", () => {
  const service = new CostOptimizationService();
  service.recordCost({
    subjectType: "workflow",
    subjectId: "wf-A",
    costType: "llm",
    llmCostUsd: 100,
    toolCostUsd: 50,
    computeCostUsd: 25,
    storageCostUsd: 10,
    egressCostUsd: 5,
    humanReviewCostUsd: 10,
    amountUsd: 200,
    decisionRef: "dec-wf-A",
    capturedAt: "2026-05-11T00:00:00.000Z",
  });
  service.recordCost({
    subjectType: "workflow",
    subjectId: "wf-B",
    costType: "tool",
    llmCostUsd: 80,
    toolCostUsd: 40,
    computeCostUsd: 20,
    storageCostUsd: 8,
    egressCostUsd: 4,
    humanReviewCostUsd: 8,
    amountUsd: 160,
    decisionRef: "dec-wf-B",
    capturedAt: "2026-05-11T00:01:00.000Z",
  });
  service.recordCost({
    subjectType: "agent",
    subjectId: "agent-X",
    costType: "compute",
    llmCostUsd: 60,
    toolCostUsd: 30,
    computeCostUsd: 15,
    storageCostUsd: 6,
    egressCostUsd: 3,
    humanReviewCostUsd: 6,
    amountUsd: 120,
    decisionRef: "dec-agent-X",
    capturedAt: "2026-05-11T00:02:00.000Z",
  });

  const all = service.aggregate();
  assert.equal(all["wf-A"], 200);
  assert.equal(all["wf-B"], 160);
  assert.equal(all["agent-X"], 120);

  const workflowsOnly = service.aggregate("workflow");
  assert.equal(workflowsOnly["wf-A"], 200);
  assert.equal(workflowsOnly["wf-B"], 160);
  assert.strictEqual(workflowsOnly["agent-X"], undefined);
});
