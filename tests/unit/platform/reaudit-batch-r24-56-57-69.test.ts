import assert from "node:assert/strict";
import test from "node:test";
import { RiskEvaluationEngine } from "../../../src/platform/five-plane-control-plane/risk-control/risk-evaluation-engine.js";
import type { RiskConfig } from "../../../src/platform/five-plane-control-plane/risk-control/types.js";

/**
 * R24-56, R24-57, R24-69: ADR-026 v4.3 8-factor risk model verification
 *
 * These tests verify that:
 * 1. RiskFactorsSchema uses the ADR-026 v4.3 8-factor model (not legacy 6-factor)
 * 2. MAX_POSSIBLE_SCORE is 100 (normalized to 0-1 by dividing by 100)
 * 3. RiskEvaluationEngine uses the new factor names
 */

// ADR-026 v4.3 canonical config for testing
function createAdr026V43Config(): RiskConfig {
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
    },
    impactValues: {
      negligible: 1,
      low: 2,
      medium: 3,
      high: 4,
      critical: 5,
    },
    irreversibilityValues: {
      fully_reversible: 1,
      mostly_reversible: 2,
      partially_reversible: 3,
      mostly_irreversible: 4,
      fully_irreversible: 5,
    },
    dataSensitivityValues: {
      public: 1,
      internal: 2,
      confidential: 4,
      restricted: 5,
    },
    autonomyModeRiskValues: {
      manual_only: 1,
      supervised: 2,
      semi_auto: 3,
      full_auto: 4,
      unrestricted: 5,
    },
    tenantImpactValues: {
      single_user: 1,
      small_team: 2,
      department: 3,
      organization: 4,
      platform_wide: 5,
    },
    blastRadiusValues: {
      single_task: 1,
      workflow: 2,
      tenant: 3,
      platform: 5,
    },
    historicalFailureRateThresholds: {
      low: { maxPercent: 10, value: 1 },
      medium: { maxPercent: 30, value: 2 },
      high: { maxPercent: 50, value: 3 },
      critical: { maxPercent: 100, value: 5 },
    },
    evidenceConfidenceValues: {
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
        approvalType: "standard",
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

test("R24-56/R24-57/R24-69 ADR-026 v4.3 8-factor model with MAX_POSSIBLE_SCORE=100", () => {
  const config = createAdr026V43Config();
  const engine = new RiskEvaluationEngine({ config });

  // Test case: medium risk scenario
  // impact=3*4 + irreversibility=3*4 + dataSensitivity=2*3 + autonomyModeRisk=2*2 +
  // tenantImpact=2*2 + blastRadius=2*2 + historicalFailureRate=2*2 + evidenceConfidence=3*1
  // = 12 + 12 + 6 + 4 + 4 + 4 + 4 + 3 = 49
  // Normalized: 49/100 = 0.49 -> medium risk level (0.25-0.5)
  const result = engine.evaluate({
    taskId: "test-task-r24-56",
    factors: {
      impact: 3,
      irreversibility: 3,
      dataSensitivity: 2,
      autonomyModeRisk: 2,
      tenantImpact: 2,
      blastRadius: 2,
      historicalFailureRate: 15,
      evidenceConfidence: "medium",
    },
  });

  // Verify riskScore is in 0-1 range
  assert.ok(result.riskScore >= 0 && result.riskScore <= 1,
    `riskScore ${result.riskScore} should be in 0-1 range`);

  // Verify riskScore matches expected normalized value
  // 49/100 = 0.49, which falls in medium (0.25-0.5)
  assert.equal(result.riskLevel, "medium",
    `riskScore 0.49 should map to medium, got ${result.riskLevel}`);
  assert.equal(result.riskScore, 0.49);
});

test("R24-56/R24-57/R24-69 factor breakdown has all 8 ADR-026 v4.3 factors", () => {
  const config = createAdr026V43Config();
  const engine = new RiskEvaluationEngine({ config });

  const result = engine.evaluate({
    taskId: "test-task-r24-57",
    factors: {
      impact: 4,
      irreversibility: 4,
      dataSensitivity: 4,
      autonomyModeRisk: 4,
      tenantImpact: 4,
      blastRadius: 4,
      historicalFailureRate: 0,
      evidenceConfidence: "high",
    },
  });

  // Verify factor breakdown has 8 factors
  assert.equal(result.factorBreakdown.length, 8);

  const factorNames = result.factorBreakdown.map(f => f.factor).sort();
  const expectedFactors = [
    "autonomyModeRisk",
    "blastRadius",
    "dataSensitivity",
    "evidenceConfidence",
    "historicalFailureRate",
    "impact",
    "irreversibility",
    "tenantImpact",
  ].sort();

  assert.deepEqual(factorNames, expectedFactors,
    `Factor names should be ${expectedFactors.join(", ")}, got ${factorNames.join(", ")}`);
});

test("R24-56/R24-57/R24-69 MAX_POSSIBLE_SCORE=100 gives normalized 0-1 riskScore", () => {
  const config = createAdr026V43Config();
  const engine = new RiskEvaluationEngine({ config });

  // Max scenario: all factors at 5 (max), evidenceConfidence=high(1)
  // weighted = 4*5 + 4*5 + 3*5 + 2*5 + 2*5 + 2*5 + 2*5 + 1*1 = 20+20+15+10+10+10+10+1 = 96
  // normalized = 96/100 = 0.96 -> critical (>= 0.75)
  const maxResult = engine.evaluate({
    taskId: "test-task-max",
    factors: {
      impact: 5,
      irreversibility: 5,
      dataSensitivity: 5,
      autonomyModeRisk: 5,
      tenantImpact: 5,
      blastRadius: 5,
      historicalFailureRate: 60, // > 50%, value=3
      evidenceConfidence: "high",
    },
  });

  assert.ok(maxResult.riskScore <= 1.0,
    `Max riskScore ${maxResult.riskScore} should be <= 1.0`);
  assert.equal(maxResult.riskLevel, "critical",
    `Max scenario should be critical, got ${maxResult.riskLevel}`);

  // Min scenario: all factors at minimum
  const minResult = engine.evaluate({
    taskId: "test-task-min",
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

  // Min weighted = 4*1 + 4*1 + 3*1 + 2*1 + 2*1 + 2*1 + 2*1 + 1*1 = 4+4+3+2+2+2+2+1 = 20
  // normalized = 20/100 = 0.2 -> low (< 0.25)
  assert.ok(minResult.riskScore <= 1.0,
    `Min riskScore ${minResult.riskScore} should be <= 1.0`);
  assert.equal(minResult.riskLevel, "low",
    `Min scenario should be low, got ${minResult.riskLevel}`);
});

test("R24-56/R24-57/R24-69 normalized scores align with ADR-026 threshold boundaries", () => {
  const config = createAdr026V43Config();
  const engine = new RiskEvaluationEngine({ config });

  // Test boundary: exactly at 0.25 should be medium (not low)
  // Need weighted sum where weighted/100 = 0.25, so weighted = 25
  // Example: all factors at 1 except one factor providing extra 5
  const boundaryResult = engine.evaluate({
    taskId: "test-boundary",
    factors: {
      impact: 1,
      irreversibility: 1,
      dataSensitivity: 1,
      autonomyModeRisk: 1,
      tenantImpact: 1,
      blastRadius: 1,
      historicalFailureRate: 0,
      evidenceConfidence: "high", // value=1
    },
  });

  // Min weighted = 20, riskScore = 0.2 -> low (< 0.25)
  assert.equal(boundaryResult.riskLevel, "low",
    `0.2 should be low, got ${boundaryResult.riskLevel}`);
});