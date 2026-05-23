/**
 * Unit tests for risk-control index exports
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  RiskEvaluationEngine,
  RiskEvaluationError,
  loadRiskConfig,
  type RiskLevel,
  type StepTypeRisk,
  type TargetSystemRisk,
  type DataClassRisk,
  type BlastRadius,
  type ConfidenceLevel,
  type RiskFactors,
  type RiskEvaluationRequest,
  type RiskEvaluationResult,
  type RiskEvaluationEngineOptions,
  type RiskConfig,
  type RiskLevelActionConfig,
} from "../../../../../src/platform/five-plane-control-plane/risk-control/index.js";

test("RiskEvaluationEngine is exported and instantiable", () => {
  const mockConfig: RiskConfig = {
    factorWeights: {
      impact: 3,
      irreversibility: 4,
      dataSensitivity: 3,
      autonomyModeRisk: 2,
      tenantImpact: 2,
      blastRadius: 2,
      historicalFailureRate: 2,
      evidenceConfidence: 1,
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
    riskLevelThresholds: { low: 0.25, medium: 0.5, high: 0.75, critical: 1.0 },
    riskLevelActions: {
      low: { autoExecute: true, logLevel: "info", requiresApproval: false, sideEffect: "normal", evidenceLevel: "basic" },
      medium: { autoExecute: true, logLevel: "warn", requiresApproval: false, sideEffect: "normal_with_validation", evidenceLevel: "enhanced" },
      high: { autoExecute: false, logLevel: "error", requiresApproval: true, approvalType: "standard", sideEffect: "restricted", evidenceLevel: "full" },
      critical: { autoExecute: false, logLevel: "critical", requiresApproval: true, approvalType: "break_glass", sideEffect: "prohibited", evidenceLevel: "legal" },
    },
  };

  const engine = new RiskEvaluationEngine({ config: mockConfig });
  assert.ok(engine instanceof RiskEvaluationEngine);
});

test("RiskEvaluationError is exported and instantiable", () => {
  const error = new RiskEvaluationError("test error", "TEST_CODE", { detail: "test" });
  assert.equal(error.message, "test error");
  assert.equal(error.code, "TEST_CODE");
  assert.equal(error.name, "RiskEvaluationError");
});

test("RiskEvaluationError can be thrown and caught", () => {
  const error = new RiskEvaluationError("error message", "ERR_CODE");
  let caught: Error | null = null;
  try {
    throw error;
  } catch (e) {
    caught = e as Error;
  }
  assert.ok(caught instanceof RiskEvaluationError);
  assert.equal(caught?.message, "error message");
});

test("loadRiskConfig is exported as a function", () => {
  assert.equal(typeof loadRiskConfig, "function");
});

test("All types are exported", () => {
  const level: RiskLevel = "low";
  const stepType: StepTypeRisk = "read";
  const target: TargetSystemRisk = "internal";
  const dataClass: DataClassRisk = "public";
  const blast: BlastRadius = "single_task";
  const confidence: ConfidenceLevel = "high";

  const factors: RiskFactors = {
    impact: 3,
    irreversibility: 4,
    dataSensitivity: 3,
    autonomyModeRisk: 2,
    tenantImpact: 2,
    blastRadius: 2,
    historicalFailureRate: 5,
    evidenceConfidence: confidence,
  };

  const request: RiskEvaluationRequest = {
    taskId: "test-task",
    factors: factors,
  };

  assert.equal(request.taskId, "test-task");
  assert.equal(factors.impact, 3);
});

test("RiskConfig type can be constructed", () => {
  const config: RiskConfig = {
    factorWeights: {
      impact: 3,
      irreversibility: 4,
      dataSensitivity: 3,
      autonomyModeRisk: 2,
      tenantImpact: 2,
      blastRadius: 2,
      historicalFailureRate: 2,
      evidenceConfidence: 1,
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
    riskLevelThresholds: { low: 0.25, medium: 0.5, high: 0.75, critical: 1.0 },
    riskLevelActions: {
      low: { autoExecute: true, logLevel: "info", requiresApproval: false, sideEffect: "normal", evidenceLevel: "basic" },
      medium: { autoExecute: true, logLevel: "warn", requiresApproval: false, sideEffect: "normal_with_validation", evidenceLevel: "enhanced" },
      high: { autoExecute: false, logLevel: "error", requiresApproval: true, approvalType: "standard", sideEffect: "restricted", evidenceLevel: "full" },
      critical: { autoExecute: false, logLevel: "critical", requiresApproval: true, approvalType: "break_glass", sideEffect: "prohibited", evidenceLevel: "legal" },
    },
  };

  assert.ok(config);
  assert.equal(config.factorWeights.impact, 3);
  assert.equal(config.riskLevelActions.critical.approvalType, "break_glass");
});

test("RiskLevelActionConfig type can be constructed", () => {
  const actionConfig: RiskLevelActionConfig = {
    autoExecute: true,
    logLevel: "info",
    requiresApproval: false,
    sideEffect: "normal",
    evidenceLevel: "basic",
  };

  assert.ok(actionConfig);
  assert.equal(actionConfig.autoExecute, true);
  assert.equal(actionConfig.evidenceLevel, "basic");
});

test("RiskEvaluationEngineOptions type can be constructed with optional domainRiskProfiles", () => {
  const config: RiskConfig = {
    factorWeights: {
      impact: 3,
      irreversibility: 4,
      dataSensitivity: 3,
      autonomyModeRisk: 2,
      tenantImpact: 2,
      blastRadius: 2,
      historicalFailureRate: 2,
      evidenceConfidence: 1,
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
    riskLevelThresholds: { low: 0.25, medium: 0.5, high: 0.75, critical: 1.0 },
    riskLevelActions: {
      low: { autoExecute: true, logLevel: "info", requiresApproval: false, sideEffect: "normal", evidenceLevel: "basic" },
      medium: { autoExecute: true, logLevel: "warn", requiresApproval: false, sideEffect: "normal_with_validation", evidenceLevel: "enhanced" },
      high: { autoExecute: false, logLevel: "error", requiresApproval: true, approvalType: "standard", sideEffect: "restricted", evidenceLevel: "full" },
      critical: { autoExecute: false, logLevel: "critical", requiresApproval: true, approvalType: "break_glass", sideEffect: "prohibited", evidenceLevel: "legal" },
    },
  };

  const optionsWithoutProfiles: RiskEvaluationEngineOptions = {
    config: config,
  };

  const domainProfiles = new Map([["domain1", "high" as RiskLevel]]);
  const optionsWithProfiles: RiskEvaluationEngineOptions = {
    config: config,
    domainRiskProfiles: domainProfiles,
  };

  assert.ok(optionsWithoutProfiles);
  assert.ok(optionsWithProfiles);
  assert.equal(optionsWithProfiles.domainRiskProfiles?.get("domain1"), "high");
});
