/**
 * Unit tests for summarizeBudgetProposal function.
 *
 * Tests human-readable summary generation for budget adjustment proposals.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { summarizeBudgetProposal } from "../../../../../src/ops-maturity/drift-detection/evolution-mvp-support.js";
test("summarizeBudgetProposal generates summary for division scope", () => {
    const summary = summarizeBudgetProposal("division", "div-123", {
        currentPolicy: {
            maxTaskCostUsd: 0.10,
            maxDailyCostUsd: 1.0,
            maxMonthlyCostUsd: 10.0,
            warnAtRatio: 0.8,
            mode: "supervised",
        },
        recommendedPolicy: {
            maxTaskCostUsd: 0.12,
            maxDailyCostUsd: 1.2,
            maxMonthlyCostUsd: 12.0,
            warnAtRatio: 0.85,
            mode: "supervised",
        },
        observedAverageCostUsd: 0.09,
        sampleSize: 10,
        successRate: 0.95,
        proposalReason: "Normal increase",
    });
    assert.ok(typeof summary === "string");
    assert.ok(summary.length > 0);
    assert.ok(summary.includes("division:div-123"));
    assert.ok(summary.includes("0.0900 USD"));
});
test("summarizeBudgetProposal generates summary for role scope", () => {
    const summary = summarizeBudgetProposal("role", "role-456", {
        currentPolicy: {
            maxTaskCostUsd: 0.10,
            maxDailyCostUsd: 1.0,
            maxMonthlyCostUsd: 10.0,
            warnAtRatio: 0.8,
            mode: "supervised",
        },
        recommendedPolicy: {
            maxTaskCostUsd: 0.08,
            maxDailyCostUsd: 0.8,
            maxMonthlyCostUsd: 8.0,
            warnAtRatio: 0.75,
            mode: "supervised",
        },
        observedAverageCostUsd: 0.04,
        sampleSize: 20,
        successRate: 0.98,
        proposalReason: "Decreasing budget",
    });
    assert.ok(summary.includes("role:role-456"));
});
test("summarizeBudgetProposal generates summary for task_intent scope", () => {
    const summary = summarizeBudgetProposal("task_intent", "ti-789", {
        currentPolicy: {
            maxTaskCostUsd: 0.10,
            maxDailyCostUsd: 1.0,
            maxMonthlyCostUsd: 10.0,
            warnAtRatio: 0.8,
            mode: "supervised",
        },
        recommendedPolicy: {
            maxTaskCostUsd: 0.10,
            maxDailyCostUsd: 1.0,
            maxMonthlyCostUsd: 10.0,
            warnAtRatio: 0.8,
            mode: "supervised",
        },
        observedAverageCostUsd: 0.05,
        sampleSize: 15,
        successRate: 0.90,
        proposalReason: "Keep same",
    });
    assert.ok(summary.includes("task_intent:ti-789"));
});
test("summarizeBudgetProposal includes maxTaskCostUsd changes", () => {
    const summary = summarizeBudgetProposal("division", "div-123", {
        currentPolicy: {
            maxTaskCostUsd: 0.10,
            maxDailyCostUsd: 1.0,
            maxMonthlyCostUsd: 10.0,
            warnAtRatio: 0.8,
            mode: "supervised",
        },
        recommendedPolicy: {
            maxTaskCostUsd: 0.15,
            maxDailyCostUsd: 1.5,
            maxMonthlyCostUsd: 15.0,
            warnAtRatio: 0.85,
            mode: "supervised",
        },
        observedAverageCostUsd: 0.12,
        sampleSize: 8,
        successRate: 0.92,
        proposalReason: "Increase needed",
    });
    assert.ok(summary.includes("0.1000"));
    assert.ok(summary.includes("0.1500"));
});
test("summarizeBudgetProposal handles large numbers", () => {
    const summary = summarizeBudgetProposal("division", "div-large", {
        currentPolicy: {
            maxTaskCostUsd: 1000.00,
            maxDailyCostUsd: 10000.00,
            maxMonthlyCostUsd: 100000.00,
            warnAtRatio: 0.8,
            mode: "supervised",
        },
        recommendedPolicy: {
            maxTaskCostUsd: 1200.00,
            maxDailyCostUsd: 12000.00,
            maxMonthlyCostUsd: 120000.00,
            warnAtRatio: 0.85,
            mode: "supervised",
        },
        observedAverageCostUsd: 950.00,
        sampleSize: 100,
        successRate: 0.99,
        proposalReason: "Large scale increase",
    });
    assert.ok(summary.includes("division:div-large"));
    assert.ok(summary.includes("1000.0000"));
    assert.ok(summary.includes("1200.0000"));
});
test("summarizeBudgetProposal handles small numbers", () => {
    const summary = summarizeBudgetProposal("division", "div-small", {
        currentPolicy: {
            maxTaskCostUsd: 0.001,
            maxDailyCostUsd: 0.01,
            maxMonthlyCostUsd: 0.1,
            warnAtRatio: 0.8,
            mode: "supervised",
        },
        recommendedPolicy: {
            maxTaskCostUsd: 0.0012,
            maxDailyCostUsd: 0.012,
            maxMonthlyCostUsd: 0.12,
            warnAtRatio: 0.85,
            mode: "supervised",
        },
        observedAverageCostUsd: 0.0009,
        sampleSize: 50,
        successRate: 0.97,
        proposalReason: "Small increase",
    });
    assert.ok(summary.includes("division:div-small"));
});
test("summarizeBudgetProposal includes sample size", () => {
    const summary = summarizeBudgetProposal("division", "div-123", {
        currentPolicy: {
            maxTaskCostUsd: 0.10,
            maxDailyCostUsd: 1.0,
            maxMonthlyCostUsd: 10.0,
            warnAtRatio: 0.8,
            mode: "supervised",
        },
        recommendedPolicy: {
            maxTaskCostUsd: 0.12,
            maxDailyCostUsd: 1.2,
            maxMonthlyCostUsd: 12.0,
            warnAtRatio: 0.85,
            mode: "supervised",
        },
        observedAverageCostUsd: 0.09,
        sampleSize: 100,
        successRate: 0.95,
        proposalReason: "Many samples",
    });
    assert.ok(summary.includes("100 samples"));
});
//# sourceMappingURL=evolution-mvp-summarize-budget.test.js.map