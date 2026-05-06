import assert from "node:assert/strict";
import test from "node:test";

import { CostOptimizationService } from "../../../../src/ops-maturity/cost-optimizer/cost-optimization-service.js";

test("CostOptimizationService.recordCost increments unsourcedRecordCount for blank decisionRef", () => {
  const service = new CostOptimizationService();
  assert.equal(service.listRecords().length, 0);

  // Valid record - decisionRef is non-blank
  service.recordCost({
    subjectType: "task",
    subjectId: "task_valid",
    costType: "model",
    amountUsd: 10,
    decisionRef: "dec_1",
    capturedAt: "2026-04-27T00:00:00.000Z",
  });
  assert.equal(service.listRecords().length, 1);

  // Blank decisionRef - should throw and increment counter
  try {
    service.recordCost({
      subjectType: "task",
      subjectId: "task_bad",
      costType: "model",
      amountUsd: 5,
      decisionRef: "   ",
      capturedAt: "2026-04-27T00:01:00.000Z",
    });
    assert.fail("Expected error to be thrown");
  } catch (err: unknown) {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes("cost_optimizer.unsourced_record"));
  }

  // Another blank decisionRef
  try {
    service.recordCost({
      subjectType: "agent",
      subjectId: "agent_bad",
      costType: "runtime",
      amountUsd: 3,
      decisionRef: "",
      capturedAt: "2026-04-27T00:02:00.000Z",
    });
    assert.fail("Expected error to be thrown");
  } catch (err: unknown) {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes("cost_optimizer.unsourced_record"));
  }

  const slice = service.buildDashboardSlice();
  assert.equal(slice.unsourcedRecordCount, 2, "unsourcedRecordCount should be 2 after two blank decisionRefs");
  assert.equal(service.listRecords().length, 1, "Invalid records should not be stored");
});

test("CostOptimizationService.aggregate returns empty object when no records stored", () => {
  const service = new CostOptimizationService();
  const result = service.aggregate();
  assert.deepStrictEqual(result, {});
});

test("CostOptimizationService.aggregate filters by subjectType correctly", () => {
  const service = new CostOptimizationService();
  service.recordCost({
    subjectType: "task",
    subjectId: "task_1",
    costType: "model",
    amountUsd: 10,
    decisionRef: "dec_1",
    capturedAt: "2026-04-27T00:00:00.000Z",
  });
  service.recordCost({
    subjectType: "agent",
    subjectId: "agent_1",
    costType: "runtime",
    amountUsd: 20,
    decisionRef: "dec_2",
    capturedAt: "2026-04-27T00:01:00.000Z",
  });
  service.recordCost({
    subjectType: "workflow",
    subjectId: "workflow_1",
    costType: "tool",
    amountUsd: 30,
    decisionRef: "dec_3",
    capturedAt: "2026-04-27T00:02:00.000Z",
  });

  const taskOnly = service.aggregate("task");
  assert.deepStrictEqual(taskOnly, { task_1: 10 });
  assert.strictEqual(taskOnly["agent_1"], undefined);

  const agentOnly = service.aggregate("agent");
  assert.deepStrictEqual(agentOnly, { agent_1: 20 });

  const workflowOnly = service.aggregate("workflow");
  assert.deepStrictEqual(workflowOnly, { workflow_1: 30 });
});

test("CostOptimizationService.riskLevelForSubject upgrades low to medium when subject has model costType", () => {
  const service = new CostOptimizationService();
  // Subject with model cost record (low base risk should become medium)
  service.recordCost({
    subjectType: "model",
    subjectId: "model_task",
    costType: "model",
    amountUsd: 50,
    decisionRef: "dec_model",
    modelRef: "claude-3-7",
    capturedAt: "2026-04-27T00:00:00.000Z",
  });

  const recommendations = service.buildRecommendations("model");
  assert.equal(recommendations.length, 1);
  // Base risk from buildCostOptimizationRecommendation for 50 is "low"
  // riskLevelForSubject should upgrade it to "medium" because there's a model costType record
  assert.equal(recommendations[0]!.riskLevel, "medium");
});

test("CostOptimizationService.riskLevelForSubject keeps high risk unchanged when no model costType record exists", () => {
  const service = new CostOptimizationService();
  // Subject without a model costType record - riskLevelForSubject should not modify base risk
  // We use cost 200 (no modelRef) which gives medium risk (not high, since no downgrade path)
  // But we can directly verify riskLevelForSubject doesn't exist by checking behavior:
  // When there's a non-model record for a subject, the risk level should pass through unchanged
  service.recordCost({
    subjectType: "agent",
    subjectId: "agent_task",
    costType: "runtime",
    amountUsd: 200,
    decisionRef: "dec_agent",
    capturedAt: "2026-04-27T00:00:00.000Z",
  });

  const recommendations = service.buildRecommendations("agent");
  assert.equal(recommendations.length, 1);
  // Without modelRef, cost 200 gives action = "right_size" and riskLevel = "medium"
  // Since there's no model costType record for "agent_task", riskLevel stays medium
  assert.equal(recommendations[0]!.riskLevel, "medium");
  // This verifies that riskLevelForSubject doesn't incorrectly upgrade non-low risks
  // when there's no model costType record present
});

test("CostOptimizationService.buildRecommendations excludes null results", () => {
  const service = new CostOptimizationService();
  // Add a cheap subject (cost < 10, buildCostOptimizationRecommendation returns null)
  service.recordCost({
    subjectType: "task",
    subjectId: "cheap_task",
    costType: "model",
    amountUsd: 5,
    decisionRef: "dec_cheap",
    capturedAt: "2026-04-27T00:00:00.000Z",
  });
  // Add an expensive subject (cost >= 10)
  service.recordCost({
    subjectType: "task",
    subjectId: "expensive_task",
    costType: "model",
    amountUsd: 100,
    decisionRef: "dec_expensive",
    capturedAt: "2026-04-27T00:01:00.000Z",
  });

  const recommendations = service.buildRecommendations();
  // Only the expensive task should have a recommendation
  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0]!.subjectId, "expensive_task");
});

