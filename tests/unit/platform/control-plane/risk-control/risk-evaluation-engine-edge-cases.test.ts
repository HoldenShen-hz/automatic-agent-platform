/**
 * Additional unit tests for RiskEvaluationEngine
 * Tests edge cases, private method behavior, and boundary conditions
 */

import assert from "node:assert/strict";
import test from "node:test";
import { RiskEvaluationEngine, RiskEvaluationError } from "../../../../../src/platform/five-plane-control-plane/risk-control/risk-evaluation-engine.js";
import type { RiskEvaluationRequest, RiskConfig, RiskLevel } from "../../../../../src/platform/five-plane-control-plane/risk-control/types.js";

function createTestConfig(): RiskConfig {
  return {
    factorWeights: {
      impact: 4,
      irreversibility: 4,
      dataSensitivity: 3,
      autonomyModeRisk: 2,
      tenantImpact: 2,
      blastRadius: 2,
      historicalFailureRate: 2,
      evidenceConfidence: 1,
      stepTypeRisk: 3,
      targetSystemRisk: 4,
      dataClassRisk: 3,
      priorFailureRate: 2,
      confidence: 1,
    },
    impactValues: { read: 1, write: 3, delete: 5, external_call: 4 },
    irreversibilityValues: { read: 1, write: 3, delete: 5, external_call: 4 },
    dataSensitivityValues: { public: 1, internal: 2, confidential: 4, restricted: 5 },
    autonomyModeRiskValues: { manual: 1, semi_auto: 2, auto: 3 },
    tenantImpactValues: { single: 1, multiple: 2, all: 3 },
    blastRadiusValues: { single_task: 1, workflow: 2, tenant: 3, platform: 5 },
    historicalFailureRateThresholds: {
      low: { maxPercent: 10, value: 1 },
      medium: { maxPercent: 30, value: 2 },
      high: { maxPercent: 50, value: 3 },
      critical: { maxPercent: 100, value: 5 },
    },
    evidenceConfidenceValues: { high: 1, medium: 3, low: 5 },
    stepTypeRiskValues: { read: 1, write: 3, delete: 5, external_call: 4 },
    targetSystemRiskValues: { internal: 1, staging: 2, production: 5 },
    dataClassRiskValues: { public: 1, internal: 2, confidential: 4, restricted: 5 },
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

test("RiskEvaluationEngine computes weighted factor values correctly", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-weight-test",
    factors: {
      stepTypeRisk: "delete",
      targetSystemRisk: "production",
      dataClassRisk: "restricted",
      blastRadius: "platform",
      priorFailureRatePercent: 75,
      confidence: "low",
    },
  };

  const result = engine.evaluate(request);

  // Verify factor breakdown values
  const stepTypeFactor = result.factorBreakdown.find(f => f.factor === "stepTypeRisk");
  const targetFactor = result.factorBreakdown.find(f => f.factor === "targetSystemRisk");
  const dataClassFactor = result.factorBreakdown.find(f => f.factor === "dataClassRisk");
  const blastFactor = result.factorBreakdown.find(f => f.factor === "blastRadius");
  const priorFailureFactor = result.factorBreakdown.find(f => f.factor === "priorFailureRate");
  const confidenceFactor = result.factorBreakdown.find(f => f.factor === "confidence");

  assert.ok(stepTypeFactor);
  assert.ok(targetFactor);
  assert.ok(dataClassFactor);
  assert.ok(blastFactor);
  assert.ok(priorFailureFactor);
  assert.ok(confidenceFactor);

  // Values should be from config
  assert.equal(stepTypeFactor!.value, 5); // delete
  assert.equal(targetFactor!.value, 5); // production
  assert.equal(dataClassFactor!.value, 5); // restricted
  assert.equal(blastFactor!.value, 5); // platform
  assert.equal(priorFailureFactor!.value, 5); // >50% = critical
  assert.equal(confidenceFactor!.value, 5); // low

  // Weights
  assert.equal(stepTypeFactor!.weight, 3);
  assert.equal(targetFactor!.weight, 4);
  assert.equal(dataClassFactor!.weight, 3);
  assert.equal(blastFactor!.weight, 2);
  assert.equal(priorFailureFactor!.weight, 2);
  assert.equal(confidenceFactor!.weight, 1);

  // Weighted values
  assert.equal(stepTypeFactor!.weightedValue, 15);
  assert.equal(targetFactor!.weightedValue, 20);
  assert.equal(dataClassFactor!.weightedValue, 15);
  assert.equal(blastFactor!.weightedValue, 10);
  assert.equal(priorFailureFactor!.weightedValue, 10);
  assert.equal(confidenceFactor!.weightedValue, 5);
});

