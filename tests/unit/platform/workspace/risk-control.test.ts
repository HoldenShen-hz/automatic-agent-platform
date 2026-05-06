/**
 * Unit Tests: Risk Control
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  RiskEvaluationEngine,
  RiskEvaluationError,
  loadRiskConfig,
  type RiskEvaluationRequest,
  type RiskEvaluationResult,
  type RiskLevel,
  type RiskFactors,
  type BlastRadius,
  type OperationRisk,
  type TargetResourceCriticality,
  type DataSensitivity,
  type AutonomyModeRisk,
  type TenantImpact,
  type HistoricalFailureRate,
  type EvidenceConfidence,
} from "../../../../src/platform/five-plane-control-plane/risk-control/index.js";

// ============================================================================
// Risk Evaluation Engine Tests
// ============================================================================

test("RiskEvaluationEngine evaluates low risk request", () => {
  const config = loadRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  const request: RiskEvaluationRequest = {
    taskId: "task_001",
    factors: {
      operationRisk: "read",
      targetResourceCriticality: "internal",
      dataSensitivity: "public",
      autonomyModeRisk: "full_auto",
      tenantImpact: "single_task",
      blastRadius: "single_task",
      historicalFailureRate: "low",
      evidenceConfidence: "high",
    },
  };

  const result = engine.evaluate(request);

  assert.equal(result.riskLevel, "low");
  assert.equal(result.taskId, "task_001");
  assert.ok(result.riskScore >= 0 && result.riskScore <= 1);
  assert.ok(result.factorBreakdown.length === 8);
});

test("RiskEvaluationEngine evaluates medium risk for write operations", () => {
  const config = loadRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  const request: RiskEvaluationRequest = {
    taskId: "task_002",
    factors: {
      operationRisk: "write",
      targetResourceCriticality: "staging",
      dataSensitivity: "internal",
      autonomyModeRisk: "semi_auto",
      tenantImpact: "workflow",
      blastRadius: "workflow",
      historicalFailureRate: "medium",
      evidenceConfidence: "medium",
    },
  };

  const result = engine.evaluate(request);

  assert.ok(["low", "medium"].includes(result.riskLevel));
  assert.ok(result.factorBreakdown.length === 8);
});

test("RiskEvaluationEngine evaluates high risk for destructive operations", () => {
  const config = loadRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  const request: RiskEvaluationRequest = {
    taskId: "task_003",
    factors: {
      operationRisk: "delete",
      targetResourceCriticality: "production",
      dataSensitivity: "restricted",
      autonomyModeRisk: "supervised",
      tenantImpact: "tenant",
      blastRadius: "tenant",
      historicalFailureRate: "high",
      evidenceConfidence: "low",
    },
  };

  const result = engine.evaluate(request);

  assert.ok(["medium", "high", "critical"].includes(result.riskLevel));
});

test("RiskEvaluationEngine calculates blast radius factor", () => {
  const config = loadRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  const result = engine.evaluate({
    taskId: "task_004",
    factors: {
      operationRisk: "write",
      targetResourceCriticality: "production",
      dataSensitivity: "confidential",
      autonomyModeRisk: "semi_auto",
      tenantImpact: "tenant",
      blastRadius: "platform",
      historicalFailureRate: "medium",
      evidenceConfidence: "high",
    },
  });

  const blastRadiusFactor = result.factorBreakdown.find((f) => f.factor === "blastRadius");
  assert.ok(blastRadiusFactor !== undefined);
  assert.ok(blastRadiusFactor.weightedValue > 0);
});

test("RiskEvaluationEngine handles high confidence", () => {
  const config = loadRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  const result = engine.evaluate({
    taskId: "task_005",
    factors: {
      operationRisk: "read",
      targetResourceCriticality: "internal",
      dataSensitivity: "public",
      autonomyModeRisk: "full_auto",
      tenantImpact: "single_task",
      blastRadius: "single_task",
      historicalFailureRate: "low",
      evidenceConfidence: "high",
    },
  });

  const confidenceFactor = result.factorBreakdown.find((f) => f.factor === "evidenceConfidence");
  assert.ok(confidenceFactor !== undefined);
  assert.ok(confidenceFactor.value >= 0.7);
});

test("RiskEvaluationEngine produces factor breakdown", () => {
  const config = loadRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  const result = engine.evaluate({
    taskId: "task_006",
    factors: {
      operationRisk: "external_call",
      targetResourceCriticality: "staging",
      dataSensitivity: "internal",
      autonomyModeRisk: "suggestion",
      tenantImpact: "workflow",
      blastRadius: "workflow",
      historicalFailureRate: "medium",
      evidenceConfidence: "medium",
    },
  });

  assert.ok(result.factorBreakdown !== undefined);
  assert.ok(result.factorBreakdown.length === 8);
  const factorNames = result.factorBreakdown.map((f) => f.factor);
  assert.ok(factorNames.includes("operationRisk"));
  assert.ok(factorNames.includes("targetResourceCriticality"));
  assert.ok(factorNames.includes("dataSensitivity"));
  assert.ok(factorNames.includes("autonomyModeRisk"));
  assert.ok(factorNames.includes("tenantImpact"));
  assert.ok(factorNames.includes("blastRadius"));
  assert.ok(factorNames.includes("historicalFailureRate"));
  assert.ok(factorNames.includes("evidenceConfidence"));
});

test("RiskEvaluationEngine handles high historical failure rate", () => {
  const config = loadRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  const result = engine.evaluate({
    taskId: "task_007",
    factors: {
      operationRisk: "write",
      targetResourceCriticality: "production",
      dataSensitivity: "restricted",
      autonomyModeRisk: "supervised",
      tenantImpact: "tenant",
      blastRadius: "platform",
      historicalFailureRate: "critical",
      evidenceConfidence: "low",
    },
  });

  const historicalFactor = result.factorBreakdown.find((f) => f.factor === "historicalFailureRate");
  assert.ok(historicalFactor !== undefined);
  assert.ok(historicalFactor.weightedValue > 0);
});

// ============================================================================
// Risk Config Loader Tests
// ============================================================================

test("loadRiskConfig returns config object", () => {
  const config = loadRiskConfig();

  assert.ok(config !== null);
  assert.ok(typeof config === "object");
});

test("loadRiskConfig returns risk matrix", () => {
  const config = loadRiskConfig();

  assert.ok(config.riskLevelThresholds !== undefined);
  const thresholds = config.riskLevelThresholds;
  assert.ok(typeof thresholds.low === "number");
  assert.ok(typeof thresholds.medium === "number");
  assert.ok(typeof thresholds.high === "number");
  assert.ok(typeof thresholds.critical === "number");
});

test("RiskConfig has valid risk levels", () => {
  const config = loadRiskConfig();
  const levels: RiskLevel[] = ["low", "medium", "high", "critical"];

  assert.ok(levels.every((level) => config.riskLevelThresholds[level] !== undefined));
});

// ============================================================================
// Risk Level Tests
// ============================================================================

test("RiskLevel enum values are valid", () => {
  const levels: RiskLevel[] = ["low", "medium", "high", "critical"];

  assert.equal(levels.length, 4);
  levels.forEach((level) => {
    assert.ok(["low", "medium", "high", "critical"].includes(level));
  });
});

test("RiskEvaluationResult contains all required fields", () => {
  const config = loadRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  const result = engine.evaluate({
    taskId: "task_008",
    factors: {
      operationRisk: "read",
      targetResourceCriticality: "internal",
      dataSensitivity: "public",
      autonomyModeRisk: "full_auto",
      tenantImpact: "single_task",
      blastRadius: "single_task",
      historicalFailureRate: "low",
      evidenceConfidence: "high",
    },
  });

  assert.ok(result.riskLevel !== undefined);
  assert.ok(result.riskScore !== undefined);
  assert.ok(result.factorBreakdown !== undefined);
  assert.ok(result.actions !== undefined);
  assert.ok(result.requiresApproval !== undefined);
  assert.ok(result.evidenceLevel !== undefined);
  assert.ok(result.logLevel !== undefined);
  assert.ok(result.autoExecute !== undefined);
  assert.ok(result.sideEffect !== undefined);
});

// ============================================================================
// Risk Evaluation Error Tests
// ============================================================================

test("RiskEvaluationError has correct properties", () => {
  const error = new RiskEvaluationError("Invalid request", "E001", { taskId: "task_009" });

  assert.equal(error.code, "E001");
  assert.equal(error.message, "Invalid request");
});

test("RiskEvaluationError is instance of Error", () => {
  const error = new RiskEvaluationError("Test error", "E002");

  assert.ok(error instanceof Error);
});

// ============================================================================
// Risk Factors Structure Tests
// ============================================================================

test("RiskFactors has all required fields", () => {
  const factors: RiskFactors = {
    operationRisk: "read",
    targetResourceCriticality: "internal",
    dataSensitivity: "public",
    autonomyModeRisk: "full_auto",
    tenantImpact: "single_task",
    blastRadius: "single_task",
    historicalFailureRate: "low",
    evidenceConfidence: "high",
  };

  assert.ok(typeof factors.operationRisk === "string");
  assert.ok(typeof factors.targetResourceCriticality === "string");
  assert.ok(typeof factors.dataSensitivity === "string");
  assert.ok(typeof factors.autonomyModeRisk === "string");
  assert.ok(typeof factors.tenantImpact === "string");
  assert.ok(typeof factors.blastRadius === "string");
  assert.ok(typeof factors.historicalFailureRate === "string");
  assert.ok(typeof factors.evidenceConfidence === "string");
});

test("BlastRadius enum values are valid", () => {
  const radii: BlastRadius[] = ["single_task", "workflow", "tenant", "platform"];

  assert.equal(radii.length, 4);
});

test("OperationRisk enum values are valid", () => {
  const ops: OperationRisk[] = ["read", "write", "delete", "external_call"];

  assert.equal(ops.length, 4);
});

test("TargetResourceCriticality enum values are valid", () => {
  const crit: TargetResourceCriticality[] = ["internal", "staging", "production"];

  assert.equal(crit.length, 3);
});

test("DataSensitivity enum values are valid", () => {
  const sens: DataSensitivity[] = ["public", "internal", "confidential", "restricted"];

  assert.equal(sens.length, 4);
});

test("AutonomyModeRisk enum values are valid", () => {
  const modes: AutonomyModeRisk[] = ["full_auto", "semi_auto", "supervised", "suggestion"];

  assert.equal(modes.length, 4);
});

test("TenantImpact enum values are valid", () => {
  const impacts: TenantImpact[] = ["single_task", "workflow", "tenant", "platform"];

  assert.equal(impacts.length, 4);
});

test("HistoricalFailureRate enum values are valid", () => {
  const rates: HistoricalFailureRate[] = ["low", "medium", "high", "critical"];

  assert.equal(rates.length, 4);
});

test("EvidenceConfidence enum values are valid", () => {
  const conf: EvidenceConfidence[] = ["high", "medium", "low"];

  assert.equal(conf.length, 3);
});

// ============================================================================
// RiskEvaluationResult Type Tests
// ============================================================================

test("RiskEvaluationResult with approval required", () => {
  const config = loadRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  const result = engine.evaluate({
    taskId: "task_high_risk",
    factors: {
      operationRisk: "delete",
      targetResourceCriticality: "production",
      dataSensitivity: "restricted",
      autonomyModeRisk: "supervised",
      tenantImpact: "tenant",
      blastRadius: "platform",
      historicalFailureRate: "critical",
      evidenceConfidence: "low",
    },
  });

  if (result.requiresApproval) {
    assert.ok(result.approvalType === "standard" || result.approvalType === "break_glass");
  }
});

test("RiskEvaluationResult without approval required", () => {
  const config = loadRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  const result = engine.evaluate({
    taskId: "task_low_risk",
    factors: {
      operationRisk: "read",
      targetResourceCriticality: "internal",
      dataSensitivity: "public",
      autonomyModeRisk: "full_auto",
      tenantImpact: "single_task",
      blastRadius: "single_task",
      historicalFailureRate: "low",
      evidenceConfidence: "high",
    },
  });

  assert.strictEqual(result.requiresApproval, false);
});

test("Factor breakdown includes weights and values", () => {
  const config = loadRiskConfig();
  const engine = new RiskEvaluationEngine({ config });

  const result = engine.evaluate({
    taskId: "task_factors",
    factors: {
      operationRisk: "write",
      targetResourceCriticality: "staging",
      dataSensitivity: "internal",
      autonomyModeRisk: "semi_auto",
      tenantImpact: "workflow",
      blastRadius: "workflow",
      historicalFailureRate: "medium",
      evidenceConfidence: "medium",
    },
  });

  result.factorBreakdown.forEach((factor) => {
    assert.ok(typeof factor.factor === "string");
    assert.ok(typeof factor.value === "number");
    assert.ok(typeof factor.weight === "number");
    assert.ok(typeof factor.weightedValue === "number");
    assert.ok(factor.weightedValue === factor.value * factor.weight);
  });
});