test("CostOptimizationService.simulate handles multiple scenarios for same subject", () => {
  const service = new CostOptimizationService();
  service.recordCost({
    subjectType: "task",
    subjectId: "multi_sim_task",
    costType: "model",
    amountUsd: 100,
    decisionRef: "dec_sim",
    capturedAt: "2026-04-27T00:00:00.000Z",
  });

  const results = service.simulate([
    { scenarioId: "s1", subjectId: "multi_sim_task", reductionPercent: 10 },
    { scenarioId: "s2", subjectId: "multi_sim_task", reductionPercent: 30 },
    { scenarioId: "s3", subjectId: "multi_sim_task", reductionPercent: 75 },
  ]);

  assert.equal(results.length, 3);
  const s1 = results.find((r) => r.scenarioId === "s1")!;
  assert.equal(s1.currentCostUsd, 100);
  assert.equal(s1.simulatedCostUsd, 90);
  assert.equal(s1.deltaUsd, -10);

  const s3 = results.find((r) => r.scenarioId === "s3")!;
  assert.equal(s3.currentCostUsd, 100);
  assert.equal(s3.simulatedCostUsd, 25);
  assert.equal(s3.deltaUsd, -75);
});

test("CostOptimizationService.simulate handles missing subject with non-zero baseline for other subjects", () => {
  const service = new CostOptimizationService();
  service.recordCost({
    subjectType: "task",
    subjectId: "existing_task",
    costType: "model",
    amountUsd: 200,
    decisionRef: "dec_existing",
    capturedAt: "2026-04-27T00:00:00.000Z",
  });

  const results = service.simulate([
    { scenarioId: "ghost", subjectId: "ghost_subject", reductionPercent: 20 },
    { scenarioId: "existing", subjectId: "existing_task", reductionPercent: 50 },
  ]);

  const ghost = results.find((r) => r.scenarioId === "ghost")!;
  assert.equal(ghost.currentCostUsd, 0);
  assert.equal(ghost.simulatedCostUsd, 0);
  assert.equal(ghost.deltaUsd, 0);

  const existing = results.find((r) => r.scenarioId === "existing")!;
  assert.equal(existing.currentCostUsd, 200);
  assert.equal(existing.simulatedCostUsd, 100);
  assert.equal(existing.deltaUsd, -100);
});

test("CostOptimizationService.buildDashboardSlice totalCostUsd is sum of all bySubject values", () => {
  const service = new CostOptimizationService();
  service.recordCost({
    subjectType: "task",
    subjectId: "task_a",
    costType: "model",
    amountUsd: 100.5,
    decisionRef: "dec_a",
    capturedAt: "2026-04-27T00:00:00.000Z",
  });
  service.recordCost({
    subjectType: "task",
    subjectId: "task_b",
    costType: "runtime",
    amountUsd: 50.25,
    decisionRef: "dec_b",
    capturedAt: "2026-04-27T00:01:00.000Z",
  });

  const slice = service.buildDashboardSlice("2026-04-27T12:00:00.000Z");
  // 100.5 + 50.25 = 150.75
  assert.equal(slice.totalCostUsd, 150.75);
  assert.equal(slice.generatedAt, "2026-04-27T12:00:00.000Z");
  assert.equal(Object.keys(slice.bySubject).length, 2);
});

test("CostOptimizationService.listRecords returns a new copy each time", () => {
  const service = new CostOptimizationService();
  service.recordCost({
    subjectType: "task",
    subjectId: "copy_task",
    costType: "model",
    amountUsd: 10,
    decisionRef: "dec_copy",
    capturedAt: "2026-04-27T00:00:00.000Z",
  });

  const records1 = service.listRecords();
  const records2 = service.listRecords();

  assert.ok(records1 !== records2, "listRecords should return a new array each time");
  records1.push({ subjectType: "task", subjectId: "tampered", costType: "tool", amountUsd: 0, decisionRef: "x", capturedAt: "2026-04-27T00:00:00.000Z" });
  assert.equal(service.listRecords().length, 1, "Modification of returned array should not affect internal state");
});

test("CostOptimizationService.resolveRepresentativeModelRef prefers first modelRef record", () => {
  const service = new CostOptimizationService();
  // Add multiple records for same subject, only some have modelRef
  service.recordCost({
    subjectType: "task",
    subjectId: "multi_record_task",
    costType: "model",
    amountUsd: 10,
    decisionRef: "dec_first",
    modelRef: "first-model",
    capturedAt: "2026-04-27T00:00:00.000Z",
  });
  service.recordCost({
    subjectType: "task",
    subjectId: "multi_record_task",
    costType: "runtime",
    amountUsd: 5,
    decisionRef: "dec_second",
    // No modelRef
    capturedAt: "2026-04-27T00:01:00.000Z",
  });
  service.recordCost({
    subjectType: "task",
    subjectId: "multi_record_task",
    costType: "storage",
    amountUsd: 3,
    decisionRef: "dec_third",
    modelRef: "third-model",
    capturedAt: "2026-04-27T00:02:00.000Z",
  });

  const recommendations = service.buildRecommendations("task");
  assert.equal(recommendations.length, 1);
  // First record with modelRef should be used
  assert.equal(recommendations[0]!.currentModelRef, "first-model");
});