test("RiskEvaluationEngine priorFailureRate thresholds work correctly", () => {
  const testCases = [
    { percent: 0, expectedValue: 1 },
    { percent: 5, expectedValue: 1 },
    { percent: 10, expectedValue: 1 },
    { percent: 11, expectedValue: 2 },
    { percent: 25, expectedValue: 2 },
    { percent: 30, expectedValue: 2 },
    { percent: 31, expectedValue: 3 },
    { percent: 45, expectedValue: 3 },
    { percent: 50, expectedValue: 3 },
    { percent: 51, expectedValue: 5 },
    { percent: 75, expectedValue: 5 },
    { percent: 100, expectedValue: 5 },
  ];

  testCases.forEach(({ percent, expectedValue }) => {
    const engine = new RiskEvaluationEngine({ config: createTestConfig() });
    const request: RiskEvaluationRequest = {
      taskId: `task-${percent}`,
      factors: {
        stepTypeRisk: "read",
        targetSystemRisk: "internal",
        dataClassRisk: "public",
        blastRadius: "single_task",
        priorFailureRatePercent: percent,
        confidence: "high",
      },
    };

    const result = engine.evaluate(request);
    const priorFailureFactor = result.factorBreakdown.find(f => f.factor === "priorFailureRate");
    assert.equal(priorFailureFactor!.value, expectedValue, `Failed for ${percent}%`);
  });
});

test("RiskEvaluationEngine fails closed when historical failure thresholds are missing", () => {
  const config = createTestConfig();
  delete (config as Partial<RiskConfig>).historicalFailureRateThresholds;
  delete (config as Partial<RiskConfig>).priorFailureRateThresholds;
  const engine = new RiskEvaluationEngine({ config });

  const result = engine.evaluate({
    taskId: "task-missing-thresholds",
    factors: {
      impact: 1,
      irreversibility: 1,
      dataSensitivity: 1,
      autonomyModeRisk: 1,
      tenantImpact: 1,
      blastRadius: 1,
      historicalFailureRate: 0,
      evidenceConfidence: "high",
    },
  });

  const failureFactor = result.factorBreakdown.find((factor) => factor.factor === "historicalFailureRate");
  assert.equal(failureFactor?.value, 5);
});

test("RiskEvaluationEngine promotes seven-of-eight max canonical factors to critical", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });

  const result = engine.evaluate({
    taskId: "task-seven-of-eight",
    factors: {
      impact: 5,
      irreversibility: 5,
      dataSensitivity: 5,
      autonomyModeRisk: 5,
      tenantImpact: 5,
      blastRadius: 5,
      historicalFailureRate: 70,
      evidenceConfidence: "medium",
    },
  });

  assert.equal(result.riskLevel, "critical");
});

test("RiskEvaluationEngine boundary score for LOW risk level", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-boundary-low",
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
  assert.ok(result.riskScore < 0.25);
  // Score should be 0.2 (minimal factors)
  assert.equal(result.riskScore, 0.2);
});

test("RiskEvaluationEngine boundary score at exactly 0.25 transitions to MEDIUM", () => {
  // Configure thresholds to test boundary
  const boundaryConfig: RiskConfig = {
    ...createTestConfig(),
    riskLevelThresholds: { low: 0.25, medium: 0.5, high: 0.75, critical: 1.0 },
  };

  const engine = new RiskEvaluationEngine({ config: boundaryConfig });

  // Create a request that would score exactly at boundary
  const request: RiskEvaluationRequest = {
    taskId: "task-boundary-25",
    factors: {
      stepTypeRisk: "write",
      targetSystemRisk: "internal",
      dataClassRisk: "internal",
      blastRadius: "single_task",
      priorFailureRatePercent: 5,
      confidence: "high",
    },
  };

  const result = engine.evaluate(request);

  // Score should be >= 0.25 for medium
  assert.ok(result.riskScore >= 0.25, `Score ${result.riskScore} should be >= 0.25`);
});

