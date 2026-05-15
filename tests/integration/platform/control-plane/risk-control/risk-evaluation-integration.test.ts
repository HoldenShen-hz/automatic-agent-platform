/**
 * Integration Test: Risk Evaluation Engine
 *
 * Tests the RiskEvaluationEngine for automated risk scoring:
 * - Risk score calculation with weighted factors
 * - Risk level mapping (low, medium, high, critical)
 * - Risk control actions determination
 * - Domain profile overrides
 */

import assert from "node:assert/strict";
import test from "node:test";

import { RiskEvaluationEngine } from "../../../../../src/platform/five-plane-control-plane/risk-control/risk-evaluation-engine.js";
import type {
  RiskEvaluationRequest,
  RiskConfig,
  RiskFactors,
} from "../../../../../src/platform/five-plane-control-plane/risk-control/types.js";

/**
 * Creates a test risk configuration matching config/risk/default.json
 */
function createTestRiskConfig(): RiskConfig {
  return {
    factorWeights: {
      stepTypeRisk: 3,
      targetSystemRisk: 4,
      dataClassRisk: 3,
      blastRadius: 2,
      priorFailureRate: 2,
      confidence: 1,
    },
    stepTypeRiskValues: {
      read: 1,
      write: 3,
      delete: 5,
      external_call: 4,
    },
    targetSystemRiskValues: {
      internal: 1,
      staging: 2,
      production: 5,
    },
    dataClassRiskValues: {
      public: 1,
      internal: 2,
      confidential: 4,
      restricted: 5,
    },
    blastRadiusValues: {
      single_task: 1,
      workflow: 2,
      tenant: 3,
      platform: 5,
    },
    priorFailureRateThresholds: {
      low: { maxPercent: 10, value: 1 },
      medium: { maxPercent: 30, value: 2 },
      high: { maxPercent: 50, value: 3 },
      critical: { maxPercent: 100, value: 5 },
    },
    confidenceValues: {
      high: 1,
      medium: 3,
      low: 5,
    },
    riskLevelThresholds: {
      low: 0.25,
      medium: 0.5,
      high: 0.75,
      critical: 1.0,
    },
    riskLevelActions: {
      low: {
        autoExecute: true,
        logLevel: "info",
        requiresApproval: false,
        sideEffect: "normal",
        evidenceLevel: "basic",
      },
      medium: {
        autoExecute: true,
        logLevel: "warn",
        requiresApproval: false,
        sideEffect: "normal_with_validation",
        evidenceLevel: "enhanced",
      },
      high: {
        autoExecute: false,
        logLevel: "error",
        requiresApproval: true,
        sideEffect: "restricted",
        evidenceLevel: "full",
      },
      critical: {
        autoExecute: false,
        logLevel: "critical",
        requiresApproval: true,
        approvalType: "break_glass",
        sideEffect: "prohibited",
        evidenceLevel: "legal",
      },
    },
  };
}

test("risk-engine: low risk task evaluation", () => {
  const config = createTestRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  const factors: RiskFactors = {
    stepTypeRisk: "read",
    targetSystemRisk: "internal",
    dataClassRisk: "public",
    blastRadius: "single_task",
    priorFailureRatePercent: 5,
    confidence: "high",
  };

  const result = engine.evaluate({
    taskId: "task-low-risk",
    factors,
  });

  assert.strictEqual(result.riskLevel, "low");
  assert.strictEqual(result.requiresApproval, false);
  assert.strictEqual(result.autoExecute, true);
  assert.strictEqual(result.sideEffect, "normal");
  assert.strictEqual(result.evidenceLevel, "basic");
  assert.ok(result.riskScore < 0.25, "Low risk score should be < 0.25");
  assert.ok(result.factorBreakdown.length === 6, "Should have 6 factors");
});

