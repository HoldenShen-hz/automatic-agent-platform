import assert from "node:assert/strict";
import test from "node:test";

import {
  createCanonicalRiskConfig,
  createCriticalRiskFactors,
  createHighRiskFactors,
  createLowRiskFactors,
  createMediumRiskFactors,
  createRiskRequest,
} from "../../../../helpers/risk-control.js";
import { RiskEvaluationEngine } from "../../../../../src/platform/control-plane/risk-control/risk-evaluation-engine.js";

test("RiskEvaluationEngine evaluates low risk requests", () => {
  const engine = new RiskEvaluationEngine({ config: createCanonicalRiskConfig() });
  const result = engine.evaluate(createRiskRequest(createLowRiskFactors(), { taskId: "risk-low" }));

  assert.equal(result.riskLevel, "low");
  assert.equal(result.autoExecute, true);
  assert.equal(result.requiresApproval, false);
  assert.deepEqual(result.actions, ["log", "proceed"]);
  assert.ok(result.riskScore < 0.25);
});

test("RiskEvaluationEngine evaluates medium risk requests", () => {
  const engine = new RiskEvaluationEngine({ config: createCanonicalRiskConfig() });
  const result = engine.evaluate(createRiskRequest(createMediumRiskFactors(), { taskId: "risk-medium" }));

  assert.equal(result.riskLevel, "medium");
  assert.equal(result.autoExecute, false);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.approvalType, "standard");
  assert.deepEqual(result.actions, ["log", "require_approval", "proceed_with_validation", "enhanced_monitoring"]);
  assert.ok(result.riskScore >= 0.5);
  assert.ok(result.riskScore < 0.75);
});

test("RiskEvaluationEngine evaluates high risk requests", () => {
  const engine = new RiskEvaluationEngine({ config: createCanonicalRiskConfig() });
  const result = engine.evaluate(createRiskRequest(createHighRiskFactors(), { taskId: "risk-high" }));

  assert.equal(result.riskLevel, "high");
  assert.equal(result.autoExecute, false);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.approvalType, "standard");
  assert.ok(result.actions.includes("require_approval"));
  assert.ok(result.actions.includes("full_evidence"));
});

test("RiskEvaluationEngine evaluates critical risk requests", () => {
  const engine = new RiskEvaluationEngine({ config: createCanonicalRiskConfig() });
  const result = engine.evaluate(createRiskRequest(createCriticalRiskFactors(), { taskId: "risk-critical" }));

  assert.equal(result.riskLevel, "critical");
  assert.equal(result.autoExecute, false);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.approvalType, "break_glass");
  assert.ok(result.actions.includes("require_break_glass_approval"));
  assert.ok(result.actions.includes("incident_create"));
  assert.equal(result.evidenceLevel, "legal");
});

test("RiskEvaluationEngine exposes 8-factor breakdown without undefined values", () => {
  const engine = new RiskEvaluationEngine({ config: createCanonicalRiskConfig() });
  const result = engine.evaluate(createRiskRequest(createMediumRiskFactors(), { taskId: "risk-breakdown" }));

  assert.equal(result.factorBreakdown.length, 8);
  assert.deepEqual(result.factorBreakdown.map((factor) => factor.factor), [
    "operationRisk",
    "targetResourceCriticality",
    "dataSensitivity",
    "autonomyModeRisk",
    "tenantImpact",
    "blastRadius",
    "historicalFailureRate",
    "evidenceConfidence",
  ]);
  for (const factor of result.factorBreakdown) {
    assert.ok(Number.isFinite(factor.value));
    assert.ok(Number.isFinite(factor.weight));
    assert.ok(Number.isFinite(factor.weightedValue));
  }
});

test("RiskEvaluationEngine raises risk via domain override but never lowers it", () => {
  const engine = new RiskEvaluationEngine({
    config: createCanonicalRiskConfig(),
    domainRiskProfiles: new Map([["regulated-domain", "high" as const]]),
  });

  const raised = engine.evaluate(
    createRiskRequest(createLowRiskFactors(), {
      taskId: "risk-domain-raised",
      domainId: "regulated-domain",
    }),
  );
  const unchanged = engine.evaluate(
    createRiskRequest(createCriticalRiskFactors(), {
      taskId: "risk-domain-unchanged",
      domainId: "regulated-domain",
    }),
  );

  assert.equal(raised.riskLevel, "high");
  assert.equal(unchanged.riskLevel, "critical");
});