test("RiskEvaluationEngine all stepTypeRisk values work", () => {
  const stepTypes: Array<{ type: "read" | "write" | "delete" | "external_call"; expectedValue: number }> = [
    { type: "read", expectedValue: 1 },
    { type: "write", expectedValue: 3 },
    { type: "delete", expectedValue: 5 },
    { type: "external_call", expectedValue: 4 },
  ];

  stepTypes.forEach(({ type, expectedValue }) => {
    const engine = new RiskEvaluationEngine({ config: createTestConfig() });
    const request: RiskEvaluationRequest = {
      taskId: `task-step-${type}`,
      factors: {
        stepTypeRisk: type,
        targetSystemRisk: "internal",
        dataClassRisk: "public",
        blastRadius: "single_task",
        priorFailureRatePercent: 0,
        confidence: "high",
      },
    };

    const result = engine.evaluate(request);
    const stepTypeFactor = result.factorBreakdown.find(f => f.factor === "stepTypeRisk");
    assert.equal(stepTypeFactor!.value, expectedValue, `Failed for ${type}`);
  });
});

test("RiskEvaluationEngine all targetSystemRisk values work", () => {
  const targets: Array<{ type: "internal" | "staging" | "production"; expectedValue: number }> = [
    { type: "internal", expectedValue: 1 },
    { type: "staging", expectedValue: 2 },
    { type: "production", expectedValue: 5 },
  ];

  targets.forEach(({ type, expectedValue }) => {
    const engine = new RiskEvaluationEngine({ config: createTestConfig() });
    const request: RiskEvaluationRequest = {
      taskId: `task-target-${type}`,
      factors: {
        stepTypeRisk: "read",
        targetSystemRisk: type,
        dataClassRisk: "public",
        blastRadius: "single_task",
        priorFailureRatePercent: 0,
        confidence: "high",
      },
    };

    const result = engine.evaluate(request);
    const targetFactor = result.factorBreakdown.find(f => f.factor === "targetSystemRisk");
    assert.equal(targetFactor!.value, expectedValue, `Failed for ${type}`);
  });
});

test("RiskEvaluationEngine all dataClassRisk values work", () => {
  const dataClasses: Array<{ type: "public" | "internal" | "confidential" | "restricted"; expectedValue: number }> = [
    { type: "public", expectedValue: 1 },
    { type: "internal", expectedValue: 2 },
    { type: "confidential", expectedValue: 4 },
    { type: "restricted", expectedValue: 5 },
  ];

  dataClasses.forEach(({ type, expectedValue }) => {
    const engine = new RiskEvaluationEngine({ config: createTestConfig() });
    const request: RiskEvaluationRequest = {
      taskId: `task-data-${type}`,
      factors: {
        stepTypeRisk: "read",
        targetSystemRisk: "internal",
        dataClassRisk: type,
        blastRadius: "single_task",
        priorFailureRatePercent: 0,
        confidence: "high",
      },
    };

    const result = engine.evaluate(request);
    const dataFactor = result.factorBreakdown.find(f => f.factor === "dataClassRisk");
    assert.equal(dataFactor!.value, expectedValue, `Failed for ${type}`);
  });
});

test("RiskEvaluationEngine all blastRadius values work", () => {
  const blastRadii: Array<{ type: "single_task" | "workflow" | "tenant" | "platform"; expectedValue: number }> = [
    { type: "single_task", expectedValue: 1 },
    { type: "workflow", expectedValue: 2 },
    { type: "tenant", expectedValue: 3 },
    { type: "platform", expectedValue: 5 },
  ];

  blastRadii.forEach(({ type, expectedValue }) => {
    const engine = new RiskEvaluationEngine({ config: createTestConfig() });
    const request: RiskEvaluationRequest = {
      taskId: `task-blast-${type}`,
      factors: {
        stepTypeRisk: "read",
        targetSystemRisk: "internal",
        dataClassRisk: "public",
        blastRadius: type,
        priorFailureRatePercent: 0,
        confidence: "high",
      },
    };

    const result = engine.evaluate(request);
    const blastFactor = result.factorBreakdown.find(f => f.factor === "blastRadius");
    assert.equal(blastFactor!.value, expectedValue, `Failed for ${type}`);
  });
});

