/**
 * Integration Test: Cost Optimization Service
 *
 * Tests cost optimization, attribution, recommendations, and simulation:
 * - Cost attribution recording and aggregation
 * - Recommendation building with risk levels
 * - What-if scenario simulation
 * - Dashboard slice generation
 * - Unsourced record handling
 */
import assert from "node:assert/strict";
import test from "node:test";
import { CostOptimizationService } from "../../../src/ops-maturity/cost-optimizer/cost-optimization-service.js";
test("CostOptimizationService records costs and aggregates by subject", () => {
    const service = new CostOptimizationService();
    service.recordCost({
        subjectType: "agent",
        subjectId: "agent_alpha",
        costType: "model",
        amountUsd: 50.5,
        decisionRef: "dec_model_alpha",
        modelRef: "gpt-5.4",
        capturedAt: "2026-04-20T00:00:00.000Z",
    });
    service.recordCost({
        subjectType: "agent",
        subjectId: "agent_alpha",
        costType: "runtime",
        amountUsd: 25.25,
        decisionRef: "dec_runtime_alpha",
        capturedAt: "2026-04-20T00:05:00.000Z",
    });
    service.recordCost({
        subjectType: "task",
        subjectId: "task_123",
        costType: "tool",
        amountUsd: 10.0,
        decisionRef: "dec_tool_task",
        capturedAt: "2026-04-20T00:10:00.000Z",
    });
    const aggregated = service.aggregate();
    assert.equal(aggregated["agent_alpha"], 75.75);
    assert.equal(aggregated["task_123"], 10.0);
});
test("CostOptimizationService aggregates by subject type filter", () => {
    const service = new CostOptimizationService();
    service.recordCost({
        subjectType: "agent",
        subjectId: "agent_ops",
        costType: "model",
        amountUsd: 100,
        decisionRef: "dec_1",
        capturedAt: "2026-04-20T00:00:00.000Z",
    });
    service.recordCost({
        subjectType: "workflow",
        subjectId: "workflow_svc",
        costType: "runtime",
        amountUsd: 50,
        decisionRef: "dec_2",
        capturedAt: "2026-04-20T00:05:00.000Z",
    });
    service.recordCost({
        subjectType: "model",
        subjectId: "model_minimax",
        costType: "model",
        amountUsd: 200,
        decisionRef: "dec_3",
        modelRef: "minimax-01",
        capturedAt: "2026-04-20T00:10:00.000Z",
    });
    const agentOnly = service.aggregate("agent");
    assert.equal(Object.keys(agentOnly).length, 1);
    assert.equal(agentOnly["agent_ops"], 100);
    const modelOnly = service.aggregate("model");
    assert.equal(Object.keys(modelOnly).length, 1);
    assert.equal(modelOnly["model_minimax"], 200);
});
test("CostOptimizationService builds recommendations with risk levels", () => {
    const service = new CostOptimizationService();
    service.recordCost({
        subjectType: "agent",
        subjectId: "agent_high_cost",
        costType: "model",
        amountUsd: 500,
        decisionRef: "dec_exp",
        modelRef: "gpt-5.4",
        capturedAt: "2026-04-20T00:00:00.000Z",
    });
    service.recordCost({
        subjectType: "agent",
        subjectId: "agent_low_cost",
        costType: "runtime",
        amountUsd: 10,
        decisionRef: "dec_cheap",
        capturedAt: "2026-04-20T00:05:00.000Z",
    });
    const recommendations = service.buildRecommendations();
    assert.equal(recommendations.length, 2);
    const highCostRec = recommendations.find((r) => r.subjectId === "agent_high_cost");
    assert.ok(highCostRec !== undefined);
    assert.ok(highCostRec.riskLevel !== undefined);
});
test("CostOptimizationService simulates what-if scenarios", () => {
    const service = new CostOptimizationService();
    service.recordCost({
        subjectType: "agent",
        subjectId: "agent_sim",
        costType: "model",
        amountUsd: 100,
        decisionRef: "dec_sim",
        modelRef: "gpt-5.4",
        capturedAt: "2026-04-20T00:00:00.000Z",
    });
    const scenarios = service.simulate([
        { scenarioId: "cut_10", subjectId: "agent_sim", reductionPercent: 10 },
        { scenarioId: "cut_25", subjectId: "agent_sim", reductionPercent: 25 },
        { scenarioId: "cut_50", subjectId: "agent_sim", reductionPercent: 50 },
    ]);
    assert.equal(scenarios.length, 3);
    assert.equal(scenarios[0].scenarioId, "cut_10");
    assert.equal(scenarios[0].currentCostUsd, 100);
    assert.ok(scenarios[0].simulatedCostUsd < 100);
    assert.ok(scenarios[0].deltaUsd < 0);
    assert.ok(scenarios[1].simulatedCostUsd < scenarios[0].simulatedCostUsd);
    assert.ok(scenarios[1].simulatedCostUsd < scenarios[0].simulatedCostUsd);
});
test("CostOptimizationService builds dashboard slice with totals", () => {
    const service = new CostOptimizationService();
    service.recordCost({
        subjectType: "agent",
        subjectId: "agent_dash",
        costType: "model",
        amountUsd: 30,
        decisionRef: "dec_dash_1",
        modelRef: "gpt-5.4",
        capturedAt: "2026-04-20T00:00:00.000Z",
    });
    service.recordCost({
        subjectType: "workflow",
        subjectId: "workflow_dash",
        costType: "storage",
        amountUsd: 20,
        decisionRef: "dec_dash_2",
        capturedAt: "2026-04-20T00:05:00.000Z",
    });
    const dashboard = service.buildDashboardSlice("2026-04-20T01:00:00.000Z");
    assert.equal(dashboard.generatedAt, "2026-04-20T01:00:00.000Z");
    assert.equal(dashboard.totalCostUsd, 50);
    assert.equal(dashboard.bySubject["agent_dash"], 30);
    assert.equal(dashboard.bySubject["workflow_dash"], 20);
    assert.equal(dashboard.unsourcedRecordCount, 0);
    assert.ok(Array.isArray(dashboard.recommendations));
});
test("CostOptimizationService throws on unsourced records", () => {
    const service = new CostOptimizationService();
    assert.throws(() => service.recordCost({
        subjectType: "task",
        subjectId: "task_no_decision",
        costType: "runtime",
        amountUsd: 15,
        decisionRef: "",
        capturedAt: "2026-04-20T00:00:00.000Z",
    }), (err) => err.message.includes("unsourced_record"));
});
test("CostOptimizationService counts unsourced records", () => {
    const service = new CostOptimizationService();
    service.recordCost({
        subjectType: "task",
        subjectId: "task_good",
        costType: "runtime",
        amountUsd: 10,
        decisionRef: "dec_valid",
        capturedAt: "2026-04-20T00:00:00.000Z",
    });
    try {
        service.recordCost({
            subjectType: "task",
            subjectId: "task_bad",
            costType: "runtime",
            amountUsd: 5,
            decisionRef: "",
            capturedAt: "2026-04-20T00:05:00.000Z",
        });
    }
    catch {
        // Expected
    }
    const dashboard = service.buildDashboardSlice();
    assert.equal(dashboard.unsourcedRecordCount, 1);
});
test("CostOptimizationService simulates multiple subjects", () => {
    const service = new CostOptimizationService();
    service.recordCost({
        subjectType: "agent",
        subjectId: "agent_a",
        costType: "model",
        amountUsd: 80,
        decisionRef: "dec_a",
        capturedAt: "2026-04-20T00:00:00.000Z",
    });
    service.recordCost({
        subjectType: "agent",
        subjectId: "agent_b",
        costType: "model",
        amountUsd: 120,
        decisionRef: "dec_b",
        capturedAt: "2026-04-20T00:00:00.000Z",
    });
    const scenarios = service.simulate([
        { scenarioId: "cut_a_20", subjectId: "agent_a", reductionPercent: 20 },
        { scenarioId: "cut_b_30", subjectId: "agent_b", reductionPercent: 30 },
    ]);
    assert.equal(scenarios.length, 2);
    const scenarioA = scenarios.find((s) => s.scenarioId === "cut_a_20");
    assert.equal(scenarioA.currentCostUsd, 80);
    assert.equal(scenarioA.simulatedCostUsd, 64);
    const scenarioB = scenarios.find((s) => s.scenarioId === "cut_b_30");
    assert.equal(scenarioB.currentCostUsd, 120);
    assert.equal(scenarioB.simulatedCostUsd, 84);
});
test("CostOptimizationService listRecords returns copy of records", () => {
    const service = new CostOptimizationService();
    service.recordCost({
        subjectType: "agent",
        subjectId: "agent_list",
        costType: "runtime",
        amountUsd: 25,
        decisionRef: "dec_list",
        capturedAt: "2026-04-20T00:00:00.000Z",
    });
    const records = service.listRecords();
    assert.equal(records.length, 1);
    assert.equal(records[0].subjectId, "agent_list");
    // Modifying returned array does not affect internal state
    records.push({});
    const records2 = service.listRecords();
    assert.equal(records2.length, 1);
});
test("CostOptimizationService handles zero records gracefully", () => {
    const service = new CostOptimizationService();
    const aggregated = service.aggregate();
    assert.deepEqual(aggregated, {});
    const dashboard = service.buildDashboardSlice();
    assert.equal(dashboard.totalCostUsd, 0);
    assert.equal(dashboard.unsourcedRecordCount, 0);
    assert.deepEqual(dashboard.bySubject, {});
    const recommendations = service.buildRecommendations();
    assert.equal(recommendations.length, 0);
    const simulations = service.simulate([
        { scenarioId: "sim_1", subjectId: "unknown", reductionPercent: 10 },
    ]);
    assert.equal(simulations[0].currentCostUsd, 0);
    assert.equal(simulations[0].simulatedCostUsd, 0);
});
test("CostOptimizationService risk level adjustment for model costs", () => {
    const service = new CostOptimizationService();
    service.recordCost({
        subjectType: "model",
        subjectId: "model_expensive",
        costType: "model",
        amountUsd: 1000,
        decisionRef: "dec_model",
        modelRef: "gpt-5.4",
        capturedAt: "2026-04-20T00:00:00.000Z",
    });
    const recommendations = service.buildRecommendations("model");
    assert.ok(recommendations.length >= 1);
    const rec = recommendations[0];
    if (rec && rec.riskLevel === "low") {
        assert.equal(rec.riskLevel, "medium");
    }
});
test("CostOptimizationService simulation preserves scenarioId and subjectId", () => {
    const service = new CostOptimizationService();
    service.recordCost({
        subjectType: "workflow",
        subjectId: "workflow_test",
        costType: "network",
        amountUsd: 45.5,
        decisionRef: "dec_net",
        capturedAt: "2026-04-20T00:00:00.000Z",
    });
    const scenarios = service.simulate([
        { scenarioId: "scenario_xyz", subjectId: "workflow_test", reductionPercent: 15 },
    ]);
    assert.equal(scenarios[0].scenarioId, "scenario_xyz");
    assert.equal(scenarios[0].subjectId, "workflow_test");
    assert.ok(scenarios[0].deltaUsd < 0);
});
//# sourceMappingURL=cost-optimization-integration.test.js.map