/**
 * Integration Tests: Risk Control
 *
 * Tests risk evaluation engine with the ADR-026 v4.3 8-factor canonical model.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { RiskEvaluationEngine, type RiskLevel, type RiskFactors, type RiskConfig } from "../../../../src/platform/five-plane-control-plane/risk-control/index.js";

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestRiskConfig(): RiskConfig {
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
    impactValues: { none: 1, low: 2, moderate: 3, significant: 4, severe: 5 },
    irreversibilityValues: { full: 1, partial: 3, limited: 4, none: 5 },
    dataSensitivityValues: { public: 1, internal: 2, confidential: 4, restricted: 5 },
    autonomyModeRiskValues: { manual: 1, assisted: 2, autonomous: 4, full_auto: 5 },
    tenantImpactValues: { single_task: 1, workflow: 2, tenant: 3, platform: 5 },
    blastRadiusValues: { none: 1, single_user: 2, team: 3, organization: 4, all_users: 5 },
    historicalFailureRateThresholds: {
      low: { maxPercent: 5, value: 1 },
      medium: { maxPercent: 15, value: 2 },
      high: { maxPercent: 30, value: 4 },
      critical: { maxPercent: 100, value: 5 },
    },
    evidenceConfidenceValues: { high: 1, medium: 3, low: 5 },
    riskLevelThresholds: { low: 0.25, medium: 0.5, high: 0.75, critical: 1.0 },
    riskLevelActions: {
      low: { autoExecute: true, logLevel: "info", requiresApproval: false, sideEffect: "normal", evidenceLevel: "basic" },
      medium: { autoExecute: true, logLevel: "warn", requiresApproval: false, sideEffect: "normal_with_validation", evidenceLevel: "enhanced" },
      high: { autoExecute: false, logLevel: "error", requiresApproval: true, approvalType: "standard", sideEffect: "restricted", evidenceLevel: "full" },
      critical: { autoExecute: false, logLevel: "critical", requiresApproval: true, approvalType: "break_glass", sideEffect: "prohibited", evidenceLevel: "legal" },
    },
  };
}

// ============================================================================
// Risk Control End-to-End Integration Tests
// ============================================================================

test("integration: risk escalation from low to critical", () => {
  const config = createTestRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  const lowFactors: RiskFactors = {
    impact: 1,
    irreversibility: 1,
    dataSensitivity: 1,
    autonomyModeRisk: 1,
    tenantImpact: 1,
    blastRadius: 1,
    historicalFailureRate: 2,
    evidenceConfidence: "high",
  };

  const mediumFactors: RiskFactors = {
    impact: 3,
    irreversibility: 3,
    dataSensitivity: 2,
    autonomyModeRisk: 2,
    tenantImpact: 2,
    blastRadius: 3,
    historicalFailureRate: 15,
    evidenceConfidence: "medium",
  };

  const highFactors: RiskFactors = {
    impact: 5,
    irreversibility: 5,
    dataSensitivity: 5,
    autonomyModeRisk: 4,
    tenantImpact: 3,
    blastRadius: 4,
    historicalFailureRate: 30,
    evidenceConfidence: "low",
  };

  const lowResult = engine.evaluate({ taskId: "task_low", factors: lowFactors });
  const medResult = engine.evaluate({ taskId: "task_med", factors: mediumFactors });
  const highResult = engine.evaluate({ taskId: "task_high", factors: highFactors });

  const riskOrder: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };

  assert.ok(riskOrder[lowResult.riskLevel] <= riskOrder[medResult.riskLevel]);
  assert.ok(riskOrder[medResult.riskLevel] <= riskOrder[highResult.riskLevel]);
});

test("integration: multiple tasks compose risk profile", () => {
  const config = createTestRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  const lowRiskFactors: RiskFactors = {
    impact: 1,
    irreversibility: 1,
    dataSensitivity: 1,
    autonomyModeRisk: 1,
    tenantImpact: 1,
    blastRadius: 1,
    historicalFailureRate: 2,
    evidenceConfidence: "high",
  };

  const highRiskFactors: RiskFactors = {
    impact: 5,
    irreversibility: 5,
    dataSensitivity: 5,
    autonomyModeRisk: 4,
    tenantImpact: 4,
    blastRadius: 5,
    historicalFailureRate: 40,
    evidenceConfidence: "low",
  };

  const lowResult = engine.evaluate({ taskId: "task_compose_low", factors: lowRiskFactors });
  const highResult = engine.evaluate({ taskId: "task_compose_high", factors: highRiskFactors });

  assert.ok(highResult.riskScore > lowResult.riskScore);
  assert.ok(highResult.riskLevel !== "low");
});

test("integration: risk config loads correctly", () => {
  const config = createTestRiskConfig();

  assert.ok(config.factorWeights.impact === 4);
  assert.ok(config.factorWeights.irreversibility === 4);
  assert.ok(config.riskLevelThresholds.low === 0.25);
  assert.ok(config.riskLevelThresholds.critical === 1.0);
});

test("integration: evidence confidence affects risk score", () => {
  const config = createTestRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  const baseFactors: RiskFactors = {
    impact: 3,
    irreversibility: 3,
    dataSensitivity: 3,
    autonomyModeRisk: 3,
    tenantImpact: 3,
    blastRadius: 3,
    historicalFailureRate: 15,
    evidenceConfidence: "high",
  };

  const lowConfidenceFactors: RiskFactors = {
    ...baseFactors,
    evidenceConfidence: "low",
  };

  const highResult = engine.evaluate({ taskId: "task_high_conf", factors: baseFactors });
  const lowResult = engine.evaluate({ taskId: "task_low_conf", factors: lowConfidenceFactors });

  assert.ok(lowResult.riskScore > highResult.riskScore);
});

test("integration: blast radius affects risk score", () => {
  const config = createTestRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  const lowBlastFactors: RiskFactors = {
    impact: 3,
    irreversibility: 3,
    dataSensitivity: 3,
    autonomyModeRisk: 3,
    tenantImpact: 1,
    blastRadius: 1,
    historicalFailureRate: 15,
    evidenceConfidence: "medium",
  };

  const highBlastFactors: RiskFactors = {
    ...lowBlastFactors,
    blastRadius: 5,
    tenantImpact: 5,
  };

  const lowBlastResult = engine.evaluate({ taskId: "task_low_blast", factors: lowBlastFactors });
  const highBlastResult = engine.evaluate({ taskId: "task_high_blast", factors: highBlastFactors });

  assert.ok(highBlastResult.riskScore > lowBlastResult.riskScore);
});

test("integration: risk result contains factor breakdown", () => {
  const config = createTestRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  const factors: RiskFactors = {
    impact: 3,
    irreversibility: 3,
    dataSensitivity: 3,
    autonomyModeRisk: 3,
    tenantImpact: 3,
    blastRadius: 3,
    historicalFailureRate: 15,
    evidenceConfidence: "medium",
  };

  const result = engine.evaluate({ taskId: "task_breakdown", factors });

  assert.ok(result.factorBreakdown.length === 8);
  assert.ok(result.factorBreakdown.some(f => f.factor === "impact"));
  assert.ok(result.factorBreakdown.some(f => f.factor === "evidenceConfidence"));
});

test("integration: high risk requires approval", () => {
  const config = createTestRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  const highRiskFactors: RiskFactors = {
    impact: 5,
    irreversibility: 5,
    dataSensitivity: 5,
    autonomyModeRisk: 5,
    tenantImpact: 5,
    blastRadius: 5,
    historicalFailureRate: 50,
    evidenceConfidence: "low",
  };

  const result = engine.evaluate({ taskId: "task_high_risk", factors: highRiskFactors });

  assert.ok(result.requiresApproval === true);
  assert.ok(result.riskLevel === "critical");
});

test("integration: low risk auto-executes", () => {
  const config = createTestRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  const lowRiskFactors: RiskFactors = {
    impact: 1,
    irreversibility: 1,
    dataSensitivity: 1,
    autonomyModeRisk: 1,
    tenantImpact: 1,
    blastRadius: 1,
    historicalFailureRate: 1,
    evidenceConfidence: "high",
  };

  const result = engine.evaluate({ taskId: "task_low_risk", factors: lowRiskFactors });

  assert.ok(result.autoExecute === true);
  assert.ok(result.requiresApproval === false);
  assert.ok(result.riskLevel === "low");
});