import assert from "node:assert/strict";
import test from "node:test";
import { RiskEvaluationEngine } from "../../../../../src/platform/five-plane-control-plane/risk-control/risk-evaluation-engine.js";
import type { RiskEvaluationRequest, RiskConfig } from "../../../../../src/platform/five-plane-control-plane/risk-control/types.js";

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
      high: { autoExecute: false, logLevel: "error", requiresApproval: true, sideEffect: "restricted", evidenceLevel: "full" },
      critical: { autoExecute: false, logLevel: "critical", requiresApproval: true, approvalType: "break_glass", sideEffect: "prohibited", evidenceLevel: "legal" },
    },
  };
}

test("RiskEvaluationEngine calculates LOW risk for minimal factors", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-001",
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

  assert.equal(result.riskLevel, "low");
  assert.equal(result.autoExecute, true);
  assert.equal(result.requiresApproval, false);
  assert.ok(result.riskScore < 0.25);
});

test("RiskEvaluationEngine calculates MEDIUM risk for moderate factors", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-002",
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

  assert.equal(result.riskLevel, "medium");
  assert.equal(result.autoExecute, true);
  assert.equal(result.requiresApproval, false);
  assert.ok(result.riskScore >= 0.5);
  assert.ok(result.riskScore < 0.75);
});

test("RiskEvaluationEngine calculates HIGH risk for elevated factors", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-003",
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
  assert.equal(result.autoExecute, false);
  assert.equal(result.requiresApproval, true);
  assert.ok(result.riskScore >= 0.75);
});

test("RiskEvaluationEngine calculates CRITICAL risk for maximum factors", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-004",
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
  assert.equal(result.autoExecute, false);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.approvalType, "break_glass");
  assert.equal(result.evidenceLevel, "legal");
  assert.equal(result.riskScore, 1.0);
});

test("RiskEvaluationEngine returns correct actions for LOW risk", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-005",
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

  assert.ok(result.actions.includes("log"));
  assert.ok(result.actions.includes("proceed"));
  assert.equal(result.sideEffect, "normal");
  assert.equal(result.evidenceLevel, "basic");
});

test("RiskEvaluationEngine returns correct actions for HIGH risk", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-006",
    factors: {
      stepTypeRisk: "write",
      targetSystemRisk: "production",
      dataClassRisk: "confidential",
      blastRadius: "tenant",
      priorFailureRatePercent: 35,
      confidence: "low",
    },
  };

  const result = engine.evaluate(request);

  assert.ok(result.actions.includes("block"));
  assert.ok(result.actions.includes("require_approval"));
  assert.ok(result.actions.includes("full_evidence"));
  assert.equal(result.sideEffect, "restricted");
  assert.equal(result.evidenceLevel, "full");
});

test("RiskEvaluationEngine returns correct actions for CRITICAL risk", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-007",
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

  assert.ok(result.actions.includes("block"));
  assert.ok(result.actions.includes("require_break_glass_approval"));
  assert.ok(result.actions.includes("legal_evidence"));
  assert.ok(result.actions.includes("incident_create"));
  assert.equal(result.sideEffect, "prohibited");
  assert.equal(result.evidenceLevel, "legal");
});

test("RiskEvaluationEngine applies domain override to raise risk level", () => {
  const domainProfileConfig = createTestConfig();
  const domainProfiles = new Map([["high-risk-domain", "high" as const]]);
  const engine = new RiskEvaluationEngine({
    config: domainProfileConfig,
    domainRiskProfiles: domainProfiles,
  });
  const request: RiskEvaluationRequest = {
    taskId: "task-008",
    domainId: "high-risk-domain",
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

test("RiskEvaluationEngine applies domain override to legacy requests", () => {
  const engine = new RiskEvaluationEngine({
    config: createTestConfig(),
    domainRiskProfiles: new Map([["legacy-domain", "high" as const]]),
  });

  const result = engine.evaluate({
    taskId: "task-legacy-domain",
    domainId: "legacy-domain",
    factors: {
      operationRisk: "read",
      targetResourceCriticality: "internal",
      dataSensitivity: "public",
      autonomyModeRisk: "suggestion",
      tenantImpact: "single_task",
      blastRadius: "single_task",
      historicalFailureRate: "low",
      evidenceConfidence: "high",
    },
  });

  assert.equal(result.riskLevel, "high");
});

test("RiskEvaluationEngine rejects mixed legacy and six-factor schemas", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });

  assert.throws(
    () => engine.evaluate({
      taskId: "task-mixed-schema",
      factors: {
        operationRisk: "write",
        targetResourceCriticality: "production",
        stepTypeRisk: "delete",
        targetSystemRisk: "production",
        dataClassRisk: "restricted",
        blastRadius: "platform",
        priorFailureRatePercent: 80,
        confidence: "low",
      },
    }),
    (error: unknown) => error instanceof Error && (error as { code?: string }).code === "risk.schema_mixed",
  );
});

test("RiskEvaluationEngine does not lower risk level via domain override", () => {
  const domainProfileConfig = createTestConfig();
  const domainProfiles = new Map([["high-risk-domain", "high" as const]]);
  const engine = new RiskEvaluationEngine({
    config: domainProfileConfig,
    domainRiskProfiles: domainProfiles,
  });
  const request: RiskEvaluationRequest = {
    taskId: "task-009",
    domainId: "high-risk-domain",
    factors: {
      stepTypeRisk: "delete",
      targetSystemRisk: "production",
      dataClassRisk: "restricted",
      blastRadius: "platform",
      priorFailureRatePercent: 80,
      confidence: "low",
    },
  };

  const result = engine.evaluate(request);

  assert.equal(result.riskLevel, "critical");
});

test("RiskEvaluationEngine returns detailed factor breakdown", () => {
  const engine = new RiskEvaluationEngine({ config: createTestConfig() });
  const request: RiskEvaluationRequest = {
    taskId: "task-010",
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

  assert.equal(result.factorBreakdown.length, 6);
  assert.deepEqual(result.factorBreakdown.map((f) => f.factor), [
    "stepTypeRisk",
    "targetSystemRisk",
    "dataClassRisk",
    "blastRadius",
    "priorFailureRate",
    "confidence",
  ]);
});