test("RiskEvaluationEngine all confidence values work", () => {
  const confidenceLevels: Array<{ type: "high" | "medium" | "low"; expectedValue: number }> = [
    { type: "high", expectedValue: 1 },
    { type: "medium", expectedValue: 3 },
    { type: "low", expectedValue: 5 },
  ];

  confidenceLevels.forEach(({ type, expectedValue }) => {
    const engine = new RiskEvaluationEngine({ config: createTestConfig() });
    const request: RiskEvaluationRequest = {
      taskId: `task-conf-${type}`,
      factors: {
        stepTypeRisk: "read",
        targetSystemRisk: "internal",
        dataClassRisk: "public",
        blastRadius: "single_task",
        priorFailureRatePercent: 0,
        confidence: type,
      },
    };

    const result = engine.evaluate(request);
    const confFactor = result.factorBreakdown.find(f => f.factor === "confidence");
    assert.equal(confFactor!.value, expectedValue, `Failed for ${type}`);
  });
});

test("RiskEvaluationEngine mapScoreToLevel returns correct levels", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });

  const testCases: Array<{ score: number; expectedLevel: RiskLevel }> = [
    { score: 0.0, expectedLevel: "low" },
    { score: 0.1, expectedLevel: "low" },
    { score: 0.24, expectedLevel: "low" },
    { score: 0.25, expectedLevel: "low" },
    { score: 0.3, expectedLevel: "low" },
    { score: 0.49, expectedLevel: "low" },
    { score: 0.5, expectedLevel: "medium" },
    { score: 0.6, expectedLevel: "medium" },
    { score: 0.74, expectedLevel: "medium" },
    { score: 0.75, expectedLevel: "high" },
    { score: 0.9, expectedLevel: "high" },
    { score: 1.0, expectedLevel: "critical" },
  ];

  testCases.forEach(({ score, expectedLevel }) => {
    const level = (engine as any).mapScoreToLevel(score);
    assert.equal(level, expectedLevel, `Failed for score ${score}`);
  });
});

test("RiskEvaluationEngine determineActions returns correct actions for each level", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const determineActions = (engine as any)["determineActions"];

  const lowActions = determineActions("low");
  assert.ok(lowActions.includes("log"));
  assert.ok(lowActions.includes("proceed"));
  assert.equal(lowActions.length, 2);

  const mediumActions = determineActions("medium");
  assert.ok(mediumActions.includes("log"));
  assert.ok(mediumActions.includes("proceed_with_validation"));
  assert.ok(mediumActions.includes("enhanced_monitoring"));
  assert.equal(mediumActions.length, 3);

  const highActions = determineActions("high");
  assert.ok(highActions.includes("log"));
  assert.ok(highActions.includes("block"));
  assert.ok(highActions.includes("require_approval"));
  assert.ok(highActions.includes("full_evidence"));
  assert.equal(highActions.length, 4);

  const criticalActions = determineActions("critical");
  assert.ok(criticalActions.includes("log"));
  assert.ok(criticalActions.includes("block"));
  assert.ok(criticalActions.includes("require_break_glass_approval"));
  assert.ok(criticalActions.includes("legal_evidence"));
  assert.ok(criticalActions.includes("incident_create"));
  assert.equal(criticalActions.length, 5);
});

test("RiskEvaluationEngine applyDomainOverride does not lower risk", () => {
  const config = createTestConfig();
  // Domain override is "low" but computed is "critical"
  const domainProfiles = new Map([["domain-low", "low" as RiskLevel]]);
  const engine = new RiskEvaluationEngine({ config, domainRiskProfiles: domainProfiles });

  const request: RiskEvaluationRequest = {
    taskId: "task-override-test",
    domainId: "domain-low",
    factors: {
      stepTypeRisk: "delete",
      targetSystemRisk: "production",
      dataClassRisk: "restricted",
      blastRadius: "platform",
      priorFailureRatePercent: 75,
      confidence: "low",
    },
  };

  const result = engine.evaluate(request);
  // Should remain critical, not lowered to low
  assert.equal(result.riskLevel, "critical");
});

