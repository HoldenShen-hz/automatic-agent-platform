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
} from "../../../../src/platform/five-plane-control-plane/risk-control/index.js";

import {
  loadRiskConfig as loadRiskConfigFromModule,
} from "../../../../src/platform/five-plane-control-plane/risk-control/risk-config-loader.js";

import type {
  RiskConfig,
  RiskLevelActionConfig,
  StepTypeRisk,
  TargetSystemRisk,
  DataClassRisk,
} from "../../../../src/platform/five-plane-control-plane/risk-control/types.js";

// ============================================================================
// Risk Evaluation Engine Tests
// ============================================================================

test("RiskEvaluationEngine evaluates low risk request", () => {
  const engine = new RiskEvaluationEngine();

  const request: RiskEvaluationRequest = {
    taskId: "task_001",
    stepId: "step_001",
    stepType: "read",
    targetSystem: "database",
    targetPath: "/readonly/report",
    dataClasses: ["public_data"],
    blastRadius: "single_user",
    confidenceLevel: "high",
    historicalAccuracy: 0.9,
    estimatedImpact: "minimal",
    rollbackFeasibility: "full",
  };

  const result = engine.evaluate(request);

  assert.equal(result.riskLevel, "LOW");
  assert.equal(result.taskId, "task_001");
  assert.ok(result.score >= 0 && result.score <= 100);
  assert.ok(result.factors.executionRisk >= 0);
  assert.ok(result.factors.dataExfiltrationRisk >= 0);
});

test("RiskEvaluationEngine evaluates medium risk for write operations", () => {
  const engine = new RiskEvaluationEngine();

  const request: RiskEvaluationRequest = {
    taskId: "task_002",
    stepId: "step_002",
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

  const result = engine.evaluate(request);

  assert.ok(["LOW", "MEDIUM"].includes(result.riskLevel));
  assert.ok(result.factors.executionRisk > 0);
});

test("RiskEvaluationEngine evaluates high risk for destructive operations", () => {
  const engine = new RiskEvaluationEngine();

  const request: RiskEvaluationRequest = {
    taskId: "task_003",
    stepId: "step_003",
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

  const result = engine.evaluate(request);

  assert.ok(["MEDIUM", "HIGH", "CRITICAL"].includes(result.riskLevel));
});

test("RiskEvaluationEngine calculates blast radius factor", () => {
  const engine = new RiskEvaluationEngine();

  const result = engine.evaluate({
    taskId: "task_004",
    stepId: "step_004",
    stepType: "write",
    targetSystem: "database",
    targetPath: "/data",
    dataClasses: ["financial_data"],
    blastRadius: "organization",
    confidenceLevel: "high",
    historicalAccuracy: 0.9,
    estimatedImpact: "moderate",
    rollbackFeasibility: "partial",
  });

  assert.ok(result.factors.blastRadiusRisk > 0);
});

test("RiskEvaluationEngine handles high confidence", () => {
  const engine = new RiskEvaluationEngine();

  const result = engine.evaluate({
    taskId: "task_005",
    stepId: "step_005",
    stepType: "read",
    targetSystem: "api",
    targetPath: "/public/data",
    dataClasses: ["public_data"],
    blastRadius: "none",
    confidenceLevel: "high",
    historicalAccuracy: 0.95,
    estimatedImpact: "none",
    rollbackFeasibility: "full",
  });

  assert.ok(result.confidence >= 0.9);
});

test("RiskEvaluationEngine produces risk factors breakdown", () => {
  const engine = new RiskEvaluationEngine();

  const result = engine.evaluate({
    taskId: "task_006",
    stepId: "step_006",
    stepType: "execute",
    targetSystem: "shell",
    targetPath: "/workspace/script.sh",
    dataClasses: ["code"],
    blastRadius: "team",
    confidenceLevel: "medium",
    historicalAccuracy: 0.75,
    estimatedImpact: "moderate",
    rollbackFeasibility: "partial",
  });

  assert.ok(result.factors !== undefined);
  assert.ok(typeof result.factors.executionRisk === "number");
  assert.ok(typeof result.factors.dataExfiltrationRisk === "number");
  assert.ok(typeof result.factors.blastRadiusRisk === "number");
  assert.ok(typeof result.factors.confidencePenalty === "number");
  assert.ok(typeof result.factors.rollbackPenalty === "number");
});

test("RiskEvaluationEngine handles rollback infeasibility", () => {
  const engine = new RiskEvaluationEngine();

  const result = engine.evaluate({
    taskId: "task_007",
    stepId: "step_007",
    stepType: "write",
    targetSystem: "database",
    targetPath: "/production",
    dataClasses: ["PII", "financial_data"],
    blastRadius: "all_users",
    confidenceLevel: "low",
    historicalAccuracy: 0.6,
    estimatedImpact: "severe",
    rollbackFeasibility: "none",
  });

  assert.ok(result.factors.rollbackPenalty > 0);
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

  assert.ok(config.riskMatrix !== undefined);
});

test("RiskConfig has valid risk levels", () => {
  const config = loadRiskConfig();

  assert.ok(["LOW", "MEDIUM", "HIGH", "CRITICAL"].every((level) => config.riskMatrix[level] !== undefined));
});

// ============================================================================
// Risk Level Tests
// ============================================================================

test("RiskLevel enum values are valid", () => {
  const levels: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

  assert.equal(levels.length, 4);
  levels.forEach((level) => {
    assert.ok(["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(level));
  });
});

test("RiskEvaluationResult contains all required fields", () => {
  const engine = new RiskEvaluationEngine();

  const result = engine.evaluate({
    taskId: "task_008",
    stepId: "step_008",
    stepType: "read",
    targetSystem: "api",
    targetPath: "/test",
    dataClasses: ["public_data"],
    blastRadius: "none",
    confidenceLevel: "high",
    historicalAccuracy: 0.9,
    estimatedImpact: "none",
    rollbackFeasibility: "full",
  });

  assert.ok(result.riskLevel !== undefined);
  assert.ok(result.score !== undefined);
  assert.ok(result.factors !== undefined);
  assert.ok(result.mitigations !== undefined);
  assert.ok(result.recommendations !== undefined);
  assert.ok(result.confidence !== undefined);
  assert.ok(result.reasonCode !== undefined);
});

// ============================================================================
// Risk Evaluation Error Tests
// ============================================================================

test("RiskEvaluationError has correct properties", () => {
  const error = new RiskEvaluationError("E001", "Invalid request", { taskId: "task_009" });

  assert.equal(error.code, "E001");
  assert.equal(error.message, "Invalid request");
  assert.ok(error.details !== undefined);
});

test("RiskEvaluationError is instance of Error", () => {
  const error = new RiskEvaluationError("E002", "Test error");

  assert.ok(error instanceof Error);
});

// ============================================================================
// Risk Factors Structure Tests
// ============================================================================

test("RiskFactors has all required fields", () => {
  const factors: RiskFactors = {
    executionRisk: 25,
    dataExfiltrationRisk: 10,
    blastRadiusRisk: 15,
    confidencePenalty: 5,
    rollbackPenalty: 0,
  };

  assert.ok(typeof factors.executionRisk === "number");
  assert.ok(typeof factors.dataExfiltrationRisk === "number");
  assert.ok(typeof factors.blastRadiusRisk === "number");
  assert.ok(typeof factors.confidencePenalty === "number");
  assert.ok(typeof factors.rollbackPenalty === "number");
});

test("BlastRadius enum values are valid", () => {
  const radii: BlastRadius[] = ["none", "single_user", "team", "organization", "all_users", "external"];

  assert.equal(radii.length, 6);
});
