/**
 * Unit tests for risk-control index exports
 */
import assert from "node:assert/strict";
import test from "node:test";
import { RiskEvaluationEngine, RiskEvaluationError, loadRiskConfig, } from "../../../../../src/platform/control-plane/risk-control/index.js";
test("RiskEvaluationEngine is exported and instantiable", () => {
    const mockConfig = {
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
            high: { autoExecute: false, logLevel: "error", requiresApproval: true, sideEffect: "restricted", evidenceLevel: "full" },
            critical: { autoExecute: false, logLevel: "critical", requiresApproval: true, approvalType: "break_glass", sideEffect: "prohibited", evidenceLevel: "legal" },
        },
    };
    const engine = new RiskEvaluationEngine({ config: mockConfig });
    assert.ok(engine instanceof RiskEvaluationEngine);
});
test("RiskEvaluationError is exported and instantiable", () => {
    const error = new RiskEvaluationError("test error", "TEST_CODE", { detail: "test" });
    assert.equal(error.message, "test error");
    assert.equal(error.code, "TEST_CODE");
    assert.equal(error.name, "RiskEvaluationError");
});
test("RiskEvaluationError can be thrown and caught", () => {
    const error = new RiskEvaluationError("error message", "ERR_CODE");
    let caught = null;
    try {
        throw error;
    }
    catch (e) {
        caught = e;
    }
    assert.ok(caught instanceof RiskEvaluationError);
    assert.equal(caught?.message, "error message");
});
test("loadRiskConfig is exported as a function", () => {
    assert.equal(typeof loadRiskConfig, "function");
});
test("All types are exported", () => {
    const level = "low";
    const stepType = "read";
    const target = "internal";
    const dataClass = "public";
    const blast = "single_task";
    const confidence = "high";
    const factors = {
        stepTypeRisk: stepType,
        targetSystemRisk: target,
        dataClassRisk: dataClass,
        blastRadius: blast,
        priorFailureRatePercent: 5,
        confidence: confidence,
    };
    const request = {
        taskId: "test-task",
        factors: factors,
    };
    assert.equal(request.taskId, "test-task");
    assert.equal(request.factors.stepTypeRisk, "read");
});
test("RiskConfig type can be constructed", () => {
    const config = {
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
            high: { autoExecute: false, logLevel: "error", requiresApproval: true, sideEffect: "restricted", evidenceLevel: "full" },
            critical: { autoExecute: false, logLevel: "critical", requiresApproval: true, approvalType: "break_glass", sideEffect: "prohibited", evidenceLevel: "legal" },
        },
    };
    assert.ok(config);
    assert.equal(config.factorWeights.stepTypeRisk, 3);
    assert.equal(config.riskLevelActions.critical.approvalType, "break_glass");
});
test("RiskLevelActionConfig type can be constructed", () => {
    const actionConfig = {
        autoExecute: true,
        logLevel: "info",
        requiresApproval: false,
        sideEffect: "normal",
        evidenceLevel: "basic",
    };
    assert.ok(actionConfig);
    assert.equal(actionConfig.autoExecute, true);
    assert.equal(actionConfig.evidenceLevel, "basic");
});
test("RiskEvaluationEngineOptions type can be constructed with optional domainRiskProfiles", () => {
    const config = {
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
            high: { autoExecute: false, logLevel: "error", requiresApproval: true, sideEffect: "restricted", evidenceLevel: "full" },
            critical: { autoExecute: false, logLevel: "critical", requiresApproval: true, approvalType: "break_glass", sideEffect: "prohibited", evidenceLevel: "legal" },
        },
    };
    const optionsWithoutProfiles = {
        config: config,
    };
    const domainProfiles = new Map([["domain1", "high"]]);
    const optionsWithProfiles = {
        config: config,
        domainRiskProfiles: domainProfiles,
    };
    assert.ok(optionsWithoutProfiles);
    assert.ok(optionsWithProfiles);
    assert.equal(optionsWithProfiles.domainRiskProfiles?.get("domain1"), "high");
});
//# sourceMappingURL=index.test.js.map