test("risk-engine: medium risk task evaluation", () => {
  const config = createTestRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  // Need score >= 0.5 and < 0.75 for medium
  // Factors for ~0.64:
  // stepTypeRisk=write(3), targetSystemRisk=production(5), dataClassRisk=internal(2),
  // blastRadius=workflow(2), priorFailureRate=3 (40%), confidence=medium(3)
  // weighted = 3*3 + 4*5 + 3*2 + 2*2 + 2*3 + 1*3 = 9 + 20 + 6 + 4 + 6 + 3 = 48
  // score = 48/75 = 0.64
  const factors: RiskFactors = {
    stepTypeRisk: "write",
    targetSystemRisk: "production",
    dataClassRisk: "internal",
    blastRadius: "workflow",
    priorFailureRatePercent: 40,
    confidence: "medium",
  };

  const result = engine.evaluate({
    taskId: "task-medium-risk",
    factors,
  });

  assert.strictEqual(result.riskLevel, "medium");
  assert.strictEqual(result.requiresApproval, false);
  assert.strictEqual(result.autoExecute, true);
  assert.strictEqual(result.sideEffect, "normal_with_validation");
  assert.strictEqual(result.evidenceLevel, "enhanced");
  assert.ok(result.riskScore >= 0.5, `Medium risk score should be >= 0.5, got ${result.riskScore}`);
  assert.ok(result.riskScore < 0.75, `Medium risk score should be < 0.75, got ${result.riskScore}`);
});

test("risk-engine: high risk task evaluation", () => {
  const config = createTestRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  // For high risk, need score >= 0.75 and < 1.0
  // stepTypeRisk=delete(5), targetSystemRisk=production(5), dataClassRisk=restricted(5),
  // blastRadius=platform(5), priorFailureRate=5 (>50%), confidence=low(5)
  // weighted = 3*5 + 4*5 + 3*5 + 2*5 + 2*5 + 1*5 = 15 + 20 + 15 + 10 + 10 + 5 = 75
  // score = 75/75 = 1.0 which is critical, not high
  // Let's use lower values to get ~0.8
  // stepTypeRisk=delete(5), targetSystemRisk=production(5), dataClassRisk=confidential(4),
  // blastRadius=tenant(3), priorFailureRate=3 (40%), confidence=low(5)
  // weighted = 3*5 + 4*5 + 3*4 + 2*3 + 2*3 + 1*5 = 15 + 20 + 12 + 6 + 6 + 5 = 64
  // score = 64/75 = 0.853... this is actually high risk
  const factors: RiskFactors = {
    stepTypeRisk: "delete",
    targetSystemRisk: "production",
    dataClassRisk: "confidential",
    blastRadius: "tenant",
    priorFailureRatePercent: 40,
    confidence: "low",
  };

  const result = engine.evaluate({
    taskId: "task-high-risk",
    factors,
  });

  assert.strictEqual(result.riskLevel, "high");
  assert.strictEqual(result.requiresApproval, true);
  assert.strictEqual(result.autoExecute, false);
  assert.strictEqual(result.sideEffect, "restricted");
  assert.strictEqual(result.evidenceLevel, "full");
  assert.ok(result.riskScore >= 0.75, `High risk score should be >= 0.75, got ${result.riskScore}`);
  assert.ok(result.riskScore < 1.0, `High risk score should be < 1.0, got ${result.riskScore}`);
});

test("risk-engine: critical risk task evaluation", () => {
  const config = createTestRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  const factors: RiskFactors = {
    stepTypeRisk: "delete",
    targetSystemRisk: "production",
    dataClassRisk: "restricted",
    blastRadius: "platform",
    priorFailureRatePercent: 60,
    confidence: "low",
  };

  const result = engine.evaluate({
    taskId: "task-critical-risk",
    factors,
  });

  assert.strictEqual(result.riskLevel, "critical");
  assert.strictEqual(result.requiresApproval, true);
  assert.strictEqual(result.autoExecute, false);
  assert.strictEqual(result.sideEffect, "prohibited");
  assert.strictEqual(result.evidenceLevel, "legal");
  assert.ok(result.riskScore >= 0.75, "Critical risk score should be >= 0.75");
});