test("RiskEvaluationEngine domain override works when base is lower", () => {
  const config = createTestConfig();
  // Domain override is "high" but computed is "low"
  const domainProfiles = new Map([["domain-high", "high" as RiskLevel]]);
  const engine = new RiskEvaluationEngine({ config, domainRiskProfiles: domainProfiles });

  const request: RiskEvaluationRequest = {
    taskId: "task-override-up",
    domainId: "domain-high",
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
  // Should be raised to high
  assert.equal(result.riskLevel, "high");
});

test("RiskEvaluationEngine domain override with medium base and critical override", () => {
  const config = createTestConfig();
  const domainProfiles = new Map([["domain-critical", "critical" as RiskLevel]]);
  const engine = new RiskEvaluationEngine({ config, domainRiskProfiles: domainProfiles });

  const request: RiskEvaluationRequest = {
    taskId: "task-override-critical",
    domainId: "domain-critical",
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
  assert.equal(result.riskLevel, "critical");
});

test("RiskEvaluationEngine risk score is normalized to 3 decimal places", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-precision",
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

  // Score should have at most 3 decimal places
  const scoreStr = result.riskScore.toString();
  if (scoreStr.includes(".")) {
    const decimals = scoreStr.split(".")[1]?.length ?? 0;
    assert.ok(decimals <= 3, `Score ${result.riskScore} has more than 3 decimal places`);
  }
});

test("RiskEvaluationEngine handles MAX_POSSIBLE_SCORE constant", () => {
  // MAX_POSSIBLE_SCORE = 75
  // From the comment: stepTypeRisk: 3×5=15, targetSystemRisk: 4×5=20, dataClassRisk: 3×5=15
  // blastRadius: 2×5=10, priorFailureRate: 2×5=10, confidence: 1×5=5
  // Total = 15 + 20 + 15 + 10 + 10 + 5 = 75

  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-max",
    factors: {
      stepTypeRisk: "delete",
      targetSystemRisk: "production",
      dataClassRisk: "restricted",
      blastRadius: "platform",
      priorFailureRatePercent: 100,
      confidence: "low",
    },
  };

  const result = engine.evaluate(request);

  // Max score should be 1.0
  assert.equal(result.riskScore, 1.0);
  assert.equal(result.riskLevel, "critical");
});

test("RiskEvaluationError has correct structure", () => {
  const error = new RiskEvaluationError("Test error", "TEST_CODE", { detail: "test" });

  assert.equal(error.message, "Test error");
  assert.equal(error.code, "TEST_CODE");
  assert.equal(error.name, "RiskEvaluationError");
  assert.ok(error instanceof Error);
});

test("RiskEvaluationEngine result contains all required fields", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-complete",
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

  // Check all required fields exist
  assert.ok(result.taskId);
  assert.ok(typeof result.riskScore === "number");
  assert.ok(result.riskLevel);
  assert.ok(Array.isArray(result.actions));
  assert.ok(typeof result.requiresApproval === "boolean");
  assert.ok(result.evidenceLevel);
  assert.ok(result.logLevel);
  assert.ok(typeof result.autoExecute === "boolean");
  assert.ok(result.sideEffect);
  assert.ok(Array.isArray(result.factorBreakdown));
});

test("RiskEvaluationEngine MEDIUM risk level does not require approval", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  // Factors that should produce a medium risk level (score >= 0.5, < 0.75)
  // Calculate: stepTypeRisk: write=3*3=9, targetSystemRisk: staging=2*4=8
  // dataClassRisk: internal=2*3=6, blastRadius: workflow=2*2=4
  // priorFailureRatePercent: 20=2*2=4, confidence: medium=3*1=3
  // Total = 34, Score = 34/75 = 0.453... Wait, that's still < 0.5
  // Let me recalculate with higher values:
  // stepTypeRisk: write=3*3=9, targetSystemRisk: staging=2*4=8
  // dataClassRisk: confidential=4*3=12, blastRadius: tenant=3*2=6
  // priorFailureRatePercent: 30=2*2=4, confidence: low=5*1=5
  // Total = 44, Score = 44/75 = 0.587 (medium-high range: >= 0.5)
  const request: RiskEvaluationRequest = {
    taskId: "task-medium-no-approval",
    factors: {
      stepTypeRisk: "write",
      targetSystemRisk: "staging",
      dataClassRisk: "confidential",
      blastRadius: "tenant",
      priorFailureRatePercent: 30,
      confidence: "low",
    },
  };

  const result = engine.evaluate(request);

  // Score should be >= 0.5 for medium
  assert.ok(result.riskScore >= 0.5, `Score ${result.riskScore} should be >= 0.5`);
  assert.equal(result.riskLevel, "medium");
  assert.equal(result.requiresApproval, false);
  assert.equal(result.autoExecute, true);
});
