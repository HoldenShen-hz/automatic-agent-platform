/**
 * Integration Tests: Risk Control
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  RiskEvaluationEngine,
  loadRiskConfig,
  type RiskEvaluationRequest,
  type RiskLevel,
} from "../../../../../src/platform/five-plane-control-plane/risk-control/index.js";

// ============================================================================
// Risk Control End-to-End Integration Tests
// ============================================================================

test("integration: risk escalation from low to critical", () => {
  const engine = new RiskEvaluationEngine();

  const lowRiskRequest: RiskEvaluationRequest = {
    taskId: "task_risk_low",
    stepId: "step_risk_low",
    stepType: "read",
    targetSystem: "api",
    targetPath: "/public/data",
    dataClasses: ["public_data"],
    blastRadius: "none",
    confidenceLevel: "high",
    historicalAccuracy: 0.95,
    estimatedImpact: "none",
    rollbackFeasibility: "full",
  };

  const mediumRiskRequest: RiskEvaluationRequest = {
    taskId: "task_risk_med",
    stepId: "step_risk_med",
    stepType: "write",
    targetSystem: "filesystem",
    targetPath: "/workspace/project/src/index.ts",
    dataClasses: ["code"],
    blastRadius: "team",
    confidenceLevel: "medium",
    historicalAccuracy: 0.7,
    estimatedImpact: "moderate",
    rollbackFeasibility: "partial",
  };

  const highRiskRequest: RiskEvaluationRequest = {
    taskId: "task_risk_high",
    stepId: "step_risk_high",
    stepType: "delete",
    targetSystem: "database",
    targetPath: "/production/users",
    dataClasses: ["PII"],
    blastRadius: "all_users",
    confidenceLevel: "low",
    historicalAccuracy: 0.5,
    estimatedImpact: "severe",
    rollbackFeasibility: "none",
  };

  const lowResult = engine.evaluate(lowRiskRequest);
  const medResult = engine.evaluate(mediumRiskRequest);
  const highResult = engine.evaluate(highRiskRequest);

  const riskOrder: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

  assert.ok(riskOrder[lowResult.riskLevel] <= riskOrder[medResult.riskLevel]);
  assert.ok(riskOrder[medResult.riskLevel] <= riskOrder[highResult.riskLevel]);
});

test("integration: multiple steps compose risk profile", () => {
  const engine = new RiskEvaluationEngine();

  const requests: RiskEvaluationRequest[] = [
    { taskId: "task_compose_1", stepId: "step_1", stepType: "read", targetSystem: "api", targetPath: "/data/1", dataClasses: ["public_data"], blastRadius: "none", confidenceLevel: "high", historicalAccuracy: 0.95, estimatedImpact: "none", rollbackFeasibility: "full" },
    { taskId: "task_compose_2", stepId: "step_2", stepType: "read", targetSystem: "api", targetPath: "/data/2", dataClasses: ["public_data"], blastRadius: "none", confidenceLevel: "high", historicalAccuracy: 0.95, estimatedImpact: "none", rollbackFeasibility: "full" },
    { taskId: "task_compose_3", stepId: "step_3", stepType: "write", targetSystem: "database", targetPath: "/cache", dataClasses: ["internal_data"], blastRadius: "team", confidenceLevel: "high", historicalAccuracy: 0.9, estimatedImpact: "moderate", rollbackFeasibility: "full" },
  ];

  const results = requests.map((req) => engine.evaluate(req));

  assert.ok(results.every((r) => r.taskId.startsWith("task_compose")));
  assert.ok(results[2].factors.executionRisk > results[0].factors.executionRisk);
});

test("integration: rollback feasibility affects risk score", () => {
  const engine = new RiskEvaluationEngine();

  const fullRollback: RiskEvaluationRequest = {
    taskId: "task_rollback_full",
    stepId: "step_rollback_full",
    stepType: "write",
    targetSystem: "database",
    targetPath: "/test",
    dataClasses: ["code"],
    blastRadius: "single_user",
    confidenceLevel: "high",
    historicalAccuracy: 0.9,
    estimatedImpact: "moderate",
    rollbackFeasibility: "full",
  };

  const noRollback: RiskEvaluationRequest = {
    taskId: "task_rollback_none",
    stepId: "step_rollback_none",
    stepType: "write",
    targetSystem: "database",
    targetPath: "/test",
    dataClasses: ["code"],
    blastRadius: "single_user",
    confidenceLevel: "high",
    historicalAccuracy: 0.9,
    estimatedImpact: "moderate",
    rollbackFeasibility: "none",
  };

  const fullResult = engine.evaluate(fullRollback);
  const noResult = engine.evaluate(noRollback);

  assert.ok(noResult.score >= fullResult.score);
  assert.ok(noResult.factors.rollbackPenalty > fullResult.factors.rollbackPenalty);
});

test("integration: blast radius amplifies risk", () => {
  const engine = new RiskEvaluationEngine();

  const noneRadius: RiskEvaluationRequest = {
    taskId: "task_radius_none",
    stepId: "step_radius_none",
    stepType: "write",
    targetSystem: "database",
    targetPath: "/test",
    dataClasses: ["internal_data"],
    blastRadius: "none",
    confidenceLevel: "high",
    historicalAccuracy: 0.9,
    estimatedImpact: "none",
    rollbackFeasibility: "full",
  };

  const orgRadius: RiskEvaluationRequest = {
    taskId: "task_radius_org",
    stepId: "step_radius_org",
    stepType: "write",
    targetSystem: "database",
    targetPath: "/test",
    dataClasses: ["internal_data"],
    blastRadius: "organization",
    confidenceLevel: "high",
    historicalAccuracy: 0.9,
    estimatedImpact: "none",
    rollbackFeasibility: "full",
  };

  const noneResult = engine.evaluate(noneRadius);
  const orgResult = engine.evaluate(orgRadius);

  assert.ok(orgResult.factors.blastRadiusRisk >= noneResult.factors.blastRadiusRisk);
});

test("integration: risk config is loaded correctly", () => {
  const config = loadRiskConfig();

  assert.ok(config !== null);
  assert.ok(config.riskMatrix !== undefined);

  const levels: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  levels.forEach((level) => {
    assert.ok(config.riskMatrix[level] !== undefined);
    assert.ok(typeof config.riskMatrix[level].minScore === "number");
    assert.ok(typeof config.riskMatrix[level].maxScore === "number");
  });
});

test("integration: confidence level affects penalty", () => {
  const engine = new RiskEvaluationEngine();

  const highConfidence: RiskEvaluationRequest = {
    taskId: "task_conf_high",
    stepId: "step_conf_high",
    stepType: "write",
    targetSystem: "database",
    targetPath: "/test",
    dataClasses: ["internal_data"],
    blastRadius: "team",
    confidenceLevel: "high",
    historicalAccuracy: 0.95,
    estimatedImpact: "moderate",
    rollbackFeasibility: "partial",
  };

  const lowConfidence: RiskEvaluationRequest = {
    taskId: "task_conf_low",
    stepId: "step_conf_low",
    stepType: "write",
    targetSystem: "database",
    targetPath: "/test",
    dataClasses: ["internal_data"],
    blastRadius: "team",
    confidenceLevel: "low",
    historicalAccuracy: 0.5,
    estimatedImpact: "moderate",
    rollbackFeasibility: "partial",
  };

  const highResult = engine.evaluate(highConfidence);
  const lowResult = engine.evaluate(lowConfidence);

  assert.ok(lowResult.factors.confidencePenalty >= highResult.factors.confidencePenalty);
});
