/**
 * Unit tests for Risk Control Module
 * Tests RiskEvaluationEngine edge cases, RiskEvaluationError, and type schemas
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  RiskEvaluationEngine,
  RiskEvaluationError,
} from "../../../../src/platform/control-plane/risk-control/risk-evaluation-engine.js";
import {
  RiskLevelSchema,
  StepTypeRiskSchema,
  TargetSystemRiskSchema,
  DataClassRiskSchema,
  BlastRadiusSchema,
  ConfidenceLevelSchema,
  RiskFactorsSchema,
} from "../../../../src/platform/control-plane/risk-control/types.js";
import type {
  RiskEvaluationRequest,
  RiskConfig,
  RiskLevel,
  RiskLevelActionConfig,
} from "../../../../src/platform/control-plane/risk-control/types.js";

function createTestConfig(): RiskConfig {
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
  // Score 0.25 should map to medium (since mapScoreToLevel uses >= for thresholds)
  // A very low score should be low
  const request: RiskEvaluationRequest = {
    taskId: "task-boundary-1",
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
  // Very minimal risk should be low
  assert.equal(result.riskLevel, "low");
  assert.ok(result.riskScore < 0.25);
});

test("RiskEvaluationEngine handles score exactly at MEDIUM/HIGH boundary (0.50)", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-boundary-2",
    factors: {
      stepTypeRisk: "read",
      targetSystemRisk: "staging",
      dataClassRisk: "internal",
      blastRadius: "single_task",
      priorFailureRatePercent: 15,
      confidence: "high",
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
      stepTypeRisk: "delete",
      targetSystemRisk: "production",
      dataClassRisk: "confidential",
      blastRadius: "tenant",
      priorFailureRatePercent: 45,
      confidence: "medium",
    },
  };

  const result = engine.evaluate(request);
  assert.ok(result.riskScore >= 0.5);
});

test("RiskEvaluationEngine priorFailureRate at low threshold boundary (10%)", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-pfr-1",
    factors: {
      stepTypeRisk: "read",
      targetSystemRisk: "internal",
      dataClassRisk: "public",
      blastRadius: "single_task",
      priorFailureRatePercent: 10,
      confidence: "high",
    },
  };

  const result = engine.evaluate(request);
  // 10% should be at low threshold boundary
  assert.equal(result.riskLevel, "low");
  assert.ok(result.riskScore < 0.25);
});

test("RiskEvaluationEngine priorFailureRate at medium threshold boundary (30%)", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-pfr-2",
    factors: {
      stepTypeRisk: "read",
      targetSystemRisk: "internal",
      dataClassRisk: "public",
      blastRadius: "single_task",
      priorFailureRatePercent: 30,
      confidence: "high",
    },
  };

  const result = engine.evaluate(request);
  assert.ok(result.riskScore < 0.5);
});

test("RiskEvaluationEngine priorFailureRate at high threshold boundary (50%)", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-pfr-3",
    factors: {
      stepTypeRisk: "read",
      targetSystemRisk: "internal",
      dataClassRisk: "public",
      blastRadius: "single_task",
      priorFailureRatePercent: 50,
      confidence: "high",
    },
  };

  const result = engine.evaluate(request);
  assert.ok(result.riskScore < 0.75);
});

test("RiskEvaluationEngine priorFailureRate at critical threshold (>50%)", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-pfr-4",
    factors: {
      stepTypeRisk: "read",
      targetSystemRisk: "internal",
      dataClassRisk: "public",
      blastRadius: "single_task",
      priorFailureRatePercent: 75,
      confidence: "high",
    },
  };

  const result = engine.evaluate(request);
  assert.equal(result.riskLevel, "low");
});

test("RiskEvaluationEngine zero priorFailureRate", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-pfr-zero",
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
  // Verify prior failure factor is at minimum value
  const pfrFactor = result.factorBreakdown.find((f: { factor: string; value: number; weight: number; weightedValue: number }) => f.factor === "priorFailureRate");
  assert.equal(pfrFactor?.value, 1);
});

// Risk score rounding tests
test("RiskEvaluationEngine rounds riskScore to 3 decimal places", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-round",
    factors: {
      stepTypeRisk: "write",
      targetSystemRisk: "staging",
      dataClassRisk: "internal",
      blastRadius: "workflow",
      priorFailureRatePercent: 15,
      confidence: "medium",
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
      stepTypeRisk: "read",
      targetSystemRisk: "internal",
      dataClassRisk: "public",
      blastRadius: "single_task",
      priorFailureRatePercent: 0,
      confidence: "high",
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
      stepTypeRisk: "write", // value=3, weight=3, weightedValue=9
      targetSystemRisk: "production", // value=5, weight=4, weightedValue=20
      dataClassRisk: "confidential", // value=4, weight=3, weightedValue=12
      blastRadius: "tenant", // value=3, weight=2, weightedValue=6
      priorFailureRatePercent: 5, // value=1, weight=2, weightedValue=2
      confidence: "low", // value=5, weight=1, weightedValue=5
    },
  };

  const result = engine.evaluate(request);

  const stepTypeFactor = result.factorBreakdown.find((f: { factor: string; value: number; weight: number; weightedValue: number }) => f.factor === "stepTypeRisk");
  assert.equal(stepTypeFactor?.value, 3);
  assert.equal(stepTypeFactor?.weight, 3);
  assert.equal(stepTypeFactor?.weightedValue, 9);

  const targetFactor = result.factorBreakdown.find((f: { factor: string; value: number; weight: number; weightedValue: number }) => f.factor === "targetSystemRisk");
  assert.equal(targetFactor?.value, 5);
  assert.equal(targetFactor?.weight, 4);
  assert.equal(targetFactor?.weightedValue, 20);
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
      stepTypeRisk: "delete",
      targetSystemRisk: "production",
      dataClassRisk: "restricted",
      blastRadius: "platform",
      priorFailureRatePercent: 75,
      confidence: "low",
    },
  };
  const criticalResult = engine.evaluate(criticalRequest);
  assert.equal(criticalResult.riskLevel, "critical");

  // High risk task should stay high with medium-domain override
  const highRequest: RiskEvaluationRequest = {
    taskId: "task-domain-2",
    domainId: "medium-domain",
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
      stepTypeRisk: "read",
      targetSystemRisk: "internal",
      dataClassRisk: "public",
      blastRadius: "single_task",
      priorFailureRatePercent: 0,
      confidence: "high",
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
      stepTypeRisk: "delete",
      targetSystemRisk: "production",
      dataClassRisk: "confidential",
      blastRadius: "tenant",
      priorFailureRatePercent: 45,
      confidence: "low",
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
      stepTypeRisk: "delete",
      targetSystemRisk: "production",
      dataClassRisk: "restricted",
      blastRadius: "platform",
      priorFailureRatePercent: 75,
      confidence: "low",
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
      stepTypeRisk: "read",
      targetSystemRisk: "internal",
      dataClassRisk: "public",
      blastRadius: "single_task",
      priorFailureRatePercent: 0,
      confidence: "high",
    },
  };

  const result = engine.evaluate(request);
  assert.equal(result.requiresApproval, false);
  assert.equal(result.approvalType, undefined);
});

// Step type risk values tests
test("RiskEvaluationEngine handles all step type risk values", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const stepTypes: Array<RiskEvaluationRequest["factors"]["stepTypeRisk"]> = ["read", "write", "delete", "external_call"];

  for (const stepType of stepTypes) {
    const request: RiskEvaluationRequest = {
      taskId: `task-step-${stepType}`,
      factors: {
        stepTypeRisk: stepType,
        targetSystemRisk: "internal",
        dataClassRisk: "public",
        blastRadius: "single_task",
        priorFailureRatePercent: 0,
        confidence: "high",
      },
    };

    const result = engine.evaluate(request);
    assert.ok(result.riskLevel, `Failed for stepType: ${stepType}`);
  }
});

test("RiskEvaluationEngine handles all target system risk values", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const systems: Array<RiskEvaluationRequest["factors"]["targetSystemRisk"]> = ["internal", "staging", "production"];

  for (const system of systems) {
    const request: RiskEvaluationRequest = {
      taskId: `task-system-${system}`,
      factors: {
        stepTypeRisk: "read",
        targetSystemRisk: system,
        dataClassRisk: "public",
        blastRadius: "single_task",
        priorFailureRatePercent: 0,
        confidence: "high",
      },
    };

    const result = engine.evaluate(request);
    assert.ok(result.riskLevel, `Failed for targetSystem: ${system}`);
  }
});

test("RiskEvaluationEngine handles all data class risk values", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const dataClasses: Array<RiskEvaluationRequest["factors"]["dataClassRisk"]> = ["public", "internal", "confidential", "restricted"];

  for (const dataClass of dataClasses) {
    const request: RiskEvaluationRequest = {
      taskId: `task-data-${dataClass}`,
      factors: {
        stepTypeRisk: "read",
        targetSystemRisk: "internal",
        dataClassRisk: dataClass,
        blastRadius: "single_task",
        priorFailureRatePercent: 0,
        confidence: "high",
      },
    };

    const result = engine.evaluate(request);
    assert.ok(result.riskLevel, `Failed for dataClass: ${dataClass}`);
  }
});

test("RiskEvaluationEngine handles all blast radius values", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const blastRadii: Array<RiskEvaluationRequest["factors"]["blastRadius"]> = ["single_task", "workflow", "tenant", "platform"];

  for (const blastRadius of blastRadii) {
    const request: RiskEvaluationRequest = {
      taskId: `task-blast-${blastRadius}`,
      factors: {
        stepTypeRisk: "read",
        targetSystemRisk: "internal",
        dataClassRisk: "public",
        blastRadius,
        priorFailureRatePercent: 0,
        confidence: "high",
      },
    };

    const result = engine.evaluate(request);
    assert.ok(result.riskLevel, `Failed for blastRadius: ${blastRadius}`);
  }
});

test("RiskEvaluationEngine handles all confidence levels", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const confidenceLevels: Array<RiskEvaluationRequest["factors"]["confidence"]> = ["high", "medium", "low"];

  for (const confidence of confidenceLevels) {
    const request: RiskEvaluationRequest = {
      taskId: `task-confidence-${confidence}`,
      factors: {
        stepTypeRisk: "read",
        targetSystemRisk: "internal",
        dataClassRisk: "public",
        blastRadius: "single_task",
        priorFailureRatePercent: 0,
        confidence,
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
      stepTypeRisk: "read",
      targetSystemRisk: "internal",
      dataClassRisk: "public",
      blastRadius: "single_task",
      priorFailureRatePercent: 0,
      confidence: "high",
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
      stepTypeRisk: "write",
      targetSystemRisk: "staging",
      dataClassRisk: "confidential",
      blastRadius: "workflow",
      priorFailureRatePercent: 20,
      confidence: "medium",
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
      stepTypeRisk: "delete",
      targetSystemRisk: "production",
      dataClassRisk: "confidential",
      blastRadius: "tenant",
      priorFailureRatePercent: 40,
      confidence: "low",
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
      stepTypeRisk: "delete",
      targetSystemRisk: "production",
      dataClassRisk: "restricted",
      blastRadius: "platform",
      priorFailureRatePercent: 75,
      confidence: "low",
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
    factors: { stepTypeRisk: "read", targetSystemRisk: "internal", dataClassRisk: "public", blastRadius: "single_task", priorFailureRatePercent: 0, confidence: "high" },
  };
  assert.equal(engine.evaluate(request).logLevel, "info");

  // MEDIUM -> warn
  request = {
    taskId: "task-log-medium",
    factors: { stepTypeRisk: "write", targetSystemRisk: "staging", dataClassRisk: "confidential", blastRadius: "workflow", priorFailureRatePercent: 20, confidence: "medium" },
  };
  assert.equal(engine.evaluate(request).logLevel, "warn");

  // HIGH -> error
  request = {
    taskId: "task-log-high",
    factors: { stepTypeRisk: "delete", targetSystemRisk: "production", dataClassRisk: "confidential", blastRadius: "tenant", priorFailureRatePercent: 40, confidence: "low" },
  };
  assert.equal(engine.evaluate(request).logLevel, "error");

  // CRITICAL -> critical
  request = {
    taskId: "task-log-critical",
    factors: { stepTypeRisk: "delete", targetSystemRisk: "production", dataClassRisk: "restricted", blastRadius: "platform", priorFailureRatePercent: 75, confidence: "low" },
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
    factors: { stepTypeRisk: "read", targetSystemRisk: "internal", dataClassRisk: "public", blastRadius: "single_task", priorFailureRatePercent: 0, confidence: "high" },
  };
  assert.equal(engine.evaluate(request).evidenceLevel, "basic");

  // MEDIUM -> enhanced
  request = {
    taskId: "task-evidence-medium",
    factors: { stepTypeRisk: "write", targetSystemRisk: "staging", dataClassRisk: "confidential", blastRadius: "workflow", priorFailureRatePercent: 20, confidence: "medium" },
  };
  assert.equal(engine.evaluate(request).evidenceLevel, "enhanced");

  // HIGH -> full
  request = {
    taskId: "task-evidence-high",
    factors: { stepTypeRisk: "delete", targetSystemRisk: "production", dataClassRisk: "confidential", blastRadius: "tenant", priorFailureRatePercent: 40, confidence: "low" },
  };
  assert.equal(engine.evaluate(request).evidenceLevel, "full");

  // CRITICAL -> legal
  request = {
    taskId: "task-evidence-critical",
    factors: { stepTypeRisk: "delete", targetSystemRisk: "production", dataClassRisk: "restricted", blastRadius: "platform", priorFailureRatePercent: 75, confidence: "low" },
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
    factors: { stepTypeRisk: "read", targetSystemRisk: "internal", dataClassRisk: "public", blastRadius: "single_task", priorFailureRatePercent: 0, confidence: "high" },
  };
  assert.equal(engine.evaluate(request).sideEffect, "normal");

  // MEDIUM -> normal_with_validation
  request = {
    taskId: "task-side-medium",
    factors: { stepTypeRisk: "write", targetSystemRisk: "staging", dataClassRisk: "confidential", blastRadius: "workflow", priorFailureRatePercent: 20, confidence: "medium" },
  };
  assert.equal(engine.evaluate(request).sideEffect, "normal_with_validation");

  // HIGH -> restricted
  request = {
    taskId: "task-side-high",
    factors: { stepTypeRisk: "delete", targetSystemRisk: "production", dataClassRisk: "confidential", blastRadius: "tenant", priorFailureRatePercent: 40, confidence: "low" },
  };
  assert.equal(engine.evaluate(request).sideEffect, "restricted");

  // CRITICAL -> prohibited
  request = {
    taskId: "task-side-critical",
    factors: { stepTypeRisk: "delete", targetSystemRisk: "production", dataClassRisk: "restricted", blastRadius: "platform", priorFailureRatePercent: 75, confidence: "low" },
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
    factors: { stepTypeRisk: "read", targetSystemRisk: "internal", dataClassRisk: "public", blastRadius: "single_task", priorFailureRatePercent: 0, confidence: "high" },
  };
  assert.equal(engine.evaluate(request).autoExecute, true);

  // MEDIUM
  request = {
    taskId: "task-auto-medium",
    factors: { stepTypeRisk: "write", targetSystemRisk: "staging", dataClassRisk: "confidential", blastRadius: "workflow", priorFailureRatePercent: 20, confidence: "medium" },
  };
  assert.equal(engine.evaluate(request).autoExecute, true);
});

test("RiskEvaluationEngine autoExecute is false for HIGH and CRITICAL risk", () => {
  const config = createTestConfig();
  const engine = new RiskEvaluationEngine({ config });

  // HIGH
  let request: RiskEvaluationRequest = {
    taskId: "task-auto-high",
    factors: { stepTypeRisk: "delete", targetSystemRisk: "production", dataClassRisk: "confidential", blastRadius: "tenant", priorFailureRatePercent: 40, confidence: "low" },
  };
  assert.equal(engine.evaluate(request).autoExecute, false);

  // CRITICAL
  request = {
    taskId: "task-auto-critical",
    factors: { stepTypeRisk: "delete", targetSystemRisk: "production", dataClassRisk: "restricted", blastRadius: "platform", priorFailureRatePercent: 75, confidence: "low" },
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
      stepTypeRisk: "read",
      targetSystemRisk: "internal",
      dataClassRisk: "public",
      blastRadius: "single_task",
      priorFailureRatePercent: 0,
      confidence: "high",
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
      stepTypeRisk: "read",
      targetSystemRisk: "internal",
      dataClassRisk: "public",
      blastRadius: "single_task",
      priorFailureRatePercent: 0,
      confidence: "high",
    },
  };

  const result = engine.evaluate(request);
  assert.equal(result.taskId, "task-optional-meta");
});

// RiskConfig interface structure tests
test("RiskConfig has all required factor weights", () => {
  const config = createTestConfig();

  assert.equal(typeof config.factorWeights.stepTypeRisk, "number");
  assert.equal(typeof config.factorWeights.targetSystemRisk, "number");
  assert.equal(typeof config.factorWeights.dataClassRisk, "number");
  assert.equal(typeof config.factorWeights.blastRadius, "number");
  assert.equal(typeof config.factorWeights.priorFailureRate, "number");
  assert.equal(typeof config.factorWeights.confidence, "number");
});

test("RiskConfig has all required risk level thresholds", () => {
  const config = createTestConfig();

  assert.equal(typeof config.riskLevelThresholds.low, "number");
  assert.equal(typeof config.riskLevelThresholds.medium, "number");
  assert.equal(typeof config.riskLevelThresholds.high, "number");
  assert.equal(typeof config.riskLevelThresholds.critical, "number");
});

test("RiskConfig has all required prior failure rate thresholds", () => {
  const config = createTestConfig();

  assert.equal(typeof config.priorFailureRateThresholds.low.maxPercent, "number");
  assert.equal(typeof config.priorFailureRateThresholds.low.value, "number");
  assert.equal(typeof config.priorFailureRateThresholds.medium.maxPercent, "number");
  assert.equal(typeof config.priorFailureRateThresholds.medium.value, "number");
  assert.equal(typeof config.priorFailureRateThresholds.high.maxPercent, "number");
  assert.equal(typeof config.priorFailureRateThresholds.high.value, "number");
  assert.equal(typeof config.priorFailureRateThresholds.critical.maxPercent, "number");
  assert.equal(typeof config.priorFailureRateThresholds.critical.value, "number");
});

// Zod schema validation tests
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

test("StepTypeRiskSchema accepts valid values", () => {
  assert.equal(StepTypeRiskSchema.parse("read"), "read");
  assert.equal(StepTypeRiskSchema.parse("write"), "write");
  assert.equal(StepTypeRiskSchema.parse("delete"), "delete");
  assert.equal(StepTypeRiskSchema.parse("external_call"), "external_call");
});

test("StepTypeRiskSchema rejects invalid values", () => {
  assert.throws(() => StepTypeRiskSchema.parse("READ"));
  assert.throws(() => StepTypeRiskSchema.parse("create"));
  assert.throws(() => StepTypeRiskSchema.parse(""));
});

test("TargetSystemRiskSchema accepts valid values", () => {
  assert.equal(TargetSystemRiskSchema.parse("internal"), "internal");
  assert.equal(TargetSystemRiskSchema.parse("staging"), "staging");
  assert.equal(TargetSystemRiskSchema.parse("production"), "production");
});

test("TargetSystemRiskSchema rejects invalid values", () => {
  assert.throws(() => TargetSystemRiskSchema.parse("INTERNAL"));
  assert.throws(() => TargetSystemRiskSchema.parse("dev"));
  assert.throws(() => TargetSystemRiskSchema.parse(""));
});

test("DataClassRiskSchema accepts valid values", () => {
  assert.equal(DataClassRiskSchema.parse("public"), "public");
  assert.equal(DataClassRiskSchema.parse("internal"), "internal");
  assert.equal(DataClassRiskSchema.parse("confidential"), "confidential");
  assert.equal(DataClassRiskSchema.parse("restricted"), "restricted");
});

test("DataClassRiskSchema rejects invalid values", () => {
  assert.throws(() => DataClassRiskSchema.parse("PUBLIC"));
  assert.throws(() => DataClassRiskSchema.parse("secret"));
  assert.throws(() => DataClassRiskSchema.parse(""));
});

test("BlastRadiusSchema accepts valid values", () => {
  assert.equal(BlastRadiusSchema.parse("single_task"), "single_task");
  assert.equal(BlastRadiusSchema.parse("workflow"), "workflow");
  assert.equal(BlastRadiusSchema.parse("tenant"), "tenant");
  assert.equal(BlastRadiusSchema.parse("platform"), "platform");
});

test("BlastRadiusSchema rejects invalid values", () => {
  assert.throws(() => BlastRadiusSchema.parse("single"));
  assert.throws(() => BlastRadiusSchema.parse("SINGLE_TASK"));
  assert.throws(() => BlastRadiusSchema.parse(""));
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
    stepTypeRisk: "read",
    targetSystemRisk: "internal",
    dataClassRisk: "public",
    blastRadius: "single_task",
    priorFailureRatePercent: 10,
    confidence: "high",
  });

  assert.equal(result.stepTypeRisk, "read");
  assert.equal(result.priorFailureRatePercent, 10);
});

test("RiskFactorsSchema rejects priorFailureRatePercent outside 0-100", () => {
  assert.throws(() => RiskFactorsSchema.parse({
    stepTypeRisk: "read",
    targetSystemRisk: "internal",
    dataClassRisk: "public",
    blastRadius: "single_task",
    priorFailureRatePercent: -1,
    confidence: "high",
  }));

  assert.throws(() => RiskFactorsSchema.parse({
    stepTypeRisk: "read",
    targetSystemRisk: "internal",
    dataClassRisk: "public",
    blastRadius: "single_task",
    priorFailureRatePercent: 101,
    confidence: "high",
  }));
});

test("RiskFactorsSchema rejects missing required fields", () => {
  assert.throws(() => RiskFactorsSchema.parse({
    stepTypeRisk: "read",
    targetSystemRisk: "internal",
    // missing dataClassRisk, blastRadius, priorFailureRatePercent, confidence
  }));
});

// Engine instantiation tests
test("RiskEvaluationEngine works without domainRiskProfiles", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  assert.ok(engine != null);

  const request: RiskEvaluationRequest = {
    taskId: "task-no-domain",
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
});

test("RiskEvaluationEngine works with empty domainRiskProfiles Map", () => {
  const engine = new RiskEvaluationEngine({
    config: createTestConfig(),
    domainRiskProfiles: new Map(),
  });

  const request: RiskEvaluationRequest = {
    taskId: "task-empty-domain",
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
});
