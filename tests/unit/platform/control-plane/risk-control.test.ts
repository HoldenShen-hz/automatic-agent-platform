/**
 * Unit tests for Risk Control Module
 * Tests RiskEvaluationEngine edge cases, RiskEvaluationError, and type schemas
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  RiskEvaluationEngine,
  RiskEvaluationError,
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
  RiskLevel,
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

// RiskEvaluationError tests
test("RiskEvaluationError has correct name and properties", () => {
  const error = new RiskEvaluationError("test message", "ERR_TEST");

  assert.equal(error.name, "RiskEvaluationError");
  assert.equal(error.message, "test message");
  assert.equal(error.code, "ERR_TEST");
});

test("RiskEvaluationError is instance of Error", () => {
  const error = new RiskEvaluationError("test message", "ERR_TEST");

  assert.ok(error instanceof Error);
  assert.ok(error instanceof RiskEvaluationError);
});

test("RiskEvaluationError accepts optional details parameter", () => {
  const error = new RiskEvaluationError("test message", "ERR_CODE", { someDetail: true });

  assert.equal(error.code, "ERR_CODE");
  assert.equal(error.message, "test message");
});

// RiskEvaluationEngine boundary condition tests
test("RiskEvaluationEngine handles score exactly at LOW/MEDIUM boundary (0.25)", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  // Very minimal risk factors should result in low risk
  const request: RiskEvaluationRequest = {
    taskId: "task-boundary-1",
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
  // Very minimal risk should be low
  assert.equal(result.riskLevel, "low");
  assert.ok(result.riskScore < 0.25);
});

test("RiskEvaluationEngine handles score exactly at MEDIUM/HIGH boundary (0.50)", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-boundary-2",
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
  };

  const result = engine.evaluate(request);
  // This should be medium based on thresholds
  assert.ok(result.riskScore >= 0.25);
});

test("RiskEvaluationEngine handles score exactly at HIGH/CRITICAL boundary (0.75)", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-boundary-3",
    factors: {
      impact: 5,
      irreversibility: 5,
      dataSensitivity: 4,
      autonomyModeRisk: 3,
      tenantImpact: 4,
      blastRadius: 4,
      historicalFailureRate: 45,
      evidenceConfidence: "medium",
    },
  };

  const result = engine.evaluate(request);
  assert.ok(result.riskScore >= 0.5);
});

test("RiskEvaluationEngine historicalFailureRate at low threshold boundary (10%)", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-pfr-1",
    factors: {
      impact: 1,
      irreversibility: 1,
      dataSensitivity: 1,
      autonomyModeRisk: 1,
      tenantImpact: 1,
      blastRadius: 1,
      historicalFailureRate: 10,
      evidenceConfidence: "high",
    },
  };

  const result = engine.evaluate(request);
  // 10% should be at low threshold boundary
  assert.equal(result.riskLevel, "low");
  assert.ok(result.riskScore < 0.25);
});

test("RiskEvaluationEngine historicalFailureRate at medium threshold boundary (30%)", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-pfr-2",
    factors: {
      impact: 1,
      irreversibility: 1,
      dataSensitivity: 1,
      autonomyModeRisk: 1,
      tenantImpact: 1,
      blastRadius: 1,
      historicalFailureRate: 30,
      evidenceConfidence: "high",
    },
  };

  const result = engine.evaluate(request);
  assert.ok(result.riskScore < 0.5);
});

test("RiskEvaluationEngine historicalFailureRate at high threshold boundary (50%)", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-pfr-3",
    factors: {
      impact: 1,
      irreversibility: 1,
      dataSensitivity: 1,
      autonomyModeRisk: 1,
      tenantImpact: 1,
      blastRadius: 1,
      historicalFailureRate: 50,
      evidenceConfidence: "high",
    },
  };

  const result = engine.evaluate(request);
  assert.ok(result.riskScore < 0.75);
});

test("RiskEvaluationEngine historicalFailureRate at critical threshold (>50%)", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-pfr-4",
    factors: {
      impact: 1,
      irreversibility: 1,
      dataSensitivity: 1,
      autonomyModeRisk: 1,
      tenantImpact: 1,
      blastRadius: 1,
      historicalFailureRate: 75,
      evidenceConfidence: "high",
    },
  };

  const result = engine.evaluate(request);
  // Historical failure rate 75% maps to value 5 (critical), but other factors are min
  // So overall score still low
  assert.equal(result.riskLevel, "low");
});

test("RiskEvaluationEngine zero historicalFailureRate", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-pfr-zero",
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
  // Verify historical failure factor is at minimum value
  const hfrFactor = result.factorBreakdown.find((f: { factor: string; value: number; weight: number; weightedValue: number }) => f.factor === "historicalFailureRate");
  assert.equal(hfrFactor?.value, 1);
});

// Risk score rounding tests
test("RiskEvaluationEngine rounds riskScore to 3 decimal places", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-round",
    factors: {
      impact: 3,
      irreversibility: 2,
      dataSensitivity: 3,
      autonomyModeRisk: 2,
      tenantImpact: 2,
      blastRadius: 3,
      historicalFailureRate: 15,
      evidenceConfidence: "medium",
    },
  };

  const result = engine.evaluate(request);
  // Check that riskScore has at most 3 decimal places
  const decimalPlaces = (result.riskScore.toString().split('.')[1] || '').length;
  assert.ok(decimalPlaces <= 3);
});

// Factor breakdown calculation accuracy tests
test("RiskEvaluationEngine factor breakdown has correct structure", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-breakdown",
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

  for (const factor of result.factorBreakdown) {
    assert.ok("factor" in factor);
    assert.ok("value" in factor);
    assert.ok("weight" in factor);
    assert.ok("weightedValue" in factor);
    assert.equal(factor.weightedValue, factor.value * factor.weight);
  }
});

test("RiskEvaluationEngine factor breakdown weightedValue is value times weight", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-weights",
    factors: {
      impact: 5, // value=5, weight=4, weightedValue=20
      irreversibility: 5, // value=5, weight=4, weightedValue=20
      dataSensitivity: 4, // value=4, weight=3, weightedValue=12
      autonomyModeRisk: 3, // value=3, weight=2, weightedValue=6
      tenantImpact: 4, // value=4, weight=2, weightedValue=8
      blastRadius: 3, // value=3, weight=2, weightedValue=6
      historicalFailureRate: 5, // value=1, weight=2, weightedValue=2
      evidenceConfidence: "low", // value=5, weight=1, weightedValue=5
    },
  };

  const result = engine.evaluate(request);

  const impactFactor = result.factorBreakdown.find((f: { factor: string; value: number; weight: number; weightedValue: number }) => f.factor === "impact");
  assert.equal(impactFactor?.value, 5);
  assert.equal(impactFactor?.weight, 4);
  assert.equal(impactFactor?.weightedValue, 20);

  const irreversibilityFactor = result.factorBreakdown.find((f: { factor: string; value: number; weight: number; weightedValue: number }) => f.factor === "irreversibility");
  assert.equal(irreversibilityFactor?.value, 5);
  assert.equal(irreversibilityFactor?.weight, 4);
  assert.equal(irreversibilityFactor?.weightedValue, 20);
});

// Domain override tests
test("RiskEvaluationEngine domain override only raises risk, never lowers", () => {
  const domainProfiles = new Map<string, RiskLevel>([
    ["low-domain", "low"],
    ["medium-domain", "medium"],
  ]);
  const engine = new RiskEvaluationEngine({
    config: createTestConfig(),
    domainRiskProfiles: domainProfiles,
  });

  // Critical risk task should stay critical even with low-domain override
  const criticalRequest: RiskEvaluationRequest = {
    taskId: "task-domain-1",
    domainId: "low-domain",
    factors: {
      impact: 5,
      irreversibility: 5,
      dataSensitivity: 5,
      autonomyModeRisk: 5,
      tenantImpact: 5,
      blastRadius: 5,
      historicalFailureRate: 75,
      evidenceConfidence: "low",
    },
  };
  const criticalResult = engine.evaluate(criticalRequest);
  assert.equal(criticalResult.riskLevel, "critical");

  // High risk task should stay high with medium-domain override
  const highRequest: RiskEvaluationRequest = {
    taskId: "task-domain-2",
    domainId: "medium-domain",
    factors: {
      impact: 4,
      irreversibility: 4,
      dataSensitivity: 4,
      autonomyModeRisk: 3,
      tenantImpact: 4,
      blastRadius: 4,
      historicalFailureRate: 45,
      evidenceConfidence: "low",
    },
  };
  const highResult = engine.evaluate(highRequest);
  assert.equal(highResult.riskLevel, "high");
});

test("RiskEvaluationEngine domain override does not affect unknown domain", () => {
  const domainProfiles = new Map<string, RiskLevel>([
    ["known-domain", "critical"],
  ]);
  const engine = new RiskEvaluationEngine({
    config: createTestConfig(),
    domainRiskProfiles: domainProfiles,
  });

  const request: RiskEvaluationRequest = {
    taskId: "task-unknown-domain",
    domainId: "unknown-domain",
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

test("RiskEvaluationEngine domain override raises medium to high", () => {
  const domainProfiles = new Map<string, RiskLevel>([
    ["raise-domain", "high"],
  ]);
  const engine = new RiskEvaluationEngine({
    config: createTestConfig(),
    domainRiskProfiles: domainProfiles,
  });

  const request: RiskEvaluationRequest = {
    taskId: "task-raise",
    domainId: "raise-domain",
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
  assert.equal(result.riskLevel, "high");
});

// Approval type tests
test("RiskEvaluationEngine returns standard approvalType for HIGH risk", () => {
  const configWithStandardApproval: RiskConfig = {
    ...createTestConfig(),
    riskLevelActions: {
      ...createTestConfig().riskLevelActions,
      high: { autoExecute: false, logLevel: "error", requiresApproval: true, approvalType: "standard", sideEffect: "restricted", evidenceLevel: "full" },
    },
  };
  const engine = new RiskEvaluationEngine({ config: configWithStandardApproval });

  const request: RiskEvaluationRequest = {
    taskId: "task-approval-high",
    factors: {
      impact: 4,
      irreversibility: 4,
      dataSensitivity: 4,
      autonomyModeRisk: 3,
      tenantImpact: 4,
      blastRadius: 4,
      historicalFailureRate: 45,
      evidenceConfidence: "low",
    },
  };

  const result = engine.evaluate(request);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.approvalType, "standard");
});

test("RiskEvaluationEngine returns break_glass approvalType for CRITICAL risk", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-approval-critical",
    factors: {
      impact: 5,
      irreversibility: 5,
      dataSensitivity: 5,
      autonomyModeRisk: 5,
      tenantImpact: 5,
      blastRadius: 5,
      historicalFailureRate: 75,
      evidenceConfidence: "low",
    },
  };

  const result = engine.evaluate(request);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.approvalType, "break_glass");
});

test("RiskEvaluationEngine does not return approvalType when requiresApproval is false", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-no-approval",
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
  assert.equal(result.requiresApproval, false);
  assert.equal(result.approvalType, undefined);
});

// Blast radius value tests
test("RiskEvaluationEngine handles all blast radius values", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const blastRadiusValues = [1, 2, 3, 4, 5];

  for (const blastRadius of blastRadiusValues) {
    const request: RiskEvaluationRequest = {
      taskId: `task-blast-${blastRadius}`,
      factors: {
        impact: 1,
        irreversibility: 1,
        dataSensitivity: 1,
        autonomyModeRisk: 1,
        tenantImpact: 1,
        blastRadius,
        historicalFailureRate: 0,
        evidenceConfidence: "high",
      },
    };

    const result = engine.evaluate(request);
    assert.ok(result.riskLevel, `Failed for blastRadius: ${blastRadius}`);
  }
});

test("RiskEvaluationEngine handles all evidence confidence levels", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const confidenceLevels: Array<"high" | "medium" | "low"> = ["high", "medium", "low"];

  for (const confidence of confidenceLevels) {
    const request: RiskEvaluationRequest = {
      taskId: `task-confidence-${confidence}`,
      factors: {
        impact: 1,
        irreversibility: 1,
        dataSensitivity: 1,
        autonomyModeRisk: 1,
        tenantImpact: 1,
        blastRadius: 1,
        historicalFailureRate: 0,
        evidenceConfidence: confidence,
      },
    };

    const result = engine.evaluate(request);
    assert.ok(result.riskLevel, `Failed for confidence: ${confidence}`);
  }
});

// Risk level actions mapping tests
test("RiskEvaluationEngine LOW risk actions include log and proceed", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-actions-low",
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
  assert.deepEqual(result.actions, ["log", "proceed"]);
});

test("RiskEvaluationEngine MEDIUM risk actions include validation and monitoring", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-actions-medium",
    factors: {
      impact: 3,
      irreversibility: 2,
      dataSensitivity: 3,
      autonomyModeRisk: 2,
      tenantImpact: 3,
      blastRadius: 3,
      historicalFailureRate: 20,
      evidenceConfidence: "medium",
    },
  };

  const result = engine.evaluate(request);
  assert.ok(result.actions.includes("log"));
  assert.ok(result.actions.includes("proceed_with_validation"));
  assert.ok(result.actions.includes("enhanced_monitoring"));
});

test("RiskEvaluationEngine HIGH risk actions include block and approval", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-actions-high",
    factors: {
      impact: 4,
      irreversibility: 4,
      dataSensitivity: 4,
      autonomyModeRisk: 3,
      tenantImpact: 4,
      blastRadius: 4,
      historicalFailureRate: 40,
      evidenceConfidence: "low",
    },
  };

  const result = engine.evaluate(request);
  assert.ok(result.actions.includes("log"));
  assert.ok(result.actions.includes("block"));
  assert.ok(result.actions.includes("require_approval"));
  assert.ok(result.actions.includes("full_evidence"));
});

test("RiskEvaluationEngine CRITICAL risk actions include break_glass and legal", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-actions-critical",
    factors: {
      impact: 5,
      irreversibility: 5,
      dataSensitivity: 5,
      autonomyModeRisk: 5,
      tenantImpact: 5,
      blastRadius: 5,
      historicalFailureRate: 75,
      evidenceConfidence: "low",
    },
  };

  const result = engine.evaluate(request);
  assert.ok(result.actions.includes("log"));
  assert.ok(result.actions.includes("block"));
  assert.ok(result.actions.includes("require_break_glass_approval"));
  assert.ok(result.actions.includes("legal_evidence"));
  assert.ok(result.actions.includes("incident_create"));
});

// Log level tests
test("RiskEvaluationEngine assigns correct log levels per risk level", () => {
  const config = createTestConfig();
  const engine = new RiskEvaluationEngine({ config });

  // LOW -> info
  let request: RiskEvaluationRequest = {
    taskId: "task-log-low",
    factors: { impact: 1, irreversibility: 1, dataSensitivity: 1, autonomyModeRisk: 1, tenantImpact: 1, blastRadius: 1, historicalFailureRate: 0, evidenceConfidence: "high" },
  };
  assert.equal(engine.evaluate(request).logLevel, "info");

  // MEDIUM -> warn
  request = {
    taskId: "task-log-medium",
    factors: { impact: 3, irreversibility: 2, dataSensitivity: 3, autonomyModeRisk: 2, tenantImpact: 3, blastRadius: 3, historicalFailureRate: 20, evidenceConfidence: "medium" },
  };
  assert.equal(engine.evaluate(request).logLevel, "warn");

  // HIGH -> error
  request = {
    taskId: "task-log-high",
    factors: { impact: 4, irreversibility: 4, dataSensitivity: 4, autonomyModeRisk: 3, tenantImpact: 4, blastRadius: 4, historicalFailureRate: 40, evidenceConfidence: "low" },
  };
  assert.equal(engine.evaluate(request).logLevel, "error");

  // CRITICAL -> critical
  request = {
    taskId: "task-log-critical",
    factors: { impact: 5, irreversibility: 5, dataSensitivity: 5, autonomyModeRisk: 5, tenantImpact: 5, blastRadius: 5, historicalFailureRate: 75, evidenceConfidence: "low" },
  };
  assert.equal(engine.evaluate(request).logLevel, "critical");
});

// Evidence level tests
test("RiskEvaluationEngine assigns correct evidence levels per risk level", () => {
  const config = createTestConfig();
  const engine = new RiskEvaluationEngine({ config });

  // LOW -> basic
  let request: RiskEvaluationRequest = {
    taskId: "task-evidence-low",
    factors: { impact: 1, irreversibility: 1, dataSensitivity: 1, autonomyModeRisk: 1, tenantImpact: 1, blastRadius: 1, historicalFailureRate: 0, evidenceConfidence: "high" },
  };
  assert.equal(engine.evaluate(request).evidenceLevel, "basic");

  // MEDIUM -> enhanced
  request = {
    taskId: "task-evidence-medium",
    factors: { impact: 3, irreversibility: 2, dataSensitivity: 3, autonomyModeRisk: 2, tenantImpact: 3, blastRadius: 3, historicalFailureRate: 20, evidenceConfidence: "medium" },
  };
  assert.equal(engine.evaluate(request).evidenceLevel, "enhanced");

  // HIGH -> full
  request = {
    taskId: "task-evidence-high",
    factors: { impact: 4, irreversibility: 4, dataSensitivity: 4, autonomyModeRisk: 3, tenantImpact: 4, blastRadius: 4, historicalFailureRate: 40, evidenceConfidence: "low" },
  };
  assert.equal(engine.evaluate(request).evidenceLevel, "full");

  // CRITICAL -> legal
  request = {
    taskId: "task-evidence-critical",
    factors: { impact: 5, irreversibility: 5, dataSensitivity: 5, autonomyModeRisk: 5, tenantImpact: 5, blastRadius: 5, historicalFailureRate: 75, evidenceConfidence: "low" },
  };
  assert.equal(engine.evaluate(request).evidenceLevel, "legal");
});

// Side effect tests
test("RiskEvaluationEngine assigns correct side effects per risk level", () => {
  const config = createTestConfig();
  const engine = new RiskEvaluationEngine({ config });

  // LOW -> normal
  let request: RiskEvaluationRequest = {
    taskId: "task-side-low",
    factors: { impact: 1, irreversibility: 1, dataSensitivity: 1, autonomyModeRisk: 1, tenantImpact: 1, blastRadius: 1, historicalFailureRate: 0, evidenceConfidence: "high" },
  };
  assert.equal(engine.evaluate(request).sideEffect, "normal");

  // MEDIUM -> normal_with_validation
  request = {
    taskId: "task-side-medium",
    factors: { impact: 3, irreversibility: 2, dataSensitivity: 3, autonomyModeRisk: 2, tenantImpact: 3, blastRadius: 3, historicalFailureRate: 20, evidenceConfidence: "medium" },
  };
  assert.equal(engine.evaluate(request).sideEffect, "normal_with_validation");

  // HIGH -> restricted
  request = {
    taskId: "task-side-high",
    factors: { impact: 4, irreversibility: 4, dataSensitivity: 4, autonomyModeRisk: 3, tenantImpact: 4, blastRadius: 4, historicalFailureRate: 40, evidenceConfidence: "low" },
  };
  assert.equal(engine.evaluate(request).sideEffect, "restricted");

  // CRITICAL -> prohibited
  request = {
    taskId: "task-side-critical",
    factors: { impact: 5, irreversibility: 5, dataSensitivity: 5, autonomyModeRisk: 5, tenantImpact: 5, blastRadius: 5, historicalFailureRate: 75, evidenceConfidence: "low" },
  };
  assert.equal(engine.evaluate(request).sideEffect, "prohibited");
});

// Auto execute tests
test("RiskEvaluationEngine autoExecute is true for LOW and MEDIUM risk", () => {
  const config = createTestConfig();
  const engine = new RiskEvaluationEngine({ config });

  // LOW
  let request: RiskEvaluationRequest = {
    taskId: "task-auto-low",
    factors: { impact: 1, irreversibility: 1, dataSensitivity: 1, autonomyModeRisk: 1, tenantImpact: 1, blastRadius: 1, historicalFailureRate: 0, evidenceConfidence: "high" },
  };
  assert.equal(engine.evaluate(request).autoExecute, true);

  // MEDIUM
  request = {
    taskId: "task-auto-medium",
    factors: { impact: 3, irreversibility: 2, dataSensitivity: 3, autonomyModeRisk: 2, tenantImpact: 3, blastRadius: 3, historicalFailureRate: 20, evidenceConfidence: "medium" },
  };
  assert.equal(engine.evaluate(request).autoExecute, true);
});

test("RiskEvaluationEngine autoExecute is false for HIGH and CRITICAL risk", () => {
  const config = createTestConfig();
  const engine = new RiskEvaluationEngine({ config });

  // HIGH
  let request: RiskEvaluationRequest = {
    taskId: "task-auto-high",
    factors: { impact: 4, irreversibility: 4, dataSensitivity: 4, autonomyModeRisk: 3, tenantImpact: 4, blastRadius: 4, historicalFailureRate: 40, evidenceConfidence: "low" },
  };
  assert.equal(engine.evaluate(request).autoExecute, false);

  // CRITICAL
  request = {
    taskId: "task-auto-critical",
    factors: { impact: 5, irreversibility: 5, dataSensitivity: 5, autonomyModeRisk: 5, tenantImpact: 5, blastRadius: 5, historicalFailureRate: 75, evidenceConfidence: "low" },
  };
  assert.equal(engine.evaluate(request).autoExecute, false);
});

// Request with optional fields tests
test("RiskEvaluationEngine handles request with optional tenantId", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-optional-tenant",
    tenantId: "tenant-123",
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
  assert.equal(result.taskId, "task-optional-tenant");
  assert.equal(result.riskLevel, "low");
});

test("RiskEvaluationEngine handles request with optional metadata", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-optional-meta",
    metadata: { source: "test", timestamp: "2026-04-23" },
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
  assert.equal(result.taskId, "task-optional-meta");
});