test("risk-engine: break-glass approval for critical", () => {
  const config = createTestRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  const factors: RiskFactors = {
    stepTypeRisk: "delete",
    targetSystemRisk: "production",
    dataClassRisk: "restricted",
    blastRadius: "platform",
    priorFailureRatePercent: 80,
    confidence: "low",
  };

  const result = engine.evaluate({
    taskId: "task-break-glass",
    factors,
  });

  assert.strictEqual(result.riskLevel, "critical");
  assert.strictEqual(result.requiresApproval, true);
  assert.ok("approvalType" in result, "Should have approvalType");
  assert.strictEqual((result as any).approvalType, "break_glass");
});

test("risk-engine: factor breakdown is correct", () => {
  const config = createTestRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  const factors: RiskFactors = {
    stepTypeRisk: "write",
    targetSystemRisk: "internal",
    dataClassRisk: "public",
    blastRadius: "single_task",
    priorFailureRatePercent: 5,
    confidence: "high",
  };

  const result = engine.evaluate({
    taskId: "task-breakdown",
    factors,
  });

  // Verify all 6 factors are present
  const factorNames = result.factorBreakdown.map((f) => f.factor);
  assert.ok(factorNames.includes("stepTypeRisk"));
  assert.ok(factorNames.includes("targetSystemRisk"));
  assert.ok(factorNames.includes("dataClassRisk"));
  assert.ok(factorNames.includes("blastRadius"));
  assert.ok(factorNames.includes("priorFailureRate"));
  assert.ok(factorNames.includes("confidence"));

  // Verify weighted values are calculated correctly
  for (const factor of result.factorBreakdown) {
    assert.strictEqual(
      factor.weightedValue,
      factor.value * factor.weight,
      `Weighted value for ${factor.factor} should be value * weight`,
    );
  }
});

test("risk-engine: actions are determined by risk level", () => {
  const config = createTestRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  // Low risk actions
  const lowResult = engine.evaluate({
    taskId: "task-actions-low",
    factors: {
      stepTypeRisk: "read",
      targetSystemRisk: "internal",
      dataClassRisk: "public",
      blastRadius: "single_task",
      priorFailureRatePercent: 5,
      confidence: "high",
    },
  });

  assert.ok(lowResult.actions.includes("log"));
  assert.ok(lowResult.actions.includes("proceed"));
  assert.ok(!lowResult.actions.includes("block"));

  // High risk actions
  const highResult = engine.evaluate({
    taskId: "task-actions-high",
    factors: {
      stepTypeRisk: "delete",
      targetSystemRisk: "production",
      dataClassRisk: "confidential",
      blastRadius: "tenant",
      priorFailureRatePercent: 40,
      confidence: "medium",
    },
  });

  assert.ok(highResult.actions.includes("log"));
  assert.ok(highResult.actions.includes("block"));
  assert.ok(highResult.actions.includes("require_approval"));
});

test("risk-engine: domain override raises risk level", () => {
  const config = createTestRiskConfig();
  const domainProfiles = new Map([
    ["domain-a", "high" as const],
    ["domain-b", "critical" as const],
  ]);
  const engine = new RiskEvaluationEngine({ config, domainRiskProfiles: domainProfiles });

  // Base result would be low
  const lowFactors: RiskFactors = {
    stepTypeRisk: "read",
    targetSystemRisk: "internal",
    dataClassRisk: "public",
    blastRadius: "single_task",
    priorFailureRatePercent: 5,
    confidence: "high",
  };

  // Without domain override
  const baseResult = engine.evaluate({ taskId: "task-base", factors: lowFactors });
  assert.strictEqual(baseResult.riskLevel, "low");

  // With domain-a override (raises to high)
  const overriddenResult = engine.evaluate({
    taskId: "task-overridden",
    factors: lowFactors,
    domainId: "domain-a",
  });
  assert.strictEqual(overriddenResult.riskLevel, "high");

  // With domain-b override (raises to critical)
  const criticalOverride = engine.evaluate({
    taskId: "task-critical-override",
    factors: lowFactors,
    domainId: "domain-b",
  });
  assert.strictEqual(criticalOverride.riskLevel, "critical");
});

