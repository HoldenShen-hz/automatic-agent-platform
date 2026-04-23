import assert from "node:assert/strict";
import test from "node:test";
// Barrel test for evolution module
import { roundCurrency, roundRatio, } from "../../../../src/ops-maturity/drift-detection/index.js";
test("BudgetAdjustmentEvidence structure is correct", () => {
    const evidence = {
        currentPolicy: {
            maxTaskCostUsd: 1.0,
            maxDailyCostUsd: 10.0,
            maxMonthlyCostUsd: 100.0,
            warnAtRatio: 0.8,
            mode: "supervised",
        },
        recommendedPolicy: {
            maxTaskCostUsd: 2.0,
            maxDailyCostUsd: 20.0,
            maxMonthlyCostUsd: 200.0,
            warnAtRatio: 0.8,
            mode: "supervised",
        },
        observedAverageCostUsd: 1.5,
        sampleSize: 100,
        successRate: 0.95,
        proposalReason: "Observed lower costs than budgeted",
    };
    assert.equal(evidence.observedAverageCostUsd, 1.5);
    assert.equal(evidence.sampleSize, 100);
    assert.equal(evidence.successRate, 0.95);
    assert.equal(evidence.currentPolicy.maxTaskCostUsd, 1.0);
    assert.equal(evidence.recommendedPolicy.maxTaskCostUsd, 2.0);
});
test("ExperiencePromotionEvidence structure is correct", () => {
    const evidence = {
        taskContext: "Writing unit tests",
        taskIntent: "Improve test coverage",
        queryTools: ["read", "edit"],
        matchedExperienceId: "exp_123",
        similarityScore: 0.92,
        matchedKeywords: ["test", "coverage"],
        proposedSummary: "Improved test coverage through refactoring",
    };
    assert.equal(evidence.matchedExperienceId, "exp_123");
    assert.equal(evidence.similarityScore, 0.92);
    assert.deepEqual(evidence.matchedKeywords, ["test", "coverage"]);
});
test("BudgetAdjustmentProposalPayload structure is correct", () => {
    const payload = {
        kind: "budget_adjustment",
        recommendedPolicy: {
            maxTaskCostUsd: 2.0,
            maxDailyCostUsd: 20.0,
            maxMonthlyCostUsd: 200.0,
            warnAtRatio: 0.8,
            mode: "supervised",
        },
        baselinePolicy: {
            maxTaskCostUsd: 1.0,
            maxDailyCostUsd: 10.0,
            maxMonthlyCostUsd: 100.0,
            warnAtRatio: 0.8,
            mode: "supervised",
        },
        observedAverageCostUsd: 1.5,
        sampleSize: 100,
        successRate: 0.95,
        proposalReason: "Observed lower costs than budgeted",
    };
    assert.equal(payload.kind, "budget_adjustment");
    assert.equal(payload.observedAverageCostUsd, 1.5);
    assert.equal(payload.recommendedPolicy.maxTaskCostUsd, 2.0);
});
test("ExperiencePromotionProposalPayload structure is correct", () => {
    const payload = {
        kind: "experience_promotion",
        sourceExperienceId: "exp_456",
        sourceTaskContext: "Writing tests",
        sourceTaskIntent: "Improve coverage",
        targetScope: "division:engineering",
        promotedSummary: "Effective testing patterns",
        qualityScore: 0.88,
        matchedKeywords: ["test", "quality"],
    };
    assert.equal(payload.kind, "experience_promotion");
    assert.equal(payload.sourceExperienceId, "exp_456");
    assert.equal(payload.qualityScore, 0.88);
});
test("EvolutionProposalPayload can be budget adjustment", () => {
    const payload = {
        kind: "budget_adjustment",
        recommendedPolicy: {
            maxTaskCostUsd: 2.0,
            maxDailyCostUsd: 20.0,
            maxMonthlyCostUsd: 200.0,
            warnAtRatio: 0.8,
            mode: "supervised",
        },
        baselinePolicy: {
            maxTaskCostUsd: 1.0,
            maxDailyCostUsd: 10.0,
            maxMonthlyCostUsd: 100.0,
            warnAtRatio: 0.8,
            mode: "supervised",
        },
        observedAverageCostUsd: 1.5,
        sampleSize: 100,
        successRate: 0.95,
        proposalReason: "test",
    };
    const unionPayload = payload;
    assert.equal(unionPayload.kind, "budget_adjustment");
});
test("EvolutionProposalPayload can be experience promotion", () => {
    const payload = {
        kind: "experience_promotion",
        sourceExperienceId: "exp_789",
        sourceTaskContext: "Code review",
        sourceTaskIntent: "Improve quality",
        targetScope: "division:engineering",
        promotedSummary: "Effective review patterns",
        qualityScore: 0.85,
        matchedKeywords: ["review", "quality"],
    };
    const unionPayload = payload;
    assert.equal(unionPayload.kind, "experience_promotion");
});
test("roundCurrency rounds to 4 decimal places", () => {
    assert.equal(roundCurrency(1.2345678), 1.2346);
    assert.equal(roundCurrency(1.234567), 1.2346);
    assert.equal(roundCurrency(1.9999999), 2.0);
});
test("roundRatio rounds to 3 decimal places", () => {
    assert.equal(roundRatio(0.12345), 0.123);
    assert.equal(roundRatio(0.1235), 0.124);
    assert.equal(roundRatio(0.99999), 1.0);
});
// Note: parsePolicyValue and parseProposalPayload require EvolutionPolicyRecord/EvoltionProposalRecord
// which have complex dependencies and are not suitable for simple barrel testing
//# sourceMappingURL=index.test.js.map