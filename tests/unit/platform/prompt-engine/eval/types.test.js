/**
 * Unit tests for QualityGateConfig and QualityEvaluationEvidence types
 *
 * @see src/platform/prompt-engine/eval/types.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
function createMockQualityGateConfig(overrides = {}) {
    return {
        qualityGate: {
            defaultPassThreshold: 0.8,
            criticalPassThreshold: 0.95,
            enforcement: "blocking",
        },
        qualityScoreWeights: {
            successSignal: 0.4,
            completionOutcome: 0.2,
            failureSignal: 0.3,
            partialSignal: 0.1,
        },
        actionThresholds: {
            completeMinScore: 0.75,
            approvalRequiredScore: 0.5,
            retryMaxFailures: 3,
        },
        evidence: {
            enabled: true,
            artifactKind: "quality_evaluation",
            retentionDays: 30,
        },
        ...overrides,
    };
}
function createMockQualityEvaluationEvidence(overrides = {}) {
    return {
        evaluationId: "eval_1",
        taskId: "task_1",
        executionId: "exec_1",
        qualityScore: 0.85,
        passed: true,
        verdict: "pass",
        releaseStage: "released",
        reasonCodes: ["quality.pass", "quality.signal.success"],
        factorBreakdown: {
            successSignals: 0.8,
            failureSignals: 0.1,
            partialSignals: 0.05,
            completionBonus: 0.1,
            failurePenalty: 0.0,
            partialPenalty: 0.05,
        },
        evaluatedAt: "2026-04-26T00:00:00.000Z",
        configSnapshot: {
            passThreshold: 0.8,
            weights: {
                successSignal: 0.4,
                completionOutcome: 0.2,
                failureSignal: 0.3,
                partialSignal: 0.1,
            },
        },
        ...overrides,
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// QualityGateConfig Tests
// ─────────────────────────────────────────────────────────────────────────────
test("QualityGateConfig has all required fields", () => {
    const config = createMockQualityGateConfig();
    assert.equal(typeof config.qualityGate, "object");
    assert.equal(typeof config.qualityScoreWeights, "object");
    assert.equal(typeof config.actionThresholds, "object");
    assert.equal(typeof config.evidence, "object");
});
test("QualityGateConfig qualityGate has correct structure", () => {
    const config = createMockQualityGateConfig();
    assert.equal(typeof config.qualityGate.defaultPassThreshold, "number");
    assert.equal(typeof config.qualityGate.criticalPassThreshold, "number");
    assert.ok(config.qualityGate.enforcement === "blocking" || config.qualityGate.enforcement === "warning");
});
test("QualityGateConfig qualityGate enforcement can be blocking", () => {
    const config = createMockQualityGateConfig({
        qualityGate: {
            defaultPassThreshold: 0.8,
            criticalPassThreshold: 0.95,
            enforcement: "blocking",
        },
    });
    assert.equal(config.qualityGate.enforcement, "blocking");
});
test("QualityGateConfig qualityGate enforcement can be warning", () => {
    const config = createMockQualityGateConfig({
        qualityGate: {
            defaultPassThreshold: 0.8,
            criticalPassThreshold: 0.95,
            enforcement: "warning",
        },
    });
    assert.equal(config.qualityGate.enforcement, "warning");
});
test("QualityGateConfig qualityScoreWeights sum to 1.0", () => {
    const config = createMockQualityGateConfig();
    const sum = config.qualityScoreWeights.successSignal
        + config.qualityScoreWeights.completionOutcome
        + config.qualityScoreWeights.failureSignal
        + config.qualityScoreWeights.partialSignal;
    assert.ok(Math.abs(sum - 1.0) < 0.0001);
});
test("QualityGateConfig actionThresholds has correct structure", () => {
    const config = createMockQualityGateConfig();
    assert.equal(typeof config.actionThresholds.completeMinScore, "number");
    assert.equal(typeof config.actionThresholds.approvalRequiredScore, "number");
    assert.equal(typeof config.actionThresholds.retryMaxFailures, "number");
    assert.equal(Number.isInteger(config.actionThresholds.retryMaxFailures), true);
});
test("QualityGateConfig evidence has correct structure", () => {
    const config = createMockQualityGateConfig();
    assert.equal(typeof config.evidence.enabled, "boolean");
    assert.equal(typeof config.evidence.artifactKind, "string");
    assert.equal(typeof config.evidence.retentionDays, "number");
    assert.equal(Number.isInteger(config.evidence.retentionDays), true);
});
test("QualityGateConfig evidence can be disabled", () => {
    const config = createMockQualityGateConfig({
        evidence: {
            enabled: false,
            artifactKind: "quality_evaluation",
            retentionDays: 0,
        },
    });
    assert.equal(config.evidence.enabled, false);
});
test("QualityGateConfig with high pass threshold", () => {
    const config = createMockQualityGateConfig({
        qualityGate: {
            defaultPassThreshold: 0.95,
            criticalPassThreshold: 0.99,
            enforcement: "blocking",
        },
    });
    assert.ok(config.qualityGate.defaultPassThreshold > 0.9);
});
test("QualityGateConfig with low pass threshold", () => {
    const config = createMockQualityGateConfig({
        qualityGate: {
            defaultPassThreshold: 0.5,
            criticalPassThreshold: 0.7,
            enforcement: "warning",
        },
    });
    assert.ok(config.qualityGate.defaultPassThreshold < 0.6);
});
test("QualityGateConfig with zero retention days", () => {
    const config = createMockQualityGateConfig({
        evidence: {
            enabled: true,
            artifactKind: "quality_evaluation",
            retentionDays: 0,
        },
    });
    assert.equal(config.evidence.retentionDays, 0);
});
test("QualityGateConfig with very high retention days", () => {
    const config = createMockQualityGateConfig({
        evidence: {
            enabled: true,
            artifactKind: "quality_evaluation",
            retentionDays: 365,
        },
    });
    assert.ok(config.evidence.retentionDays > 100);
});
// ─────────────────────────────────────────────────────────────────────────────
// QualityEvaluationEvidence Tests
// ─────────────────────────────────────────────────────────────────────────────
test("QualityEvaluationEvidence has all required fields", () => {
    const evidence = createMockQualityEvaluationEvidence();
    assert.equal(typeof evidence.evaluationId, "string");
    assert.equal(typeof evidence.taskId, "string");
    assert.equal(typeof evidence.qualityScore, "number");
    assert.equal(typeof evidence.passed, "boolean");
    assert.equal(typeof evidence.verdict, "string");
    assert.equal(typeof evidence.releaseStage, "string");
    assert.ok(Array.isArray(evidence.reasonCodes));
    assert.equal(typeof evidence.factorBreakdown, "object");
    assert.equal(typeof evidence.evaluatedAt, "string");
    assert.equal(typeof evidence.configSnapshot, "object");
});
test("QualityEvaluationEvidence verdict accepts pass", () => {
    const evidence = createMockQualityEvaluationEvidence({
        verdict: "pass",
        passed: true,
    });
    assert.equal(evidence.verdict, "pass");
    assert.equal(evidence.passed, true);
});
test("QualityEvaluationEvidence verdict accepts fail", () => {
    const evidence = createMockQualityEvaluationEvidence({
        verdict: "fail",
        passed: false,
        qualityScore: 0.3,
    });
    assert.equal(evidence.verdict, "fail");
    assert.equal(evidence.passed, false);
});
test("QualityEvaluationEvidence verdict accepts degraded", () => {
    const evidence = createMockQualityEvaluationEvidence({
        verdict: "degraded",
        passed: true,
        qualityScore: 0.7,
    });
    assert.equal(evidence.verdict, "degraded");
});
test("QualityEvaluationEvidence verdict accepts inconclusive", () => {
    const evidence = createMockQualityEvaluationEvidence({
        verdict: "inconclusive",
        passed: false,
        qualityScore: 0.0,
    });
    assert.equal(evidence.verdict, "inconclusive");
});
test("QualityEvaluationEvidence releaseStage accepts released", () => {
    const evidence = createMockQualityEvaluationEvidence({
        releaseStage: "released",
    });
    assert.equal(evidence.releaseStage, "released");
});
test("QualityEvaluationEvidence releaseStage accepts repair", () => {
    const evidence = createMockQualityEvaluationEvidence({
        releaseStage: "repair",
    });
    assert.equal(evidence.releaseStage, "repair");
});
test("QualityEvaluationEvidence releaseStage accepts approval", () => {
    const evidence = createMockQualityEvaluationEvidence({
        releaseStage: "approval",
    });
    assert.equal(evidence.releaseStage, "approval");
});
test("QualityEvaluationEvidence releaseStage accepts blocked", () => {
    const evidence = createMockQualityEvaluationEvidence({
        releaseStage: "blocked",
    });
    assert.equal(evidence.releaseStage, "blocked");
});
test("QualityEvaluationEvidence factorBreakdown has all components", () => {
    const evidence = createMockQualityEvaluationEvidence();
    const fb = evidence.factorBreakdown;
    assert.equal(typeof fb.successSignals, "number");
    assert.equal(typeof fb.failureSignals, "number");
    assert.equal(typeof fb.partialSignals, "number");
    assert.equal(typeof fb.completionBonus, "number");
    assert.equal(typeof fb.failurePenalty, "number");
    assert.equal(typeof fb.partialPenalty, "number");
});
test("QualityEvaluationEvidence with executionId", () => {
    const evidence = createMockQualityEvaluationEvidence({
        executionId: "exec_123",
    });
    assert.equal(evidence.executionId, "exec_123");
});
test("QualityEvaluationEvidence without executionId", () => {
    const evidence = createMockQualityEvaluationEvidence({
        executionId: undefined,
    });
    assert.equal(evidence.executionId, undefined);
});
test("QualityEvaluationEvidence configSnapshot matches qualityGate weights", () => {
    const config = createMockQualityGateConfig();
    const evidence = createMockQualityEvaluationEvidence({
        configSnapshot: {
            passThreshold: config.qualityGate.defaultPassThreshold,
            weights: config.qualityScoreWeights,
        },
    });
    assert.equal(evidence.configSnapshot.passThreshold, config.qualityGate.defaultPassThreshold);
    assert.deepEqual(evidence.configSnapshot.weights, config.qualityScoreWeights);
});
test("QualityEvaluationEvidence with many reasonCodes", () => {
    const evidence = createMockQualityEvaluationEvidence({
        reasonCodes: [
            "quality.pass",
            "quality.signal.success",
            "quality.factor.high",
            "quality.approval.explicit",
        ],
    });
    assert.equal(evidence.reasonCodes.length, 4);
});
test("QualityEvaluationEvidence with empty reasonCodes", () => {
    const evidence = createMockQualityEvaluationEvidence({
        reasonCodes: [],
    });
    assert.ok(Array.isArray(evidence.reasonCodes));
    assert.equal(evidence.reasonCodes.length, 0);
});
test("QualityEvaluationEvidence qualityScore can be 0", () => {
    const evidence = createMockQualityEvaluationEvidence({
        qualityScore: 0,
        passed: false,
        verdict: "fail",
    });
    assert.equal(evidence.qualityScore, 0);
});
test("QualityEvaluationEvidence qualityScore can be 1", () => {
    const evidence = createMockQualityEvaluationEvidence({
        qualityScore: 1.0,
        passed: true,
        verdict: "pass",
    });
    assert.equal(evidence.qualityScore, 1.0);
});
test("QualityEvaluationEvidence evaluatedAt is ISO timestamp", () => {
    const now = new Date().toISOString();
    const evidence = createMockQualityEvaluationEvidence({
        evaluatedAt: now,
    });
    assert.equal(evidence.evaluatedAt, now);
});
// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────
test("QualityGateConfig weights can be all zero", () => {
    const config = createMockQualityGateConfig({
        qualityScoreWeights: {
            successSignal: 0,
            completionOutcome: 0,
            failureSignal: 0,
            partialSignal: 0,
        },
    });
    const sum = config.qualityScoreWeights.successSignal
        + config.qualityScoreWeights.completionOutcome
        + config.qualityScoreWeights.failureSignal
        + config.qualityScoreWeights.partialSignal;
    assert.equal(sum, 0);
});
test("QualityEvaluationEvidence with perfect score", () => {
    const evidence = createMockQualityEvaluationEvidence({
        qualityScore: 1.0,
        passed: true,
        verdict: "pass",
        factorBreakdown: {
            successSignals: 1.0,
            failureSignals: 0,
            partialSignals: 0,
            completionBonus: 0.1,
            failurePenalty: 0,
            partialPenalty: 0,
        },
    });
    assert.equal(evidence.qualityScore, 1.0);
    assert.equal(evidence.factorBreakdown.successSignals, 1.0);
});
test("QualityEvaluationEvidence with worst score", () => {
    const evidence = createMockQualityEvaluationEvidence({
        qualityScore: 0,
        passed: false,
        verdict: "fail",
        factorBreakdown: {
            successSignals: 0,
            failureSignals: 1.0,
            partialSignals: 0,
            completionBonus: 0,
            failurePenalty: 0.5,
            partialPenalty: 0.1,
        },
    });
    assert.equal(evidence.qualityScore, 0);
    assert.equal(evidence.factorBreakdown.failurePenalty, 0.5);
});
test("QualityGateConfig retryMaxFailures can be 0", () => {
    const config = createMockQualityGateConfig({
        actionThresholds: {
            completeMinScore: 0.75,
            approvalRequiredScore: 0.5,
            retryMaxFailures: 0,
        },
    });
    assert.equal(config.actionThresholds.retryMaxFailures, 0);
});
test("QualityGateConfig retryMaxFailures can be very large", () => {
    const config = createMockQualityGateConfig({
        actionThresholds: {
            completeMinScore: 0.75,
            approvalRequiredScore: 0.5,
            retryMaxFailures: 999,
        },
    });
    assert.ok(config.actionThresholds.retryMaxFailures > 100);
});
test("QualityGateConfig approvalRequiredScore can equal completeMinScore", () => {
    const config = createMockQualityGateConfig({
        actionThresholds: {
            completeMinScore: 0.5,
            approvalRequiredScore: 0.5,
            retryMaxFailures: 3,
        },
    });
    assert.equal(config.actionThresholds.completeMinScore, config.actionThresholds.approvalRequiredScore);
});
test("QualityGateConfig approvalRequiredScore can be less than completeMinScore", () => {
    const config = createMockQualityGateConfig({
        actionThresholds: {
            completeMinScore: 0.7,
            approvalRequiredScore: 0.3,
            retryMaxFailures: 3,
        },
    });
    assert.ok(config.actionThresholds.approvalRequiredScore < config.actionThresholds.completeMinScore);
});
test("QualityEvaluationEvidence factorBreakdown values can be negative", () => {
    const evidence = createMockQualityEvaluationEvidence({
        factorBreakdown: {
            successSignals: -0.1,
            failureSignals: 0.2,
            partialSignals: 0.05,
            completionBonus: -0.05,
            failurePenalty: 0.1,
            partialPenalty: 0.05,
        },
    });
    assert.ok(evidence.factorBreakdown.successSignals < 0);
});
test("QualityGateConfig with extreme threshold values", () => {
    const config = createMockQualityGateConfig({
        qualityGate: {
            defaultPassThreshold: 0.001,
            criticalPassThreshold: 0.999,
            enforcement: "blocking",
        },
    });
    assert.ok(config.qualityGate.defaultPassThreshold < 0.01);
    assert.ok(config.qualityGate.criticalPassThreshold > 0.99);
});
//# sourceMappingURL=types.test.js.map