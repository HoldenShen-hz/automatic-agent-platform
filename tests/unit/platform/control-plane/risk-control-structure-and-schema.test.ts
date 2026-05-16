/**
 * Focused unit tests for risk-control config structure, schemas, and engine setup variants.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  RiskEvaluationEngine,
} from "../../../../src/platform/five-plane-control-plane/risk-control/risk-evaluation-engine.js";
import {
  RiskLevelSchema,
  BlastRadiusSchema,
  ConfidenceLevelSchema,
  RiskFactorsSchema,
} from "../../../../src/platform/five-plane-control-plane/risk-control/types.js";
import type {
  RiskEvaluationRequest,
  RiskConfig,
} from "../../../../src/platform/five-plane-control-plane/risk-control/types.js";

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
    },
    impactValues: { minimal: 1, low: 2, medium: 3, high: 4, severe: 5 },
    irreversibilityValues: { fully_reversible: 1, mostly_reversible: 2, partially_reversible: 3, mostly_irreversible: 4, fully_irreversible: 5 },
    dataSensitivityValues: { public: 1, internal: 2, confidential: 3, restricted: 4, critical: 5 },
    autonomyModeRiskValues: { manual_only: 1, human_in_loop: 2, assisted: 3, autonomous: 4, full_auto: 5 },
    tenantImpactValues: { personal: 1, team: 2, org: 3, multi_org: 4, platform: 5 },
    blastRadiusValues: { single_task: 1, workflow: 2, tenant: 3, platform: 5 },
    historicalFailureRateThresholds: {
      low: { maxPercent: 10, value: 1 },
      medium: { maxPercent: 30, value: 2 },
      high: { maxPercent: 50, value: 3 },
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

test("RiskConfig has all required factor weights", () => {
  const config = createTestConfig();

  assert.equal(typeof config.factorWeights.impact, "number");
  assert.equal(typeof config.factorWeights.irreversibility, "number");
  assert.equal(typeof config.factorWeights.dataSensitivity, "number");
  assert.equal(typeof config.factorWeights.autonomyModeRisk, "number");
  assert.equal(typeof config.factorWeights.tenantImpact, "number");
  assert.equal(typeof config.factorWeights.blastRadius, "number");
  assert.equal(typeof config.factorWeights.historicalFailureRate, "number");
  assert.equal(typeof config.factorWeights.evidenceConfidence, "number");
});

test("RiskConfig has all required risk level thresholds", () => {
  const config = createTestConfig();

  assert.equal(typeof config.riskLevelThresholds.low, "number");
  assert.equal(typeof config.riskLevelThresholds.medium, "number");
  assert.equal(typeof config.riskLevelThresholds.high, "number");
  assert.equal(typeof config.riskLevelThresholds.critical, "number");
});

test("RiskConfig has all required historical failure rate thresholds", () => {
  const config = createTestConfig();

  assert.equal(typeof config.historicalFailureRateThresholds.low.maxPercent, "number");
  assert.equal(typeof config.historicalFailureRateThresholds.low.value, "number");
  assert.equal(typeof config.historicalFailureRateThresholds.medium.maxPercent, "number");
  assert.equal(typeof config.historicalFailureRateThresholds.medium.value, "number");
  assert.equal(typeof config.historicalFailureRateThresholds.high.maxPercent, "number");
  assert.equal(typeof config.historicalFailureRateThresholds.high.value, "number");
  assert.equal(typeof config.historicalFailureRateThresholds.critical.maxPercent, "number");
  assert.equal(typeof config.historicalFailureRateThresholds.critical.value, "number");
});

test("RiskLevelSchema accepts valid values", () => {
  assert.equal(RiskLevelSchema.parse("low"), "low");
  assert.equal(RiskLevelSchema.parse("medium"), "medium");
  assert.equal(RiskLevelSchema.parse("high"), "high");
  assert.equal(RiskLevelSchema.parse("critical"), "critical");
});

test("RiskLevelSchema rejects invalid values", () => {
  assert.throws(() => RiskLevelSchema.parse("invalid"));
  assert.throws(() => RiskLevelSchema.parse("LOW"));
  assert.throws(() => RiskLevelSchema.parse(""));
});

test("BlastRadiusSchema accepts valid values", () => {
  assert.equal(BlastRadiusSchema.parse(1), 1);
  assert.equal(BlastRadiusSchema.parse(2), 2);
  assert.equal(BlastRadiusSchema.parse(3), 3);
  assert.equal(BlastRadiusSchema.parse(4), 4);
  assert.equal(BlastRadiusSchema.parse(5), 5);
});

test("BlastRadiusSchema rejects invalid values", () => {
  assert.throws(() => BlastRadiusSchema.parse(0));
  assert.throws(() => BlastRadiusSchema.parse(6));
  assert.throws(() => BlastRadiusSchema.parse("global"));
});

test("ConfidenceLevelSchema accepts valid values", () => {
  assert.equal(ConfidenceLevelSchema.parse("high"), "high");
  assert.equal(ConfidenceLevelSchema.parse("medium"), "medium");
  assert.equal(ConfidenceLevelSchema.parse("low"), "low");
});

test("ConfidenceLevelSchema rejects invalid values", () => {
  assert.throws(() => ConfidenceLevelSchema.parse("HIGH"));
  assert.throws(() => ConfidenceLevelSchema.parse("very_high"));
  assert.throws(() => ConfidenceLevelSchema.parse(""));
});

test("RiskFactorsSchema accepts valid complete object", () => {
  const result = RiskFactorsSchema.parse({
    impact: 3,
    irreversibility: 2,
    dataSensitivity: 3,
    autonomyModeRisk: 2,
    tenantImpact: 2,
    blastRadius: 3,
    historicalFailureRate: 10,
    evidenceConfidence: "high",
  });

  assert.equal(result.impact, 3);
  assert.equal(result.historicalFailureRate, 10);
});

test("RiskFactorsSchema rejects historicalFailureRatePercent outside 0-100", () => {
  assert.throws(() => RiskFactorsSchema.parse({
    impact: 1,
    irreversibility: 1,
    dataSensitivity: 1,
    autonomyModeRisk: 1,
    tenantImpact: 1,
    blastRadius: 1,
    historicalFailureRate: -1,
    evidenceConfidence: "high",
  }));

  assert.throws(() => RiskFactorsSchema.parse({
    impact: 1,
    irreversibility: 1,
    dataSensitivity: 1,
    autonomyModeRisk: 1,
    tenantImpact: 1,
    blastRadius: 1,
    historicalFailureRate: 101,
    evidenceConfidence: "high",
  }));
});

test("RiskFactorsSchema rejects missing required fields", () => {
  assert.throws(() => RiskFactorsSchema.parse({
    impact: 1,
    irreversibility: 1,
    dataSensitivity: 1,
    autonomyModeRisk: 1,
    tenantImpact: 1,
    blastRadius: 1,
  }));
});

test("RiskEvaluationEngine works without domainRiskProfiles", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  assert.ok(engine != null);

  const request: RiskEvaluationRequest = {
    taskId: "task-no-domain",
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
  };

  const result = engine.evaluate(request);
  assert.equal(result.riskLevel, "low");
});

test("RiskEvaluationEngine works with empty domainRiskProfiles Map", () => {
  const engine = new RiskEvaluationEngine({
    config: createTestConfig(),
    domainRiskProfiles: new Map(),
  });

  const request: RiskEvaluationRequest = {
    taskId: "task-empty-domain",
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
  };

  const result = engine.evaluate(request);
  assert.equal(result.riskLevel, "low");
});