test("risk-engine: domain override does not lower risk", () => {
  const config = createTestRiskConfig();
  const domainProfiles = new Map([
    ["domain-low", "low" as const],
  ]);
  const engine = new RiskEvaluationEngine({ config, domainRiskProfiles: domainProfiles });

  // High risk base
  const highFactors: RiskFactors = {
    stepTypeRisk: "delete",
    targetSystemRisk: "production",
    dataClassRisk: "confidential",
    blastRadius: "tenant",
    priorFailureRatePercent: 40,
    confidence: "medium",
  };

  // Base result is high
  const baseResult = engine.evaluate({ taskId: "task-high", factors: highFactors });
  assert.strictEqual(baseResult.riskLevel, "high");

  // Domain override with low should NOT lower the high risk
  const overriddenResult = engine.evaluate({
    taskId: "task-not-lowered",
    factors: highFactors,
    domainId: "domain-low",
  });
  assert.strictEqual(overriddenResult.riskLevel, "high", "Domain override should not lower risk level");
});

test("risk-engine: prior failure rate mapping", () => {
  const config = createTestRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  // Test low threshold (<= 10%)
  const resultLow = engine.evaluate({
    taskId: "task-prior-low",
    factors: {
      stepTypeRisk: "read",
      targetSystemRisk: "internal",
      dataClassRisk: "public",
      blastRadius: "single_task",
      priorFailureRatePercent: 8,
      confidence: "high",
    },
  });
  assert.ok(resultLow.riskScore < 0.25, "Low prior failure should result in low risk");

  // Test critical threshold (> 50%)
  const resultCritical = engine.evaluate({
    taskId: "task-prior-critical",
    factors: {
      stepTypeRisk: "read",
      targetSystemRisk: "internal",
      dataClassRisk: "public",
      blastRadius: "single_task",
      priorFailureRatePercent: 75,
      confidence: "high",
    },
  });
  assert.ok(resultCritical.riskScore >= 0.25, "High prior failure should increase risk");
});

test("risk-engine: production targeting increases risk", () => {
  const config = createTestRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  // Internal system
  const internalResult = engine.evaluate({
    taskId: "task-internal",
    factors: {
      stepTypeRisk: "write",
      targetSystemRisk: "internal",
      dataClassRisk: "internal",
      blastRadius: "single_task",
      priorFailureRatePercent: 20,
      confidence: "medium",
    },
  });

  // Production system
  const productionResult = engine.evaluate({
    taskId: "task-production",
    factors: {
      stepTypeRisk: "write",
      targetSystemRisk: "production",
      dataClassRisk: "internal",
      blastRadius: "single_task",
      priorFailureRatePercent: 20,
      confidence: "medium",
    },
  });

  assert.ok(
    productionResult.riskScore > internalResult.riskScore,
    "Production targeting should have higher risk than internal",
  );
});

test("risk-engine: platform blast radius increases risk", () => {
  const config = createTestRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  // Single task blast radius
  const singleTaskResult = engine.evaluate({
    taskId: "task-single",
    factors: {
      stepTypeRisk: "write",
      targetSystemRisk: "staging",
      dataClassRisk: "internal",
      blastRadius: "single_task",
      priorFailureRatePercent: 20,
      confidence: "medium",
    },
  });

  // Platform blast radius
  const platformResult = engine.evaluate({
    taskId: "task-platform",
    factors: {
      stepTypeRisk: "write",
      targetSystemRisk: "staging",
      dataClassRisk: "internal",
      blastRadius: "platform",
      priorFailureRatePercent: 20,
      confidence: "medium",
    },
  });

  assert.ok(
    platformResult.riskScore > singleTaskResult.riskScore,
    "Platform blast radius should have higher risk than single task",
  );
});
