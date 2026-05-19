/**
 * Unit tests for RiskEvaluationEngine approval flow
 * Tests approval type determination (standard vs break_glass)
 */
import assert from "node:assert/strict";
import test from "node:test";
import { RiskEvaluationEngine } from "../../../../../src/platform/control-plane/risk-control/risk-evaluation-engine.js";
function createTestConfig() {
    return {
        factorWeights: {
            stepTypeRisk: 3,
            targetSystemRisk: 4,
            dataClassRisk: 3,
            blastRadius: 2,
            priorFailureRate: 2,
            confidence: 1,
        },
        stepTypeRiskValues: { read: 1, write: 3, delete: 5, external_call: 4 },
        targetSystemRiskValues: { internal: 1, staging: 2, production: 5 },
        dataClassRiskValues: { public: 1, internal: 2, confidential: 4, restricted: 5 },
        blastRadiusValues: { single_task: 1, workflow: 2, tenant: 3, platform: 5 },
        priorFailureRateThresholds: {
            low: { maxPercent: 10, value: 1 },
            medium: { maxPercent: 30, value: 2 },
            high: { maxPercent: 50, value: 3 },
            critical: { maxPercent: 100, value: 5 },
        },
        confidenceValues: { high: 1, medium: 3, low: 5 },
        riskLevelThresholds: { low: 0.25, medium: 0.5, high: 0.75, critical: 1.0 },
        riskLevelActions: {
            low: { autoExecute: true, logLevel: "info", requiresApproval: false, sideEffect: "normal", evidenceLevel: "basic" },
            medium: { autoExecute: true, logLevel: "warn", requiresApproval: false, sideEffect: "normal_with_validation", evidenceLevel: "enhanced" },
            high: { autoExecute: false, logLevel: "error", requiresApproval: true, approvalType: "standard", sideEffect: "restricted", evidenceLevel: "full" },
            critical: { autoExecute: false, logLevel: "critical", requiresApproval: true, approvalType: "break_glass", sideEffect: "prohibited", evidenceLevel: "legal" },
        },
    };
}
test("RiskEvaluationEngine high risk requires standard approval", () => {
    const engine = new RiskEvaluationEngine({ config: createTestConfig() });
    // Score >= 0.75 for high
    // stepTypeRisk: delete=5, targetSystemRisk: production=5, dataClassRisk: confidential=4
    // blastRadius: tenant=3, priorFailureRate: 3 (40%), confidence: medium=3
    // weighted = 3*5 + 4*5 + 3*4 + 2*3 + 2*3 + 1*3 = 15 + 20 + 12 + 6 + 6 + 3 = 62
    // score = 62/75 = 0.827
    const request = {
        taskId: "task-high-approval",
        factors: {
            stepTypeRisk: "delete",
            targetSystemRisk: "production",
            dataClassRisk: "confidential",
            blastRadius: "tenant",
            priorFailureRatePercent: 40,
            confidence: "medium",
        },
    };
    const result = engine.evaluate(request);
    assert.equal(result.riskLevel, "high");
    assert.equal(result.requiresApproval, true);
    // approvalType should be "standard" for high risk
    assert.equal(result.approvalType, "standard");
    assert.equal(result.autoExecute, false);
});
test("RiskEvaluationEngine critical risk requires break_glass approval", () => {
    const engine = new RiskEvaluationEngine({ config: createTestConfig() });
    const request = {
        taskId: "task-critical-approval",
        factors: {
            stepTypeRisk: "delete",
            targetSystemRisk: "production",
            dataClassRisk: "restricted",
            blastRadius: "platform",
            priorFailureRatePercent: 60,
            confidence: "low",
        },
    };
    const result = engine.evaluate(request);
    assert.equal(result.riskLevel, "critical");
    assert.equal(result.requiresApproval, true);
    assert.equal(result.approvalType, "break_glass");
});
test("RiskEvaluationEngine low risk does not have approvalType field", () => {
    const engine = new RiskEvaluationEngine({ config: createTestConfig() });
    const request = {
        taskId: "task-low-approval",
        factors: {
            stepTypeRisk: "read",
            targetSystemRisk: "internal",
            dataClassRisk: "public",
            blastRadius: "single_task",
            priorFailureRatePercent: 0,
            confidence: "high",
        },
    };
    const result = engine.evaluate(request);
    assert.equal(result.riskLevel, "low");
    assert.equal(result.requiresApproval, false);
    assert.equal(result.approvalType, undefined);
});
test("RiskEvaluationEngine medium risk does not have approvalType field", () => {
    const engine = new RiskEvaluationEngine({ config: createTestConfig() });
    // Need score >= 0.5 and < 0.75 for medium
    // stepTypeRisk: write=3, targetSystemRisk: production=5, dataClassRisk: internal=2
    // blastRadius: workflow=2, priorFailureRate: 2 (25%), confidence: medium=3
    // weighted = 3*3 + 4*5 + 3*2 + 2*2 + 2*2 + 1*3 = 9 + 20 + 6 + 4 + 4 + 3 = 46
    // score = 46/75 = 0.613
    const request = {
        taskId: "task-medium-approval",
        factors: {
            stepTypeRisk: "write",
            targetSystemRisk: "production",
            dataClassRisk: "internal",
            blastRadius: "workflow",
            priorFailureRatePercent: 25,
            confidence: "medium",
        },
    };
    const result = engine.evaluate(request);
    assert.equal(result.riskLevel, "medium");
    assert.equal(result.requiresApproval, false);
    assert.equal(result.approvalType, undefined);
});
test("RiskEvaluationEngine result type guard for requiresApproval", () => {
    const engine = new RiskEvaluationEngine({ config: createTestConfig() });
    // Test high risk result has approvalType
    const highRequest = {
        taskId: "task-high-type",
        factors: {
            stepTypeRisk: "delete",
            targetSystemRisk: "production",
            dataClassRisk: "confidential",
            blastRadius: "tenant",
            priorFailureRatePercent: 45,
            confidence: "low",
        },
    };
    const highResult = engine.evaluate(highRequest);
    // Type guard check
    if (highResult.requiresApproval) {
        assert.ok("approvalType" in highResult);
        assert.equal(highResult.approvalType, "standard");
    }
    // Test low risk result does not have approvalType
    const lowRequest = {
        taskId: "task-low-type",
        factors: {
            stepTypeRisk: "read",
            targetSystemRisk: "internal",
            dataClassRisk: "public",
            blastRadius: "single_task",
            priorFailureRatePercent: 0,
            confidence: "high",
        },
    };
    const lowResult = engine.evaluate(lowRequest);
    assert.equal(lowResult.requiresApproval, false);
});
test("RiskEvaluationEngine with standard approvalType config for high risk", () => {
    // Create a config where high risk has standard approval
    const config = {
        ...createTestConfig(),
        riskLevelActions: {
            ...createTestConfig().riskLevelActions,
            high: {
                autoExecute: false,
                logLevel: "error",
                requiresApproval: true,
                approvalType: "standard",
                sideEffect: "restricted",
                evidenceLevel: "full",
            },
        },
    };
    const engine = new RiskEvaluationEngine({ config });
    const request = {
        taskId: "task-standard-approval",
        factors: {
            stepTypeRisk: "delete",
            targetSystemRisk: "production",
            dataClassRisk: "confidential",
            blastRadius: "tenant",
            priorFailureRatePercent: 40,
            confidence: "low",
        },
    };
    const result = engine.evaluate(request);
    assert.equal(result.riskLevel, "high");
    assert.equal(result.approvalType, "standard");
});
test("RiskEvaluationEngine approval type undefined when not required", () => {
    const engine = new RiskEvaluationEngine({ config: createTestConfig() });
    // Factors that produce low risk (no approval needed)
    const request = {
        taskId: "task-no-approval-type",
        factors: {
            stepTypeRisk: "read",
            targetSystemRisk: "internal",
            dataClassRisk: "public",
            blastRadius: "single_task",
            priorFailureRatePercent: 5,
            confidence: "high",
        },
    };
    const result = engine.evaluate(request);
    assert.equal(result.requiresApproval, false);
    // approvalType should be undefined (not present) when approval not required
    const resultAny = result;
    assert.ok(!resultAny.approvalType || resultAny.approvalType === undefined);
});
//# sourceMappingURL=risk-evaluation-engine-approval.test.js.map