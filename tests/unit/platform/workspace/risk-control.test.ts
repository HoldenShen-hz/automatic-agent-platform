import assert from "node:assert/strict";
import test from "node:test";

import {
  RiskEvaluationEngine,
  loadRiskConfig,
  type RiskEvaluationRequest,
  type RiskLevel,
} from "../../../../src/platform/five-plane-control-plane/risk-control/index.js";

function createEngine(overrides?: { domainProfiles?: ReadonlyMap<string, RiskLevel> }) {
  return new RiskEvaluationEngine({
    config: loadRiskConfig(),
    ...(overrides?.domainProfiles != null ? { domainRiskProfiles: overrides.domainProfiles } : {}),
  });
}

test("RiskEvaluationEngine evaluates canonical 8-factor requests and emits factor breakdown", () => {
  const engine = createEngine();
  const result = engine.evaluate({
    taskId: "task_001",
    factors: {
      impact: 2,
      irreversibility: 2,
      dataSensitivity: 2,
      autonomyModeRisk: 2,
      tenantImpact: 1,
      blastRadius: 1,
      historicalFailureRate: 5,
      evidenceConfidence: "high",
    },
  });

  assert.equal(result.taskId, "task_001");
  assert.ok(result.riskScore >= 0 && result.riskScore <= 1);
  assert.equal(result.factorBreakdown.length, 8);
  assert.ok(result.factorBreakdown.some((factor) => factor.factor === "historicalFailureRate"));
});

test("RiskEvaluationEngine accepts legacy 8-factor requests and maps action requirements", () => {
  const engine = createEngine();
  const request = {
    taskId: "task_legacy_001",
    factors: {
      operationRisk: "delete",
      targetResourceCriticality: "production",
      dataSensitivity: "restricted",
      autonomyModeRisk: "supervised",
      tenantImpact: "tenant",
      blastRadius: "platform",
      historicalFailureRate: "high",
      evidenceConfidence: "low",
    },
  };

  const result = engine.evaluate(request as unknown as RiskEvaluationRequest);

  assert.ok(["medium", "high", "critical"].includes(result.riskLevel));
  assert.ok(result.factorBreakdown.some((factor) => factor.factor === "operationRisk"));
  if (result.riskLevel === "critical") {
    assert.equal(result.requiresApproval, true);
    assert.ok(result.actions.includes("require_break_glass_approval"));
  }
});

test("RiskEvaluationEngine continues to support legacy 6-factor requests", () => {
  const engine = createEngine();
  const result = engine.evaluate({
    taskId: "task_legacy_002",
    factors: {
      stepTypeRisk: "external_call",
      targetSystemRisk: "staging",
      dataClassRisk: "internal",
      blastRadius: "workflow",
      priorFailureRatePercent: 12,
      confidence: "medium",
    },
  });

  assert.ok(["low", "medium", "high", "critical"].includes(result.riskLevel));
  assert.equal(result.factorBreakdown.length, 6);
  assert.ok(result.factorBreakdown.some((factor) => factor.factor === "priorFailureRate"));
});

test("RiskEvaluationEngine applies domain overrides only when they raise risk", () => {
  const engine = createEngine({
    domainProfiles: new Map([["finance", "critical"]]),
  });
  const result = engine.evaluate({
    taskId: "task_003",
    domainId: "finance",
    factors: {
      stepTypeRisk: "read",
      targetSystemRisk: "internal",
      dataClassRisk: "public",
      blastRadius: "single_task",
      priorFailureRatePercent: 0,
      confidence: "high",
    },
  });

  assert.equal(result.riskLevel, "critical");
  assert.equal(result.requiresApproval, true);
});

test("loadRiskConfig returns the current canonical matrix", () => {
  const config = loadRiskConfig();

  assert.ok(typeof config.factorWeights.impact === "number");
  assert.ok(typeof config.factorWeights.historicalFailureRate === "number");
  assert.ok(typeof config.riskLevelThresholds.low === "number");
  assert.ok(typeof config.riskLevelActions.critical.autoExecute === "boolean");
});
